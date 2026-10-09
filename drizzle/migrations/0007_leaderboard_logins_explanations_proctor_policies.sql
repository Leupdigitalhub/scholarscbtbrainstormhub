ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.my_corrections(_attempt_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare a attempts; t tests; res jsonb;
begin
  select * into a from attempts where id = _attempt_id and student_id = auth.uid();
  if a.id is null or a.status <> 'submitted' then return null; end if;
  select * into t from tests where id = a.test_id;
  if not t.show_corrections then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'text', q.text, 'type', q.type, 'subject', q.subject, 'options', q.options,
    'correct', q.correct_answer, 'answer', coalesce(a.answers->>q.id::text, ''), 'marks', q.marks,
    'explanation', q.explanation
  ) order by q.subject, q.position), '[]'::jsonb) into res
  from questions q
  where q.test_id = a.test_id
    and (a.delivery = '{}'::jsonb or a.delivery is null
         or (a.delivery->'order') ? q.id::text
         or exists (select 1 from jsonb_each(a.delivery) e where jsonb_typeof(e.value)='array' and e.value ? q.id::text));
  return res;
end $function$;

CREATE OR REPLACE FUNCTION public.leaderboard(_test_id uuid DEFAULT NULL)
RETURNS TABLE(student_id uuid, full_name text, class text, tests_taken bigint, total_score numeric, total_marks numeric, percent numeric, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select a.student_id, coalesce(nullif(p.full_name,''),'Student'), coalesce(p.class,''),
         count(*), sum(a.score), sum(a.total),
         case when sum(a.total) > 0 then round(sum(a.score)*100/sum(a.total), 1) else 0 end,
         a.student_id = auth.uid()
  from attempts a
  join tests t on t.id = a.test_id
  left join profiles p on p.id = a.student_id
  where a.status = 'submitted' and auth.uid() is not null
    and (_test_id is null or a.test_id = _test_id)
    and (t.show_results or public.has_role(auth.uid(),'admin'))
    and not public.has_role(a.student_id,'admin')
  group by a.student_id, p.full_name, p.class
  order by 7 desc, 5 desc
  limit 500
$$;
REVOKE ALL ON FUNCTION public.leaderboard(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.leaderboard(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_student_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare p profiles;
begin
  if auth.uid() is null or public.has_role(auth.uid(),'admin') then return; end if;
  if exists (select 1 from admin_notifications where kind='login' and body like '%' || auth.uid()::text || '%' and created_at > now() - interval '2 minutes') then return; end if;
  select * into p from profiles where id = auth.uid();
  insert into admin_notifications(kind, title, body)
  values ('login', coalesce(nullif(p.full_name,''),'A student') || ' signed in',
          trim(coalesce(p.class,'') || ' ' || coalesce(p.student_id,'')) || ' · id:' || auth.uid()::text);
end $$;
REVOKE ALL ON FUNCTION public.log_student_login() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_student_login() TO authenticated;

DO $$ BEGIN
  CREATE POLICY "students upload own proctor files" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'proctor' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admins read proctor files" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'proctor' AND public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;