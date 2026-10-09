ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS gift_enabled boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.attempt_gift_message(_attempt_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select case when t.gift_enabled then coalesce(t.gift_message,'') else '__off__' end
  from attempts a join tests t on t.id = a.test_id
  where a.id = _attempt_id and (a.student_id = auth.uid() or public.has_role(auth.uid(),'admin'))
$$;