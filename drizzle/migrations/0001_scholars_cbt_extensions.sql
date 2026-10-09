alter table public.profiles add column phone text not null default '';
alter table public.tests add column attempts_allowed int not null default 1;
alter table public.app_settings add column grade_scale jsonb not null default '[{"grade":"A","min":90},{"grade":"B","min":80},{"grade":"C","min":70},{"grade":"D","min":60},{"grade":"E","min":50},{"grade":"F","min":0}]'::jsonb;
alter table public.attempts drop constraint attempts_test_id_student_id_key;

create table public.subjects (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
grant select on public.subjects to anon, authenticated;
grant insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "read subjects" on public.subjects for select to anon, authenticated using (true);
create policy "admin manage subjects" on public.subjects for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.classes (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
grant select on public.classes to anon, authenticated;
grant insert, update, delete on public.classes to authenticated;
grant all on public.classes to service_role;
alter table public.classes enable row level security;
create policy "read classes" on public.classes for select to anon, authenticated using (true);
create policy "admin manage classes" on public.classes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.subjects (name) values ('Mathematics'),('English'),('Physics'),('Chemistry'),('Biology'),('Economics'),('Government'),('Literature'),('Geography'),('Civic Education');
insert into public.classes (name) values ('JSS 1'),('JSS 2'),('JSS 3'),('SS 1'),('SS 2'),('SS 3');
update public.app_settings set lesson_name = 'SCHOLARS CBT' where id = 1;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, student_id, class, email, phone)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'student_id',''),
    coalesce(new.raw_user_meta_data->>'class',''),
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'phone',''));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end $$;

drop function public.student_tests();
create function public.student_tests()
returns table (id uuid, title text, subject text, class text, instructions text, duration_minutes int,
  pass_percentage int, start_at timestamptz, end_at timestamptz, question_count bigint, total_marks numeric, attempts_allowed int, attempts_used bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.subject, t.class, t.instructions, t.duration_minutes, t.pass_percentage, t.start_at, t.end_at,
    (select count(*) from questions q where q.test_id = t.id),
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
  return aid;
end $$;

drop function public.my_results();
create function public.my_results()
returns table (attempt_id uuid, test_id uuid, test_title text, subject text, score numeric, total numeric, pass_percentage int,
  submitted_at timestamptz, pending_grading boolean, show_results boolean, correct_count int, wrong_count int, unanswered_count int, status text)
language sql stable security definer set search_path = public as $$
  select a.id, t.id, t.title, t.subject,
    case when t.show_results then a.score end, case when t.show_results then a.total end,
    t.pass_percentage, a.submitted_at, a.pending_grading, t.show_results,
    case when t.show_results then a.correct_count end, case when t.show_results then a.wrong_count end,
    case when t.show_results then a.unanswered_count end, a.status
  from attempts a join tests t on t.id = a.test_id
  where a.student_id = auth.uid()
  order by a.started_at desc
$$;
grant execute on function public.my_results() to authenticated;