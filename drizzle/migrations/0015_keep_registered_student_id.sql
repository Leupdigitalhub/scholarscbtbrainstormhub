CREATE SEQUENCE IF NOT EXISTS public.student_id_seq START WITH 1;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid text := upper(trim(coalesce(new.raw_user_meta_data->>'student_id','')));
BEGIN
  IF sid !~ '^SCHCBT[0-9]{4,}$' OR EXISTS (SELECT 1 FROM public.profiles WHERE upper(student_id) = sid) THEN
    LOOP
      sid := 'SCHCBT' || lpad(nextval('public.student_id_seq')::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE upper(student_id) = sid);
    END LOOP;
  END IF;
  INSERT INTO public.profiles (id, full_name, student_id, class, email, phone)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), sid,
    coalesce(new.raw_user_meta_data->>'class',''), coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'phone',''));
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'student') ON CONFLICT DO NOTHING;
  RETURN new;
END $$;