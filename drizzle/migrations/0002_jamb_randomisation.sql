-- JAMB-style delivery: per-test question draw, shuffled question order and shuffled options.

alter table public.tests add column if not exists shuffle_questions boolean not null default false;
alter table public.tests add column if not exists shuffle_options boolean not null default false;
alter table public.tests add column if not exists draw_count integer;
alter table public.tests add constraint tests_draw_count_check check (draw_count is null or draw_count > 0);

alter table public.attempts add column if not exists delivery jsonb not null default '{}'::jsonb;

-- Build the question set, order and option order for one attempt. Runs once, when the attempt starts.
create or replace function public.build_delivery(_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a attempts; t tests; ids uuid[] := '{}'::uuid[]; opts jsonb := '{}'::jsonb; q record; idx int[];
begin
  select * into a from attempts where id = _attempt_id;
  if a.id is null then return '{}'::jsonb; end if;
  select * into t from tests where id = a.test_id;

  if coalesce(t.draw_count, 0) > 0 then
    select coalesce(array_agg(id), '{}'::uuid[]) into ids from (
      select id from questions where test_id = a.test_id order by random() limit t.draw_count
    ) x;
  else
    select coalesce(array_agg(id), '{}'::uuid[]) into ids from (
      select id from questions where test_id = a.test_id order by position, created_at
    ) x;
  end if;

  if t.shuffle_questions and coalesce(array_length(ids, 1), 0) > 1 then
    select coalesce(array_agg(id), '{}'::uuid[]) into ids from (
      select unnest(ids) as id order by random()
    ) x;
  end if;

  for q in select id, type, options from questions where test_id = a.test_id and id = any(ids) loop
    if q.type = 'mcq' and jsonb_typeof(q.options) = 'array' and jsonb_array_length(q.options) > 0 then
      if t.shuffle_options then
        select array_agg(i order by random()) into idx from (
          select i from generate_series(0, jsonb_array_length(q.options) - 1) as i
        ) x;
      else
        select array_agg(i order by i) into idx from (
          select i from generate_series(0, jsonb_array_length(q.options) - 1) as i
        ) x;
      end if;
      opts := opts || jsonb_build_object(q.id::text, to_jsonb(idx));
    end if;
  end loop;

  update attempts set delivery = jsonb_build_object('order', to_jsonb(ids), 'options', opts) where id = _attempt_id;
  return jsonb_build_object('order', to_jsonb(ids), 'options', opts);
end $$;
revoke execute on function public.build_delivery(uuid) from public, anon, authenticated;

-- Start (or resume) an attempt, then build its question set.
create or replace function public.start_attempt(_test_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t tests; aid uuid; used int;
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
  insert into attempts (test_id, student_id, deadline) values (_test_id, auth.uid(), now() + make_interval(mins => t.duration_minutes)) returning id into aid;
  perform build_delivery(aid);
  return aid;
end $$;
grant execute on function public.start_attempt(uuid) to authenticated;

-- Hand the student their own copy of the test: own question set, own order, own option order.
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
      'id', q.id, 'type', q.type, 'text', q.text, 'marks', q.marks,
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
    'test', jsonb_build_object('id',t.id,'title',t.title,'subject',t.subject,'duration_minutes',t.duration_minutes),
    'questions', qs);
end $$;
grant execute on function public.get_attempt(uuid) to authenticated;

-- Mark only the questions this student was actually given.
create or replace function public.recalc_attempt(_attempt_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a attempts; q record; ans text; s numeric := 0; tot numeric := 0; c int := 0; w int := 0; u int := 0; pend boolean := false; ok boolean;
begin
  select * into a from attempts where id = _attempt_id;
  for q in select * from questions
    where test_id = a.test_id
      and (jsonb_typeof(a.delivery->'order') <> 'array'
           or id::text = any (select jsonb_array_elements_text(a.delivery->'order')))
  loop
    tot := tot + q.marks;
    ans := nullif(trim(coalesce(a.answers->>q.id::text,'')),'');
    if ans is null then u := u + 1; continue; end if;
    if q.type = 'written' then
      if a.manual_marks ? q.id::text then
        s := s + least(q.marks, greatest(0,(a.manual_marks->>q.id::text)::numeric));
        if (a.manual_marks->>q.id::text)::numeric > 0 then c := c + 1; else w := w + 1; end if;
      else pend := true; end if;
    else
      if q.type = 'short' then
        ok := exists (select 1 from unnest(string_to_array(q.correct_answer,'|')) x where lower(trim(x)) = lower(ans));
      else
        ok := lower(ans) = lower(trim(q.correct_answer));
      end if;
      if ok then s := s + q.marks; c := c + 1; else w := w + 1; end if;
    end if;
  end loop;
  update attempts set score = s, total = tot, correct_count = c, wrong_count = w, unanswered_count = u, pending_grading = pend where id = _attempt_id;
end $$;
revoke execute on function public.recalc_attempt(uuid) from public, anon, authenticated;

-- Tell students how many questions they will actually get.
create or replace function public.student_tests()
returns table (id uuid, title text, subject text, class text, instructions text, duration_minutes int,
  pass_percentage int, start_at timestamptz, end_at timestamptz, question_count bigint, total_marks numeric, attempts_allowed int, attempts_used bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.subject, t.class, t.instructions, t.duration_minutes, t.pass_percentage, t.start_at, t.end_at,
    (select case when coalesce(t.draw_count,0) > 0 and t.draw_count < count(*) then t.draw_count else count(*) end
       from questions q where q.test_id = t.id),
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