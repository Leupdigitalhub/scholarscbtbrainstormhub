alter table public.tests add column if not exists multi_subject boolean not null default false;
alter table public.tests add column if not exists per_subject_count integer not null default 20;
alter table public.tests add column if not exists compulsory_subjects text[] not null default array['Mathematics'];
alter table public.tests add column if not exists elective_subjects text[] not null default array['English','Physics','Chemistry','Biology'];
alter table public.tests add column if not exists electives_to_pick integer not null default 2;
alter table public.questions add column if not exists subject text not null default '';
alter table public.attempts add column if not exists chosen_subjects text[] not null default '{}'::text[];
create index if not exists questions_test_subject_idx on public.questions(test_id, subject);

create or replace function public.build_delivery(_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts; t tests; ids uuid[] := '{}'::uuid[]; part uuid[]; subj text; opts jsonb := '{}'::jsonb; q record; idx int[];
begin
  select * into a from attempts where id = _attempt_id;
  if a.id is null then return '{}'::jsonb; end if;
  select * into t from tests where id = a.test_id;

  if t.multi_subject then
    foreach subj in array (t.compulsory_subjects || a.chosen_subjects) loop
      select coalesce(array_agg(id), '{}'::uuid[]) into part from (
        select id from questions where test_id = a.test_id and lower(subject) = lower(subj)
        order by random() limit greatest(t.per_subject_count,1)) x;
      if not t.shuffle_questions then
        select coalesce(array_agg(id), '{}'::uuid[]) into part from (
          select id from questions where id = any(part) order by position, created_at) x;
      end if;
      ids := ids || part;
    end loop;
  else
    if coalesce(t.draw_count, 0) > 0 then
      select coalesce(array_agg(id), '{}'::uuid[]) into ids from (
        select id from questions where test_id = a.test_id order by random() limit t.draw_count) x;
    else
      select coalesce(array_agg(id), '{}'::uuid[]) into ids from (
        select id from questions where test_id = a.test_id order by position, created_at) x;
    end if;
    if t.shuffle_questions and coalesce(array_length(ids, 1), 0) > 1 then
      select coalesce(array_agg(id), '{}'::uuid[]) into ids from (select unnest(ids) as id order by random()) x;
    end if;
  end if;

  for q in select id, type, options from questions where test_id = a.test_id and id = any(ids) loop
    if q.type = 'mcq' and jsonb_typeof(q.options) = 'array' and jsonb_array_length(q.options) > 0 then
      if t.shuffle_options then
        select array_agg(i order by random()) into idx from (select i from generate_series(0, jsonb_array_length(q.options) - 1) as i) x;
      else
        select array_agg(i order by i) into idx from (select i from generate_series(0, jsonb_array_length(q.options) - 1) as i) x;
      end if;
      opts := opts || jsonb_build_object(q.id::text, to_jsonb(idx));
    end if;
  end loop;

  update attempts set delivery = jsonb_build_object('order', to_jsonb(ids), 'options', opts) where id = _attempt_id;
  return jsonb_build_object('order', to_jsonb(ids), 'options', opts);
end $$;
revoke execute on function public.build_delivery(uuid) from public, anon, authenticated;

create or replace function public.test_subject_config(_test_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('multi_subject', t.multi_subject, 'per_subject_count', t.per_subject_count,
    'compulsory', to_jsonb(t.compulsory_subjects), 'electives', to_jsonb(t.elective_subjects), 'pick', t.electives_to_pick)
  from tests t where t.id = _test_id and exists (select 1 from student_tests() st where st.id = _test_id)
$$;
grant execute on function public.test_subject_config(uuid) to authenticated;

create or replace function public.start_attempt_subjects(_test_id uuid, _subjects text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare t tests; aid uuid; used int; s text; clean text[] := '{}'::text[];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from student_tests() st where st.id = _test_id) then raise exception 'Test not available'; end if;
  select * into t from tests where id = _test_id;
  select id into aid from attempts where test_id = _test_id and student_id = auth.uid() and status = 'in_progress' limit 1;
  if aid is not null then
    perform finalize_if_expired(aid);
    if exists (select 1 from attempts where id = aid and status = 'in_progress') then return aid; end if;
  end if;
  if t.start_at is not null and now() < t.start_at then raise exception 'Test not yet available'; end if;
  if t.end_at is not null and now() > t.end_at then raise exception 'Test closed'; end if;
  select count(*) into used from attempts where test_id = _test_id and student_id = auth.uid();
  if used >= greatest(t.attempts_allowed,1) then raise exception 'You have used all your attempts for this test'; end if;
  if t.multi_subject then
    foreach s in array coalesce(_subjects, '{}'::text[]) loop
      if not exists (select 1 from unnest(t.elective_subjects) e where lower(e) = lower(s)) then raise exception 'Invalid subject: %', s; end if;
      if not exists (select 1 from unnest(clean) c where lower(c) = lower(s)) then clean := clean || s; end if;
    end loop;
    if coalesce(array_length(clean,1),0) <> t.electives_to_pick then
      raise exception 'Please choose exactly % subjects', t.electives_to_pick;
    end if;
  end if;
  insert into attempts (test_id, student_id, deadline, chosen_subjects)
  values (_test_id, auth.uid(), now() + make_interval(mins => t.duration_minutes), clean) returning id into aid;
  perform build_delivery(aid);
  return aid;
end $$;
grant execute on function public.start_attempt_subjects(uuid, text[]) to authenticated;

create or replace function public.start_attempt(_test_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from tests where id = _test_id and multi_subject) then
    raise exception 'Please choose your subjects first';
  end if;
  return start_attempt_subjects(_test_id, '{}'::text[]);
end $$;
grant execute on function public.start_attempt(uuid) to authenticated;

create or replace function public.get_attempt(_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts; t tests; qs jsonb;
begin
  select * into a from attempts where id = _attempt_id and student_id = auth.uid();
  if a.id is null then raise exception 'Not found'; end if;
  perform finalize_if_expired(a.id);
  select * into a from attempts where id = _attempt_id;
  select * into t from tests where id = a.test_id;
  if a.status <> 'in_progress' then
    return jsonb_build_object('id',a.id,'status',a.status,'deadline',a.deadline,'server_now',now(),'answers',a.answers,
      'test', jsonb_build_object('id',t.id,'title',t.title,'subject',t.subject,'duration_minutes',t.duration_minutes),
      'questions', '[]'::jsonb);
  end if;
  if jsonb_typeof(a.delivery->'order') <> 'array' then
    perform build_delivery(a.id);
    select * into a from attempts where id = _attempt_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'type', q.type, 'text', q.text, 'marks', q.marks, 'subject', q.subject,
      'options', case q.type
        when 'mcq' then coalesce((
          select jsonb_agg(jsonb_build_object('text', q.options->>(x.i), 'value', chr(65 + x.i)) order by x.ord)
          from (select (ordinality)::int as ord, (value)::int as i
                from jsonb_array_elements_text(a.delivery->'options'->q.id::text) with ordinality) x
        ), '[]'::jsonb)
        when 'true_false' then jsonb_build_array(
          jsonb_build_object('text','True','value','True'),
          jsonb_build_object('text','False','value','False'))
        else '[]'::jsonb end
    ) order by p.ord), '[]'::jsonb)
  into qs
  from (select (ordinality)::int as ord, (value)::uuid as qid
        from jsonb_array_elements_text(a.delivery->'order') with ordinality) p
  join questions q on q.id = p.qid;
  return jsonb_build_object('id',a.id,'status',a.status,'deadline',a.deadline,'server_now',now(),'answers',a.answers,
    'test', jsonb_build_object('id',t.id,'title',t.title,'subject',t.subject,'duration_minutes',t.duration_minutes,'multi_subject',t.multi_subject),
    'questions', qs);
end $$;
grant execute on function public.get_attempt(uuid) to authenticated;

create or replace function public.student_tests()
returns table (id uuid, title text, subject text, class text, instructions text, duration_minutes int,
  pass_percentage int, start_at timestamptz, end_at timestamptz, question_count bigint, total_marks numeric, attempts_allowed int, attempts_used bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.subject, t.class, t.instructions, t.duration_minutes, t.pass_percentage, t.start_at, t.end_at,
    case when t.multi_subject then (t.per_subject_count * (coalesce(array_length(t.compulsory_subjects,1),0) + t.electives_to_pick))::bigint
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