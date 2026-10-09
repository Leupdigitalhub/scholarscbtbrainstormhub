CREATE TABLE public.bank_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  type text NOT NULL DEFAULT 'mcq',
  text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL DEFAULT '',
  explanation text NOT NULL DEFAULT '',
  marks numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_questions TO authenticated;
GRANT ALL ON public.bank_questions TO service_role;
ALTER TABLE public.bank_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages bank" ON public.bank_questions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));