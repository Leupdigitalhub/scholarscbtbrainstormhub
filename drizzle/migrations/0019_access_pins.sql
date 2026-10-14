CREATE TABLE public.access_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_pins TO authenticated;
GRANT ALL ON public.access_pins TO service_role;
ALTER TABLE public.access_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages pins" ON public.access_pins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.my_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.access_pins WHERE redeemed_by = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.redeem_pin(_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT id INTO _id FROM public.access_pins
   WHERE upper(replace(code,'-','')) = upper(replace(trim(_code),'-','')) AND redeemed_by IS NULL FOR UPDATE;
  IF _id IS NULL THEN RETURN false; END IF;
  UPDATE public.access_pins SET redeemed_by = auth.uid(), redeemed_at = now() WHERE id = _id;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.redeem_pin(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_access() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.redeem_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_videos(_attempt_id uuid) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _paths text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT coalesce(array_agg(photo_path), '{}') INTO _paths FROM public.proctor_events
   WHERE attempt_id = _attempt_id AND kind = 'video' AND photo_path IS NOT NULL;
  DELETE FROM public.proctor_events WHERE attempt_id = _attempt_id AND kind = 'video';
  RETURN _paths;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_videos(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_delete_videos(uuid) TO authenticated;

CREATE POLICY "admin deletes proctor files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proctor' AND public.has_role(auth.uid(), 'admin'));