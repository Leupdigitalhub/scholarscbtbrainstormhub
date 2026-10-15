ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS pin_required boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.my_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT coalesce((SELECT pin_required FROM public.app_settings WHERE id = 1), true)
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.access_pins WHERE redeemed_by = auth.uid());
$$;