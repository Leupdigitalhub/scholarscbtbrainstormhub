create or replace function public.pick_questions(_test uuid, _subj text, _n int, _shuffle boolean)
returns uuid[] language plpgsql security definer set search_path to 'public' as $f$
declare res uuid[] := '{}'; part uuid[]; rest uuid[]; k text; kind text;
begin
  -- tier 1: one random passage, tier 2: one random summary (questions shuffled inside block only)
  foreach kind in array array['passage','summary'] loop
    select x.k into k from (
      select split_part(text, '⟦/P⟧', 1) k,
        (split_part(split_part(text, '⟦T⟧', 1), '⟦P⟧', 2) ~* '(summary|cloze)') is_sum
      from questions where test_id = _test and (_subj is null or lower(subject) = lower(_subj)) and text like '⟦P⟧%'
      group by 1, 2) x
    where x.is_sum = (kind = 'summary') order by random() limit 1;
    if k is not null then
      select array_agg(id order by case when _shuffle then random() else 0 end, position, created_at) into part
        from questions where test_id = _test and (_subj is null or lower(subject) = lower(_subj))
          and text like '⟦P⟧%' and split_part(text, '⟦/P⟧', 1) = k;
      if _n is null or coalesce(array_length(res,1),0) + coalesce(array_length(part,1),0) <= _n then
        res := res || part;
      end if;
    end if;
  end loop;
  -- tier 3: general questions shuffled
  select coalesce(array_agg(x.id order by x.r, x.position, x.created_at), '{}') into rest from (
    select id, case when _shuffle or _n is not null then random() else 0 end r, position, created_at
    from questions where test_id = _test and (_subj is null or lower(subject) = lower(_subj)) and text not like '⟦P⟧%'
    order by 2, position, created_at
    limit case when _n is null then null else greatest(_n - coalesce(array_length(res,1),0), 0) end) x;
  return res || rest;
end $f$;
revoke execute on function public.pick_questions(uuid,text,int,boolean) from anon, public;