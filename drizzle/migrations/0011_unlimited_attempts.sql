create or replace function public.start_attempt_subjects(_test_id uuid, _subjects text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare t tests; aid uuid; s text; clean text[] := '{}'::text[];
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
comment on column public.tests.attempts_allowed is 'DEPRECATED: attempts are unlimited';