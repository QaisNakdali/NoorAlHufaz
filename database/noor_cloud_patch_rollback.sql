-- Restore transport functions only. No student data is rewritten.
drop trigger if exists noor_guard_week_transition on public.app_state;
-- Additive, SECURITY INVOKER: same table privileges/RLS as the existing CAS client.
-- Rollback: deploy the previous client, then drop this function; no data conversion.
create or replace function public.noor_apply_patch(p_state_id text, p_expected_rev bigint, p_next_rev bigint, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_data jsonb; current_rev bigint; operation jsonb; target text[]; patched jsonb; i integer;
begin
  if p_expected_rev is null or p_next_rev is null or p_patch is null or p_expected_rev < 0 or p_next_rev <> p_expected_rev + 1 or jsonb_typeof(p_patch) <> 'array' or jsonb_array_length(p_patch) > 2000 then
    raise exception 'Invalid revision or patch';
  end if;
  select data, rev into current_data, current_rev from public.app_state where id = p_state_id for update;
  if not found then return jsonb_build_object('applied', false); end if;
  if current_rev <> p_expected_rev then return jsonb_build_object('applied', false, 'rev', current_rev); end if;
  patched := current_data;
  for operation in select value from jsonb_array_elements(p_patch) loop
    if jsonb_typeof(operation->'path') <> 'array' then raise exception 'Invalid path'; end if;
    select array_agg(value order by ordinality) into target from jsonb_array_elements_text(operation->'path') with ordinality;
    if target is null or cardinality(target) = 0 or cardinality(target) > 30 then raise exception 'Invalid path'; end if;
    -- Normalization can introduce containers absent from legacy stored JSON.
    -- Create missing parents before applying a leaf; never acknowledge a silent no-op.
    if operation->>'op' in ('set','insert') then
      for i in 1..cardinality(target)-1 loop
        if patched #> target[1:i] is null or patched #> target[1:i] = 'null'::jsonb then
          patched := jsonb_set(patched, target[1:i], case when target[i+1] ~ '^[0-9]+$' then '[]'::jsonb else '{}'::jsonb end, true);
        end if;
      end loop;
    end if;
    if operation->>'op' = 'set' and operation ? 'value' then
      patched := jsonb_set(patched, target, operation->'value', true);
    elsif operation->>'op' = 'remove' then
      patched := patched #- target;
    elsif operation->>'op' = 'insert' and operation ? 'value' then
      patched := jsonb_insert(patched, target, operation->'value', false);
    else raise exception 'Invalid operation'; end if;
  end loop;
  update public.app_state set data = patched, rev = p_next_rev, updated_at = now() where id = p_state_id;
  return jsonb_build_object('applied', true, 'rev', p_next_rev);
end;
$$;
revoke all on function public.noor_apply_patch(text,bigint,bigint,jsonb) from public;
grant execute on function public.noor_apply_patch(text,bigint,bigint,jsonb) to anon, authenticated;

drop function if exists noor_internal.guard_week_transition();
drop function if exists public.noor_patch_document(jsonb,jsonb);
