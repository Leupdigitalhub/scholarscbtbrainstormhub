CREATE SEQUENCE IF NOT EXISTS public.student_id_seq START WITH 1 INCREMENT BY 1;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin')
      AND p.student_id !~ '^SCHCBT[0-9]{4,}$'
    ORDER BY p.created_at
  LOOP
    UPDATE public.profiles SET student_id = 'SCHCBT' || lpad(nextval('public.student_id_seq')::text, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, student_id, class, email, phone)
  VALUES (new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    'SCHCBT' || lpad(nextval('public.student_id_seq')::text, 4, '0'),
    coalesce(new.raw_user_meta_data->>'class',''),
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'phone',''));
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'student');
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.email_for_student_id(_sid text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE upper(trim(student_id)) = upper(trim(_sid)) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.email_for_student_id(text) FROM public;
GRANT EXECUTE ON FUNCTION public.email_for_student_id(text) TO anon, authenticated;