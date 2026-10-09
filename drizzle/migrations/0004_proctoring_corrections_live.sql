CREATE TABLE public.proctor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('snapshot','tab_switch','camera_off','fullscreen_exit')),
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proctor_events_attempt_idx ON public.proctor_events(attempt_id, created_at);
GRANT SELECT, INSERT ON public.proctor_events TO authenticated;
GRANT ALL ON public.proctor_events TO service_role;
ALTER TABLE public.proctor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student logs own in-progress attempt" ON public.proctor_events FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND EXISTS (SELECT 1 FROM public.attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid() AND a.status = 'in_progress'));
CREATE POLICY "admin reads proctor events" ON public.proctor_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "student uploads own proctor photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proctor' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "admin reads proctor photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proctor' AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.build_delivery(_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a attempts; t tests; ids uuid[] := '{}'::uuid[]; part uuid[]; subj text; opts jsonb := '{}'::jsonb; q record; idx int[];
begin
  select * into a from attempts where id = _attempt_id;
  if a.id is null then return '{}'::jsonb; end if;
  select * into t from tests where id = a.test_id;

  if t.multi_subject then
    foreach subj in array (t.compulsory_subjects || a.chosen_subjects) loop
      select coalesce(array_agg(x.id order by x.r), '{}'::uuid[]) into part from (
        select id, random() as r from questions where test_id = a.test_id and lower(subject) = lower(subj)
        order by r limit greatest(t.per_subject_count,1)) x;
      if not t.shuffle_questions then
        select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into part
          from questions where id = any(part);
      end if;
      ids := ids || part;
    end loop;
  else
    if coalesce(t.draw_count, 0) > 0 then
      select coalesce(array_agg(x.id order by x.r), '{}'::uuid[]) into ids from (
        select id, random() as r from questions where test_id = a.test_id order by r limit t.draw_count) x;
      if not t.shuffle_questions then
        select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into ids
          from questions where id = any(ids);
      end if;
    elsif t.shuffle_questions then
      select coalesce(array_agg(id order by random()), '{}'::uuid[]) into ids
        from questions where test_id = a.test_id;
    else
      select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into ids
        from questions where test_id = a.test_id;
    end if;
  end if;

  for q in select id, type, options from questions where test_id = a.test_id and id = any(ids) loop
    if q.type = 'mcq' and jsonb_typeof(q.options) = 'array' and jsonb_array_length(q.options) > 0 then
      if t.shuffle_options then
        select array_agg(i order by random()) into idx from generate_series(0, jsonb_array_length(q.options) - 1) as i;
      else
        select array_agg(i order by i) into idx from generate_series(0, jsonb_array_length(q.options) - 1) as i;
      end if;
      opts := opts || jsonb_build_object(q.id::text, to_jsonb(idx));
    end if;
  end loop;

  update attempts set delivery = jsonb_build_object('order', to_jsonb(ids), 'options', opts) where id = _attempt_id;
  return jsonb_build_object('order', to_jsonb(ids), 'options', opts);
end $function$;

alter table public.tests add column if not exists show_corrections boolean not null default false;

create or replace function public.my_corrections(_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a attempts; t tests; res jsonb;
begin
  select * into a from attempts where id = _attempt_id and student_id = auth.uid();
  if a.id is null or a.status <> 'submitted' then return null; end if;
  select * into t from tests where id = a.test_id;
  if not t.show_corrections then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'text', q.text, 'type', q.type, 'subject', q.subject, 'options', q.options,
    'correct', q.correct_answer, 'answer', coalesce(a.answers->>q.id::text, ''), 'marks', q.marks
  ) order by q.subject, q.position), '[]'::jsonb) into res
  from questions q
  where q.test_id = a.test_id
    and (a.delivery = '{}'::jsonb or a.delivery is null
         or (a.delivery->'order') ? q.id::text
         or exists (select 1 from jsonb_each(a.delivery) e where jsonb_typeof(e.value)='array' and e.value ? q.id::text));
  return res;
end $$;
grant execute on function public.my_corrections(uuid) to authenticated;

create or replace function public.admin_live_attempts()
returns table (attempt_id uuid, student_id uuid, full_name text, class text, test_title text,
  started_at timestamptz, deadline timestamptz, answered int, total_questions int,
  tab_switches bigint, camera_off bigint, photos bigint, last_photo text, last_photo_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.student_id, p.full_name, p.class, t.title, a.started_at, a.deadline,
    (select count(*)::int from jsonb_each_text(a.answers) x where trim(x.value) <> ''),
    coalesce(jsonb_array_length(a.delivery->'order'), (select count(*)::int from questions q where q.test_id = t.id)),
    (select count(*) from proctor_events e where e.attempt_id = a.id and e.kind = 'tab_switch'),
    (select count(*) from proctor_events e where e.attempt_id = a.id and e.kind = 'camera_off'),
    (select count(*) from proctor_events e where e.attempt_id = a.id and e.kind = 'snapshot'),
    (select e.photo_path from proctor_events e where e.attempt_id = a.id and e.kind = 'snapshot' order by e.created_at desc limit 1),
    (select e.created_at from proctor_events e where e.attempt_id = a.id and e.kind = 'snapshot' order by e.created_at desc limit 1)
  from attempts a join tests t on t.id = a.test_id left join profiles p on p.id = a.student_id
  where a.status = 'in_progress' and a.deadline > now() and public.has_role(auth.uid(), 'admin')
  order by a.started_at desc
$$;
grant execute on function public.admin_live_attempts() to authenticated;