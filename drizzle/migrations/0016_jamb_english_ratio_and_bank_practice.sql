CREATE OR REPLACE FUNCTION public.build_delivery(_attempt_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare a attempts; t tests; ids uuid[] := '{}'::uuid[]; part uuid[]; subj text; opts jsonb := '{}'::jsonb; q record; idx int[]; n int;
begin
  select * into a from attempts where id = _attempt_id;
  if a.id is null then return '{}'::jsonb; end if;
  select * into t from tests where id = a.test_id;
  if t.multi_subject then
    foreach subj in array (t.compulsory_subjects || a.chosen_subjects) loop
      n := greatest(t.per_subject_count,1);
      if lower(subj) = 'english' then n := n + least(n, 20); end if;
      select coalesce(array_agg(x.id order by x.r), '{}'::uuid[]) into part from (
        select id, random() as r from questions where test_id = a.test_id and lower(subject) = lower(subj)
        order by r limit n) x;
      if not t.shuffle_questions then
        select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into part from questions where id = any(part);
      end if;
      ids := ids || part;
    end loop;
  else
    if coalesce(t.draw_count, 0) > 0 then
      select coalesce(array_agg(x.id order by x.r), '{}'::uuid[]) into ids from (
        select id, random() as r from questions where test_id = a.test_id order by r limit t.draw_count) x;
      if not t.shuffle_questions then
        select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into ids from questions where id = any(ids);
      end if;
    elsif t.shuffle_questions then
      select coalesce(array_agg(id order by random()), '{}'::uuid[]) into ids from questions where test_id = a.test_id;
    else
      select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into ids from questions where test_id = a.test_id;
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
revoke execute on function public.build_delivery(uuid) from public, anon, authenticated;

create or replace function public.student_tests()
returns table (id uuid, title text, subject text, class text, instructions text, duration_minutes int,
  pass_percentage int, start_at timestamptz, end_at timestamptz, question_count bigint, total_marks numeric, attempts_allowed int, attempts_used bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.subject, t.class, t.instructions, t.duration_minutes, t.pass_percentage, t.start_at, t.end_at,
    case when t.multi_subject then (t.per_subject_count * (coalesce(array_length(t.compulsory_subjects,1),0) + t.electives_to_pick)
      + case when exists (select 1 from unnest(t.compulsory_subjects) c where lower(c)='english') then least(t.per_subject_count,20) else 0 end)::bigint
    else (select case when coalesce(t.draw_count,0) > 0 and t.draw_count < count(*) then t.draw_count else count(*) end
       from questions q where q.test_id = t.id) end,
    (select coalesce(sum(marks),0) from questions q where q.test_id = t.id),
    t.attempts_allowed,
    (select count(*) from attempts a where a.test_id = t.id and a.student_id = auth.uid())
  from tests t
  where t.status = 'published'
    and (t.class = '' or lower(t.class) = 'all' or lower(trim(t.class)) = lower(trim((select p.class from profiles p where p.id = auth.uid()))))
    and auth.uid() is not null
  order by t.start_at nulls first, t.created_at desc
$$;
grant execute on function public.student_tests() to authenticated;

create or replace function public.attempt_subject_scores(_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a attempts; res jsonb;
begin
  select * into a from attempts where id = _attempt_id and (student_id = auth.uid() or has_role(auth.uid(),'admin'));
  if a.id is null or a.status = 'in_progress' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('subject', s, 'right', r, 'total', n) order by (lower(s) <> 'english'), s), '[]'::jsonb) into res from (
    select coalesce(nullif(q.subject,''),'General') s, count(*) n,
      count(*) filter (where q.type <> 'written' and nullif(trim(coalesce(a.answers->>q.id::text,'')),'') is not null and
        case when q.type='short' then exists (select 1 from unnest(string_to_array(q.correct_answer,'|')) x where lower(trim(x)) = lower(trim(a.answers->>q.id::text)))
        else lower(trim(a.answers->>q.id::text)) = lower(trim(q.correct_answer)) end) r
    from questions q where q.test_id = a.test_id
      and (jsonb_typeof(a.delivery->'order') <> 'array' or q.id::text = any (select jsonb_array_elements_text(a.delivery->'order')))
    group by 1) x;
  return res;
end $$;
grant execute on function public.attempt_subject_scores(uuid) to authenticated;

create policy "students read bank for practice" on public.bank_questions for select to authenticated using (true);
grant select on public.bank_questions to authenticated;