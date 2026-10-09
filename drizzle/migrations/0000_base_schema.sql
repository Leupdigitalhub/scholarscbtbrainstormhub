create type public.app_role as enum ('admin', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  student_id text not null default '',
  class text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  lesson_name text not null default 'My Lesson',
  show_rankings boolean not null default false
);
insert into public.app_settings (id) values (1);
grant select on public.app_settings to anon, authenticated;
grant update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "public read settings" on public.app_settings for select to anon, authenticated using (true);
create policy "admin update settings" on public.app_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default '',
  class text not null default '',
  instructions text not null default '',
  duration_minutes int not null default 30,
  pass_percentage int not null default 50,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  show_results boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tests to authenticated;
grant all on public.tests to service_role;
alter table public.tests enable row level security;
create policy "admin all tests" on public.tests for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  position int not null default 0,
  type text not null check (type in ('mcq','true_false','short','written')),
  text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null default '',
  marks numeric not null default 1,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "admin all questions" on public.questions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null,
  started_at timestamptz not null default now(),
  deadline timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted')),
  answers jsonb not null default '{}'::jsonb,
  manual_marks jsonb not null default '{}'::jsonb,
  score numeric not null default 0,
  total numeric not null default 0,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  unanswered_count int not null default 0,
  pending_grading boolean not null default false,
  unique (test_id, student_id)
);
grant select on public.attempts to authenticated;
grant all on public.attempts to service_role;
alter table public.attempts enable row level security;
create policy "own or admin attempts" on public.attempts for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, student_id, class, email)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'student_id',''),
    coalesce(new.raw_user_meta_data->>'class',''),
    coalesce(new.email,''));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.admin_exists() to anon, authenticated;

create or replace function public.claim_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(424242);
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'An administrator already exists';
  end if;
  delete from public.user_roles where user_id = auth.uid();
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
  return true;
end $$;
grant execute on function public.claim_admin() to authenticated;

create or replace function public.student_tests()
returns table (id uuid, title text, subject text, class text, instructions text, duration_minutes int,
  pass_percentage int, start_at timestamptz, end_at timestamptz, question_count bigint, total_marks numeric)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.subject, t.class, t.instructions, t.duration_minutes, t.pass_percentage, t.start_at, t.end_at,
    (select count(*) from questions q where q.test_id = t.id),
    (select coalesce(sum(marks),0) from questions q where q.test_id = t.id)
  from tests t
  where t.status = 'published'
    and (t.class = '' or lower(t.class) = 'all' or lower(trim(t.class)) = lower(trim((select p.class from profiles p where p.id = auth.uid()))))
    and auth.uid() is not null
  order by t.created_at desc
$$;
grant execute on function public.student_tests() to authenticated;

create or replace function public.recalc_attempt(_attempt_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a attempts; q record; ans text; s numeric := 0; tot numeric := 0; c int := 0; w int := 0; u int := 0; pend boolean := false; ok boolean;
begin
  select * into a from attempts where id = _attempt_id;
  for q in select * from questions where test_id = a.test_id loop
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

create or replace function public.finalize_if_expired(_attempt_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update attempts set status = 'submitted', submitted_at = deadline
  where id = _attempt_id and status = 'in_progress' and now() > deadline + interval '30 seconds';
  if found then perform recalc_attempt(_attempt_id); end if;
end $$;
revoke execute on function public.finalize_if_expired(uuid) from public, anon, authenticated;

create or replace function public.start_attempt(_test_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t tests; aid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from student_tests() st where st.id = _test_id) then raise exception 'Test not available'; end if;
  select * into t from tests where id = _test_id;
  select id into aid from attempts where test_id = _test_id and student_id = auth.uid();
  if aid is not null then perform finalize_if_expired(aid); return aid; end if;
  if t.start_at is not null and now() < t.start_at then raise exception 'This test has not opened yet'; end if;
  if t.end_at is not null and now() > t.end_at then raise exception 'This test has closed'; end if;
  insert into attempts (test_id, student_id, deadline) values (_test_id, auth.uid(), now() + make_interval(mins => t.duration_minutes)) returning id into aid;
  return aid;
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
  if a.status = 'in_progress' then
    select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'type',q.type,'text',q.text,'options',q.options,'marks',q.marks) order by q.position, q.created_at),'[]'::jsonb)
      into qs from questions q where q.test_id = a.test_id;
  else qs := '[]'::jsonb; end if;
  return jsonb_build_object('id',a.id,'status',a.status,'deadline',a.deadline,'server_now',now(),'answers',a.answers,
    'test', jsonb_build_object('id',t.id,'title',t.title,'subject',t.subject,'duration_minutes',t.duration_minutes),
    'questions', qs);
end $$;
grant execute on function public.get_attempt(uuid) to authenticated;

create or replace function public.save_answers(_attempt_id uuid, _answers jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update attempts set answers = _answers
  where id = _attempt_id and student_id = auth.uid() and status = 'in_progress' and now() <= deadline + interval '30 seconds';
  return found;
end $$;
grant execute on function public.save_answers(uuid, jsonb) to authenticated;

create or replace function public.submit_attempt(_attempt_id uuid, _answers jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update attempts set answers = case when now() <= deadline + interval '30 seconds' then _answers else answers end,
    status = 'submitted', submitted_at = least(now(), deadline)
  where id = _attempt_id and student_id = auth.uid() and status = 'in_progress';
  if found then perform recalc_attempt(_attempt_id); end if;
  return true;
end $$;
grant execute on function public.submit_attempt(uuid, jsonb) to authenticated;

create or replace function public.my_results()
returns table (attempt_id uuid, test_title text, subject text, score numeric, total numeric, pass_percentage int,
  submitted_at timestamptz, pending_grading boolean, show_results boolean, correct_count int, wrong_count int, unanswered_count int, status text)
language sql stable security definer set search_path = public as $$
  select a.id, t.title, t.subject,
    case when t.show_results then a.score end, case when t.show_results then a.total end,
    t.pass_percentage, a.submitted_at, a.pending_grading, t.show_results,
    case when t.show_results then a.correct_count end, case when t.show_results then a.wrong_count end,
    case when t.show_results then a.unanswered_count end, a.status
  from attempts a join tests t on t.id = a.test_id
  where a.student_id = auth.uid()
  order by a.started_at desc
$$;
grant execute on function public.my_results() to authenticated;

create or replace function public.grade_written(_attempt_id uuid, _question_id uuid, _marks numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  update attempts set manual_marks = manual_marks || jsonb_build_object(_question_id::text, _marks) where id = _attempt_id;
  perform recalc_attempt(_attempt_id);
end $$;
grant execute on function public.grade_written(uuid, uuid, numeric) to authenticated;

create or replace function public.admin_reset_attempt(_attempt_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  delete from attempts where id = _attempt_id;
end $$;
grant execute on function public.admin_reset_attempt(uuid) to authenticated;