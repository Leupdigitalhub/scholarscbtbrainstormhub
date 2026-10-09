alter table public.tests alter column compulsory_subjects set default array['English'];
alter table public.tests alter column elective_subjects set default array['Mathematics','Physics','Chemistry','Biology'];
alter table public.tests alter column electives_to_pick set default 3;

CREATE OR REPLACE FUNCTION public.build_delivery(_attempt_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare a attempts; t tests; ids uuid[] := '{}'::uuid[]; part uuid[]; subj text; opts jsonb := '{}'::jsonb; q record; idx int[]; n int;
begin
  select * into a from attempts where id = _attempt_id;
  if a.id is null then return '{}'::jsonb; end if;
  select * into t from tests where id = a.test_id;
  if t.multi_subject then
    foreach subj in array (t.compulsory_subjects || a.chosen_subjects) loop
      n := greatest(t.per_subject_count,1);
      if exists (select 1 from unnest(t.compulsory_subjects) c where lower(c) = lower(subj)) then n := n + 10; end if;
      select coalesce(array_agg(x.id order by x.r), '{}'::uuid[]) into part from (
        select id, random() as r from questions where test_id = a.test_id and lower(subject) = lower(subj)
        order by r limit n) x;
      if not t.shuffle_questions then
        select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into part from questions where id = any(part);
      end if;
      ids := ids || part;
    end loop;
  else
    if coalesce(t.draw_count, 0) > 0 then
      select coalesce(array_agg(x.id order by x.r), '{}'::uuid[]) into ids from (
        select id, random() as r from questions where test_id = a.test_id order by r limit t.draw_count) x;
      if not t.shuffle_questions then
        select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into ids from questions where id = any(ids);
      end if;
    elsif t.shuffle_questions then
      select coalesce(array_agg(id order by random()), '{}'::uuid[]) into ids from questions where test_id = a.test_id;
    else
      select coalesce(array_agg(id order by position, created_at), '{}'::uuid[]) into ids from questions where test_id = a.test_id;
    end if;
  end if;
  for q in select id, type, options from questions where test_id = a.test_id and id = any(ids) loop
    if q.type = 'mcq' and jsonb_typeof(q.options) = 'array' and jsonb_array_length(q.options) > 0 then
      if t.shuffle_options then
        select array_agg(i order by random()) into idx from generate_series(0, jsonb_array_length(q.options) - 1) as i;
      else
        select array_agg(i order by i) into idx from generate_series(0, jsonb_array_length(q.options) - 1) as i;
      end if;
      opts := opts || jsonb_build_object(q.id::text, to_jsonb(idx));
    end if;
  end loop;
  update attempts set delivery = jsonb_build_object('order', to_jsonb(ids), 'options', opts) where id = _attempt_id;
  return jsonb_build_object('order', to_jsonb(ids), 'options', opts);
end $function$;
revoke execute on function public.build_delivery(uuid) from public, anon, authenticated;

create or replace function public.student_tests()
returns table (id uuid, title text, subject text, class text, instructions text, duration_minutes int,
  pass_percentage int, start_at timestamptz, end_at timestamptz, question_count bigint, total_marks numeric, attempts_allowed int, attempts_used bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.subject, t.class, t.instructions, t.duration_minutes, t.pass_percentage, t.start_at, t.end_at,
    case when t.multi_subject then (t.per_subject_count * (coalesce(array_length(t.compulsory_subjects,1),0) + t.electives_to_pick) + 10 * coalesce(array_length(t.compulsory_subjects,1),0))::bigint
    else (select case when coalesce(t.draw_count,0) > 0 and t.draw_count < count(*) then t.draw_count else count(*) end
       from questions q where q.test_id = t.id) end,
    (select coalesce(sum(marks),0) from questions q where q.test_id = t.id),
    t.attempts_allowed,
    (select count(*) from attempts a where a.test_id = t.id and a.student_id = auth.uid())
  from tests t
  where t.status = 'published'
    and (t.class = '' or lower(t.class) = 'all' or lower(trim(t.class)) = lower(trim((select p.class from profiles p where p.id = auth.uid()))))
    and auth.uid() is not null
  order by t.start_at nulls first, t.created_at desc
$$;

CREATE TABLE public.study_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  subject_name text NOT NULL,
  term text NOT NULL,
  topic_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_topics TO authenticated;
GRANT ALL ON public.study_topics TO service_role;
ALTER TABLE public.study_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read topics" ON public.study_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages topics" ON public.study_topics FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.student_topic_progress (
  student_id uuid NOT NULL DEFAULT auth.uid(),
  topic_id uuid NOT NULL REFERENCES public.study_topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, topic_id)
);
GRANT SELECT, INSERT, DELETE ON public.student_topic_progress TO authenticated;
GRANT ALL ON public.student_topic_progress TO service_role;
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress read" ON public.student_topic_progress FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "own progress add" ON public.student_topic_progress FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "own progress remove" ON public.student_topic_progress FOR DELETE TO authenticated USING (student_id = auth.uid());

INSERT INTO public.study_topics (class_name, subject_name, term, topic_order, title)
SELECT c, s, t, o, x FROM (VALUES
('SS 1','Mathematics','1st Term',1,'Number bases'),('SS 1','Mathematics','1st Term',2,'Modular arithmetic'),('SS 1','Mathematics','1st Term',3,'Indices and logarithms'),
('SS 1','Mathematics','2nd Term',1,'Sets and Venn diagrams'),('SS 1','Mathematics','2nd Term',2,'Simple equations and variation'),('SS 1','Mathematics','3rd Term',1,'Quadratic equations'),('SS 1','Mathematics','3rd Term',2,'Trigonometric ratios'),
('SS 2','Mathematics','1st Term',1,'Approximation and sequences'),('SS 2','Mathematics','1st Term',2,'Simultaneous equations'),('SS 2','Mathematics','2nd Term',1,'Circle geometry'),('SS 2','Mathematics','2nd Term',2,'Bearings and distances'),('SS 2','Mathematics','3rd Term',1,'Statistics: mean, median, mode'),('SS 2','Mathematics','3rd Term',2,'Probability'),
('SS 3','Mathematics','1st Term',1,'Surds and matrices'),('SS 3','Mathematics','1st Term',2,'Differentiation'),('SS 3','Mathematics','2nd Term',1,'Integration'),('SS 3','Mathematics','2nd Term',2,'Mensuration of solids'),('SS 3','Mathematics','3rd Term',1,'Revision for WAEC/JAMB'),
('SS 1','English','1st Term',1,'Parts of speech'),('SS 1','English','1st Term',2,'Vowel sounds'),('SS 1','English','2nd Term',1,'Comprehension and summary'),('SS 1','English','2nd Term',2,'Informal letter writing'),('SS 1','English','3rd Term',1,'Consonant sounds'),('SS 1','English','3rd Term',2,'Concord'),
('SS 2','English','1st Term',1,'Formal letter writing'),('SS 2','English','1st Term',2,'Phrases and clauses'),('SS 2','English','2nd Term',1,'Stress and intonation'),('SS 2','English','2nd Term',2,'Synonyms and antonyms'),('SS 2','English','3rd Term',1,'Argumentative essays'),('SS 2','English','3rd Term',2,'Idioms and figurative language'),
('SS 3','English','1st Term',1,'Lexis and structure'),('SS 3','English','1st Term',2,'Speech writing and articles'),('SS 3','English','2nd Term',1,'Oral English revision'),('SS 3','English','2nd Term',2,'Literature texts review'),('SS 3','English','3rd Term',1,'Past questions practice'),
('SS 1','Physics','1st Term',1,'Measurement and units'),('SS 1','Physics','1st Term',2,'Motion: speed, velocity, acceleration'),('SS 1','Physics','2nd Term',1,'Work, energy and power'),('SS 1','Physics','2nd Term',2,'Heat and temperature'),('SS 1','Physics','3rd Term',1,'Density and pressure'),
('SS 2','Physics','1st Term',1,'Newton''s laws of motion'),('SS 2','Physics','1st Term',2,'Equations of motion'),('SS 2','Physics','2nd Term',1,'Waves and sound'),('SS 2','Physics','2nd Term',2,'Light: reflection and refraction'),('SS 2','Physics','3rd Term',1,'Gas laws'),
('SS 3','Physics','1st Term',1,'Electric fields and current'),('SS 3','Physics','1st Term',2,'Magnetism and induction'),('SS 3','Physics','2nd Term',1,'Atomic and nuclear physics'),('SS 3','Physics','2nd Term',2,'Electronics basics'),('SS 3','Physics','3rd Term',1,'Revision for WAEC/JAMB'),
('SS 1','Chemistry','1st Term',1,'Introduction to chemistry'),('SS 1','Chemistry','1st Term',2,'Separation techniques'),('SS 1','Chemistry','2nd Term',1,'Atomic structure'),('SS 1','Chemistry','2nd Term',2,'Chemical bonding'),('SS 1','Chemistry','3rd Term',1,'Periodic table'),
('SS 2','Chemistry','1st Term',1,'Mole concept and stoichiometry'),('SS 2','Chemistry','1st Term',2,'Gas laws'),('SS 2','Chemistry','2nd Term',1,'Acids, bases and salts'),('SS 2','Chemistry','2nd Term',2,'Oxidation and reduction'),('SS 2','Chemistry','3rd Term',1,'Electrolysis'),
('SS 3','Chemistry','1st Term',1,'Organic chemistry: hydrocarbons'),('SS 3','Chemistry','1st Term',2,'Alkanols and alkanoic acids'),('SS 3','Chemistry','2nd Term',1,'Rates of reaction and equilibrium'),('SS 3','Chemistry','2nd Term',2,'Metals and extraction'),('SS 3','Chemistry','3rd Term',1,'Revision for WAEC/JAMB'),
('SS 1','Biology','1st Term',1,'Living things and classification'),('SS 1','Biology','1st Term',2,'The cell'),('SS 1','Biology','2nd Term',1,'Nutrition in plants'),('SS 1','Biology','2nd Term',2,'Ecology basics'),('SS 1','Biology','3rd Term',1,'Microorganisms'),
('SS 2','Biology','1st Term',1,'Digestive system'),('SS 2','Biology','1st Term',2,'Transport in animals and plants'),('SS 2','Biology','2nd Term',1,'Respiration'),('SS 2','Biology','2nd Term',2,'Excretion'),('SS 2','Biology','3rd Term',1,'Nervous system'),
('SS 3','Biology','1st Term',1,'Reproduction'),('SS 3','Biology','1st Term',2,'Genetics and heredity'),('SS 3','Biology','2nd Term',1,'Evolution'),('SS 3','Biology','2nd Term',2,'Ecology: adaptation'),('SS 3','Biology','3rd Term',1,'Revision for WAEC/JAMB')
) v(c,s,t,o,x);