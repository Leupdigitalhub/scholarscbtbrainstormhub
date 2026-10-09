CREATE OR REPLACE FUNCTION public.my_corrections(_attempt_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare a attempts; t tests; res jsonb;
begin
  select * into a from attempts where id = _attempt_id and student_id = auth.uid();
  if a.id is null or a.status <> 'submitted' then return null; end if;
  select * into t from tests where id = a.test_id;
  if not t.show_corrections then return null; end if;
  if jsonb_typeof(a.delivery->'order') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'text', q.text, 'type', q.type, 'subject', q.subject,
      'options', case when q.type = 'mcq' and jsonb_typeof(a.delivery->'options'->q.id::text) = 'array' then coalesce((
          select jsonb_agg(jsonb_build_object('text', q.options->>(x.i), 'value', chr(65 + x.i)) order by x.ord)
          from (select (ordinality)::int as ord, (value)::int as i
                from jsonb_array_elements_text(a.delivery->'options'->q.id::text) with ordinality) x
        ), q.options) else q.options end,
      'correct', q.correct_answer, 'answer', coalesce(a.answers->>q.id::text, ''), 'marks', q.marks,
      'explanation', q.explanation
    ) order by p.ord), '[]'::jsonb) into res
    from (select (ordinality)::int as ord, (value)::uuid as qid
          from jsonb_array_elements_text(a.delivery->'order') with ordinality) p
    join questions q on q.id = p.qid;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'text', q.text, 'type', q.type, 'subject', q.subject, 'options', q.options,
      'correct', q.correct_answer, 'answer', coalesce(a.answers->>q.id::text, ''), 'marks', q.marks,
      'explanation', q.explanation
    ) order by q.subject, q.position), '[]'::jsonb) into res
    from questions q where q.test_id = a.test_id;
  end if;
  return res;
end $function$;