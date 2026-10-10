-- Additive, reversible transport change. No student records are rewritten.
create schema if not exists noor_internal;
revoke all on schema noor_internal from public, anon, authenticated;

create or replace function noor_internal.json_delta(a jsonb, b jsonb, path text[] default '{}')
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare result jsonb := '[]'; k text; i integer; na integer; nb integer; extra integer; tail jsonb;
begin
  if a is not distinct from b then return result; end if;
  if cardinality(path) >= 30 then return jsonb_build_array(jsonb_build_object('op','set','path',path,'value',b)); end if;
  if jsonb_typeof(a)='object' and jsonb_typeof(b)='object' then
    for k in select jsonb_object_keys(a) loop
      if not (b ? k) then result := result || jsonb_build_array(jsonb_build_object('op','remove','path',path || k)); end if;
    end loop;
    for k in select jsonb_object_keys(b) loop
      result := result || noor_internal.json_delta(a->k,b->k,path || k);
    end loop;
    return result;
  end if;
  if jsonb_typeof(a)='array' and jsonb_typeof(b)='array' then
    na:=jsonb_array_length(a); nb:=jsonb_array_length(b); extra:=nb-na;
    if extra > 0 then
      select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into tail from jsonb_array_elements(b) with ordinality as t(value,ord) where ord > extra;
      if tail=a then
        for i in 0..extra-1 loop result := result || jsonb_build_array(jsonb_build_object('op','insert','path',path || i::text,'value',b->i)); end loop;
        return result;
      end if;
    end if;
    if na=nb then
      if na>0 then for i in 0..na-1 loop result := result || noor_internal.json_delta(a->i,b->i,path || i::text); end loop; end if;
      return result;
    end if;
  end if;
  return jsonb_build_array(jsonb_build_object('op','set','path',path,'value',b));
end;
$$;

-- Privileged only to insert server-generated messages into realtime.messages.
-- Internal trigger, no public EXECUTE, fixed search_path; never changes NEW data.
create or replace function noor_internal.broadcast_state_delta()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare message jsonb; delta jsonb;
begin
  if new.rev = old.rev and new.data = old.data then return new; end if;
  delta := noor_internal.json_delta(old.data,new.data);
  message := jsonb_build_object('baseRev',old.rev,'rev',new.rev,'patch',delta);
  -- Below the Free plan's 256KB message limit, including protocol overhead.
  if octet_length(message::text) > 180000 or jsonb_array_length(delta)>2000 then
    message := jsonb_build_object('baseRev',old.rev,'rev',new.rev);
  end if;
  perform realtime.send(message,'state_delta','noor-delta:' || new.id,false);
  return new;
exception when others then
  -- Transport failure must not cancel a student's saved purchase/attendance.
  -- Clients check the small revision every minute and recover any missing event.
  raise warning 'Noor realtime delivery unavailable: %', SQLSTATE;
  return new;
end;
$$;
revoke all on function noor_internal.json_delta(jsonb,jsonb,text[]) from public,anon,authenticated;
revoke all on function noor_internal.broadcast_state_delta() from public,anon,authenticated;
create trigger noor_state_delta after update on public.app_state
for each row execute function noor_internal.broadcast_state_delta();
-- Rollback: drop trigger noor_state_delta on public.app_state;
-- Keep existing app_state publication for older clients during deployment.
