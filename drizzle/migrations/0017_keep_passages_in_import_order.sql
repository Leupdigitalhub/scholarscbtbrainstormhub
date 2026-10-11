create or replace function public.pick_questions(_test uuid, _subj text, _n int, _shuffle boolean)
returns uuid[] language plpgsql security definer set search_path to 'public' as $f$
declare res uuid[] := '{}'; blk record; part uuid[]; rest uuid[];
begin
  -- passage/summary blocks: kept whole, in import order
  for blk in
    select split_part(text, '⟦/P⟧', 1) k, min(position) p, min(created_at) c, count(*) cnt
    from questions where test_id = _test and (_subj is null or lower(subject) = lower(_subj)) and text like '⟦P⟧%'
    group by 1 order by 2, 3
  loop
    if _n is not null and coalesce(array_length(res,1),0) + blk.cnt > _n then continue; end if;
    select array_agg(id order by position, created_at) into part from questions
      where test_id = _test and (_subj is null or lower(subject) = lower(_subj)) and text like '⟦P⟧%' and split_part(text, '⟦/P⟧', 1) = blk.k;
    res := res || part;
  end loop;
  -- other questions: shuffled
  select coalesce(array_agg(x.id order by x.r), '{}') into rest from (
    select id, case when _shuffle or _n is not null then random() else 0 end r, position, created_at
    from questions where test_id = _test and (_subj is null or lower(subject) = lower(_subj)) and text not like '⟦P⟧%'
    order by 2, position, created_at
    limit case when _n is null then null else greatest(_n - coalesce(array_length(res,1),0), 0) end) x;
  if not _shuffle then
    select coalesce(array_agg(id order by position, created_at), '{}') into rest from questions where id = any(rest);
  end if;
  return res || rest;
end $f$;

create or replace function public.build_delivery(_attempt_id uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare a attempts; t tests; ids uuid[] := '{}'::uuid[]; subj text; opts jsonb := '{}'::jsonb; q record; idx int[]; n int;
begin
  select * into a from attempts where id = _attempt_id;
  if a.id is null then return '{}'::jsonb; end if;
  select * into t from tests where id = a.test_id;
  if t.multi_subject then
    foreach subj in array (t.compulsory_subjects || a.chosen_subjects) loop
      n := greatest(t.per_subject_count,1);
      if lower(subj) = 'english' then n := n + least(n, 20); end if;
      ids := ids || pick_questions(a.test_id, subj, n, t.shuffle_questions);
    end loop;
  else
    ids := pick_questions(a.test_id, null, nullif(coalesce(t.draw_count,0),0), t.shuffle_questions);
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
revoke execute on function public.pick_questions(uuid,text,int,boolean) from anon, public;