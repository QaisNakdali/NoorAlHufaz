-- Pure JSON transformation: no table access, writes or privileges beyond its caller.
create or replace function public.noor_patch_document(document jsonb, changes jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = pg_catalog as $$
declare result jsonb := document; operation jsonb; target text[]; child jsonb; grouped jsonb; root_key text; i integer := 0; j integer; n integer := jsonb_array_length(changes);
begin
  while i < n loop
    operation := changes->i;
    if jsonb_typeof(operation->'path') is distinct from 'array' then raise exception 'Invalid path'; end if;
    select array_agg(value order by ordinality) into target from jsonb_array_elements_text(operation->'path') with ordinality;
    if target is null or cardinality(target)=0 or cardinality(target)>30 then raise exception 'Invalid path'; end if;
    if cardinality(target)>1 then
      root_key := target[1]; grouped := '[]'::jsonb; j := i;
      -- Keep operation order, including array insertion/removal. Rebuild each changed
      -- subtree once instead of copying the complete application document per leaf.
      while j<n loop
        operation := changes->j;
        if jsonb_typeof(operation->'path') is distinct from 'array' then raise exception 'Invalid path'; end if;
        if jsonb_array_length(operation->'path')>30 then raise exception 'Invalid path'; end if;
        exit when jsonb_array_length(operation->'path')<2 or operation->'path'->>0 is distinct from root_key;
        j := j+1;
      end loop;
      select jsonb_agg(jsonb_set(value,'{path}',(value->'path')-0) order by ordinality) into grouped
        from jsonb_array_elements(changes) with ordinality where ordinality>i and ordinality<=j;
      child := result #> array[root_key];
      if child is null or child='null'::jsonb then
        if not exists(select 1 from jsonb_array_elements(grouped) op where op->>'op' in ('set','insert')) then i:=j; continue; end if;
        child := case when target[2] ~ '^[0-9]+$' then '[]'::jsonb else '{}'::jsonb end;
      end if;
      result := jsonb_set(result,array[root_key],public.noor_patch_document(child,grouped),true);
      i := j;
    else
      if operation->>'op'='set' and operation?'value' then result := jsonb_set(result,target,operation->'value',true);
      elsif operation->>'op'='remove' then result := result #- target;
      elsif operation->>'op'='insert' and operation?'value' then result := jsonb_insert(result,target,operation->'value',false);
      else raise exception 'Invalid operation'; end if;
      i := i+1;
    end if;
  end loop;
  return result;
end;
$$;
revoke all on function public.noor_patch_document(jsonb,jsonb) from public;
grant execute on function public.noor_patch_document(jsonb,jsonb) to anon, authenticated;

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
  patched := public.noor_patch_document(current_data,p_patch);
  if jsonb_typeof(current_data->'week')='number' and jsonb_typeof(patched->'week')='number' then
    if (patched->>'week')::numeric < (current_data->>'week')::numeric then raise exception 'Cannot restore an older active week'; end if;
    if (patched->>'week')::numeric > (current_data->>'week')::numeric then
      if (patched->>'week')::numeric <> (current_data->>'week')::numeric+1
         or not exists(select 1 from jsonb_array_elements(coalesce(patched->'weeksLog','[]'::jsonb)) w where w->'week'=current_data->'week' and jsonb_typeof(w->'records')='array') then
        raise exception 'Week transition requires the complete archive in the same commit';
      end if;
    end if;
  end if;
  update public.app_state set data = patched, rev = p_next_rev, updated_at = now() where id = p_state_id;
  return jsonb_build_object('applied', true, 'rev', p_next_rev);
end;
$$;
revoke all on function public.noor_apply_patch(text,bigint,bigint,jsonb) from public;
grant execute on function public.noor_apply_patch(text,bigint,bigint,jsonb) to anon, authenticated;

-- Protect all clients, including old versions using direct conditional UPDATE.
create schema if not exists noor_internal;
revoke all on schema noor_internal from public,anon,authenticated;
create or replace function noor_internal.guard_week_transition()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if jsonb_typeof(old.data->'week')='number' and jsonb_typeof(new.data->'week')='number' then
    if (new.data->>'week')::numeric < (old.data->>'week')::numeric then raise exception 'Cannot restore an older active week'; end if;
    if (new.data->>'week')::numeric > (old.data->>'week')::numeric then
      if new.rev<=old.rev or (new.data->>'week')::numeric <> (old.data->>'week')::numeric+1
         or not exists(select 1 from jsonb_array_elements(coalesce(new.data->'weeksLog','[]'::jsonb)) w where w->'week'=old.data->'week' and jsonb_typeof(w->'records')='array') then
        raise exception 'Week transition requires the complete archive in the same commit';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function noor_internal.guard_week_transition() from public,anon,authenticated;
drop trigger if exists noor_guard_week_transition on public.app_state;
create trigger noor_guard_week_transition before update on public.app_state for each row execute function noor_internal.guard_week_transition();
