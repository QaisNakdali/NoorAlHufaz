BEGIN;
-- Pure projection from caller-supplied JSON: no table access or privileged reads.
create or replace function public.noor_parent_latest(p_data jsonb,p_student jsonb,p_today date)
returns jsonb language sql immutable security invoker set search_path=pg_catalog as $$
with raw as (
  select value log,ordinality ord from jsonb_array_elements(coalesce(p_data->'weeksLog','[]')) with ordinality
), weeks as (
  select distinct on ((log->>'week')::integer) log from raw where coalesce(log->>'week','')~'^[0-9]{1,9}$'
  order by (log->>'week')::integer,case when pg_input_is_valid(coalesce(log->>'savedAtIso',''),'timestamptz') then (log->>'savedAtIso')::timestamptz else '1970-01-01'::timestamptz end desc,ord
), sources as (
  select p_student record,p_data->>'weekStartDateIso' start,0 priority,coalesce((p_data->>'week')::integer,0) week
  union all
  select (select x from jsonb_array_elements(coalesce(log->'records','[]')) x where x->>'id'=p_student->>'id' limit 1),log->>'weekStartDateIso',1,(log->>'week')::integer from weeks where (log->>'week')::integer is distinct from (p_data->>'week')::integer
), days as (
  select record,(start::date+(n::integer-1)) date,key,priority,week from sources cross join unnest(array['sun','mon','tue','wed']) with ordinality a(key,n)
  where record is not null and pg_input_is_valid(coalesce(start,''),'date')
), chosen as (
  select distinct on(date) * from days where date<=p_today order by date,priority,week desc
), evaluations as (
  select part,date,record->'ward'->key->>case when part='h' then 'memorization' else 'review' end text,
    case when coalesce((record->'days'->key->>'absent')::boolean,false) then null
      when ((record->'days'->key->>part)='true' or (part='h' and record->'days'->key='true'::jsonb)) and record->'recitationRatings'->key->>part in ('excellent','very-good') then record->'recitationRatings'->key->>part
      when record->'days'->key->'evaluated'->>part='true' and record->'days'->key->>part is distinct from 'true' then 'not-completed' else null end rating
  from chosen cross join unnest(array['h','r']) part
), latest as (
  select distinct on(part) part,date,text,rating from evaluations where rating is not null order by part,date desc
) select coalesce(jsonb_object_agg(part,jsonb_build_object('date',date,'text',coalesce(text,''),'rating',rating)),'{}') from latest;
$$;
revoke all on function public.noor_parent_latest(jsonb,jsonb,date) from public;
grant execute on function public.noor_parent_latest(jsonb,jsonb,date) to anon,authenticated;

-- Additive parent API. No table rebuild, no data backfill, no change to teacher RPCs.
-- Apply to an isolated copy first. Production rollout is a separate reviewed step.
create or replace function public.noor_parent_read(p_token text, p_section text default 'overview', p_options jsonb default '{}')
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare b jsonb; s jsonb; group_row jsonb; r bigint; histories jsonb; orders jsonb; dates jsonb; versions jsonb; result jsonb; overview jsonb; total integer; off integer; lim integer; filtered jsonb; start_date date; end_date date; retired jsonb;
begin
  p_token:=btrim(p_token);
  if p_token is null or length(p_token)<1 or length(p_token)>200 then raise exception 'رابط المتابعة غير صالح' using errcode='22023'; end if;
  select data,rev into b,r from public.app_state where id='noor_al_hufaz_main';
  select count(*) into total from jsonb_array_elements(coalesce(b->'students','[]')) x where btrim(x->>'parentAccessToken')=p_token;
  if total<>1 then raise exception 'رابط المتابعة غير صالح أو تم تغييره' using errcode='22023'; end if;
  select x into s from jsonb_array_elements(b->'students') x where btrim(x->>'parentAccessToken')=p_token;
  select jsonb_build_object('id',x->'id','name',x->'name') into group_row from jsonb_array_elements(coalesce(b->'halaqas','[]')) x where x->>'id'=s->>'halaqaId';
  -- Match the shared uniqueHistory rule: newest saved snapshot, first entry on ties.
  with source as (
    select value as log,ordinality as n from jsonb_array_elements(coalesce(b->'weeksLog','[]')) with ordinality
  ), unique_weeks as (
    select distinct on ((log->>'week')::integer) log,n from source
    where coalesce(log->>'week','') ~ '^[0-9]{1,9}$'
    order by (log->>'week')::integer,
      case when pg_input_is_valid(coalesce(log->>'savedAtIso',''),'timestamp with time zone') then (log->>'savedAtIso')::timestamptz else '1970-01-01'::timestamptz end desc,n
  ), scoped as (
    select log, (select x from jsonb_array_elements(coalesce(log->'records','[]')) x where x->>'id'=s->>'id' limit 1) as record,
      (select x from jsonb_array_elements(coalesce(log->'students','[]')||coalesce(log->'top','[]')) x where x->>'id'=s->>'id' limit 1) as summary
    from unique_weeks where (log->>'week')::integer is distinct from (b->>'week')::integer
  ) select coalesce(jsonb_agg(jsonb_build_object('week',log->'week','name',log->'name','savedAt',log->'savedAt','savedAtIso',log->'savedAtIso','weekStartDateIso',log->'weekStartDateIso',
      'records',case when record is null then '[]'::jsonb else jsonb_build_array(record-'parentAccessToken'-'guardianPhone') end,
      'students',case when summary is null then '[]'::jsonb else jsonb_build_array(summary) end,'top','[]'::jsonb,'awards','[]'::jsonb) order by (log->>'week')::integer desc),'[]')
    into histories from scoped where record is not null or summary is not null;
  select coalesce(jsonb_agg(x order by ordinal),'[]') into orders from jsonb_array_elements(coalesce(b->'orders','[]')) with ordinality a(x,ordinal) where x->>'studentId'=s->>'id';
  overview:=jsonb_build_object('latest',public.noor_parent_latest(b,s,(statement_timestamp() at time zone 'Asia/Riyadh')::date),'student',s-array['parentAccessToken','guardianPhone','memorizationRecords','historicalXpCarry','historicalCoinsCarry','manualXpAdjust','manualCoinsAdjust'],'halaqa',group_row,'week',b->'week','weekName',b->'weekName','weekStartDateIso',b->'weekStartDateIso','heartPrice',coalesce(b->'heartPrice','40'::jsonb),'parentStoreOpen',coalesce(b->'parentStoreOpen','false'::jsonb));
  versions:=jsonb_build_object(
    'overview',md5(overview::text),
    'archive',md5(histories::text),'catalog',md5(coalesce(b->'products','[]')::text),'purchases',md5(orders::text));
  result:=jsonb_build_object('rev',r,'versions',versions,'topic','noor-parent:'||md5(p_token));
  if p_section='status' then return result; end if;
  if p_section='delta' then
    if p_options->>'expected' is distinct from versions->>'overview' or jsonb_typeof(p_options->'paths') is distinct from 'array' or jsonb_array_length(p_options->'paths')>60 then return result||jsonb_build_object('overview',overview);end if;
    select coalesce(jsonb_agg(jsonb_build_object('op','set','path',x,'value',overview #> array(select jsonb_array_elements_text(x)))),'[]') into filtered
      from jsonb_array_elements(p_options->'paths') x where jsonb_typeof(x)='array' and jsonb_array_length(x)>0 and jsonb_array_length(x)<30;
    return result||jsonb_build_object('delta',jsonb_build_object('base',p_options->>'base','changes',filtered));
  end if;
  if p_section<>'overview' then result:=result||jsonb_build_object('overview',overview);end if;
  if p_section='overview' then
    return result||jsonb_build_object('overview',overview);
  elsif p_section='catalog' then
    with owned as (
      select x->>'itemId' id,coalesce((x->>'qty')::integer,0) qty,coalesce((x->>'receivedQty')::integer,0) received,'physical' kind from jsonb_array_elements(coalesce(s->'bag','[]')) x where coalesce((x->>'qty')::integer,0)>0
      union all select x,1,1,'cosmetic' from jsonb_array_elements_text(coalesce(s->'inventory','[]')) x
    ) select coalesce(jsonb_agg(jsonb_build_object('itemId',o.id,'qty',o.qty,'receivedQty',o.received,'kind',o.kind,'name',purchase->'itemName','image',purchase->'itemImage')),'[]') into retired from owned o
      left join lateral (select x purchase from jsonb_array_elements(orders) x where x->>'itemId'=o.id limit 1) p on true
      where not exists(select 1 from jsonb_array_elements(coalesce(b->'products','[]')) x where x->>'id'=o.id);
    return result||jsonb_build_object('products',coalesce(b->'products','[]'),'retiredItems',retired);
  elsif p_section='calendar' then
    select coalesce(jsonb_agg(jsonb_build_object('week',x->'week','date',x->'weekStartDateIso')),'[]') into dates from jsonb_array_elements(histories) x;
    return result||jsonb_build_object('dates',dates);
  elsif p_section='statistics' then
    start_date:=nullif(p_options->>'from','')::date;end_date:=nullif(p_options->>'to','')::date;
    select coalesce(jsonb_agg(x),'[]') into filtered from jsonb_array_elements(histories) x
    where start_date is null or not pg_input_is_valid(coalesce(x->>'weekStartDateIso',''),'date') or
      ((x->>'weekStartDateIso')::date<=end_date and (x->>'weekStartDateIso')::date+3>=start_date);
    return result||jsonb_build_object('logs',filtered);
  elsif p_section in ('archive','purchases') then
    off:=greatest(0,least(100000,coalesce((p_options->>'offset')::integer,0)));lim:=greatest(1,least(20,coalesce((p_options->>'limit')::integer,5)));
    if p_section='archive' then
      select coalesce(jsonb_agg(x),'[]') into filtered from (select x from jsonb_array_elements(histories) with ordinality a(x,n) order by n offset off limit lim) q;
      return result||jsonb_build_object('logs',filtered,'more',jsonb_array_length(histories)>off+lim,'nextOffset',off+lim);
    else
      select coalesce(jsonb_agg(x),'[]') into filtered from (select x from jsonb_array_elements(orders) with ordinality a(x,n) order by n offset off limit lim) q;
      return result||jsonb_build_object('orders',filtered,'more',jsonb_array_length(orders)>off+lim,'nextOffset',off+lim);
    end if;
  end if;
  raise exception 'قسم غير معروف' using errcode='22023';
end;
$$;
revoke all on function public.noor_parent_read(text,text,jsonb) from public;
grant execute on function public.noor_parent_read(text,text,jsonb) to anon,authenticated;

-- Authoritative purchase, equip and optional access log. Only one student's record
-- and explicitly selected stock/order fields change; other fields are kept verbatim.
create or replace function public.noor_parent_action(p_token text,p_action text,p_args jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path = pg_catalog as $$
declare b jsonb; s jsonb; r bigint; idx integer; total integer; cost numeric:=0; item jsonb; line jsonb; qty integer; item_id text; products jsonb; bag jsonb; inventory jsonb; orders jsonb; new_orders jsonb:='[]'; resolved jsonb:='[]'; prior jsonb; existing jsonb; rid text; stamp text; old_catalog text; xp numeric; lvl integer:=1; required numeric; amount numeric; bi integer; pi integer; slot text; value text; result jsonb; seen text[]:='{}'; parent_log jsonb; log_index integer; initial_student jsonb; initial_overview jsonb; changed_fields jsonb;
begin
  p_token:=btrim(p_token);
  if p_token is null or length(p_token)<1 or length(p_token)>200 then raise exception 'رابط المتابعة غير صالح' using errcode='22023'; end if;
  select data,rev into b,r from public.app_state where id='noor_al_hufaz_main' for update;
  select count(*) into total from jsonb_array_elements(coalesce(b->'students','[]')) x where btrim(x->>'parentAccessToken')=p_token;
  if total<>1 then raise exception 'رابط المتابعة غير صالح أو تم تغييره' using errcode='22023'; end if;
  select x,n::integer-1 into s,idx from jsonb_array_elements(b->'students') with ordinality a(x,n) where btrim(x->>'parentAccessToken')=p_token;
  initial_student:=s;initial_overview:=public.noor_parent_read(p_token,'overview','{}');
  products:=coalesce(b->'products','[]');bag:=coalesce(s->'bag','[]');inventory:=coalesce(s->'inventory','[]');orders:=coalesce(b->'orders','[]');old_catalog:=md5(products::text);
  stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  if p_action='access' then
    select x,n::integer-1 into parent_log,log_index from jsonb_array_elements(coalesce(b->'parentLogs','[]')) with ordinality a(x,n)
      where x->>'studentId'=s->>'id' and pg_input_is_valid(coalesce(x->>'lastActiveAt',''),'timestamptz') and (x->>'lastActiveAt')::timestamptz>now()-interval '30 minutes' order by n limit 1;
    if parent_log is null then
      parent_log:=jsonb_build_object('id',md5(p_token||stamp),'studentId',s->'id','studentName',s->'name','enteredAt',stamp,'lastActiveAt',stamp,'enteredStore',coalesce((p_args->>'store')::boolean,false),'purchased',false);
      select coalesce(jsonb_agg(x),'[]') into prior from (select x from jsonb_array_elements(coalesce(b->'parentLogs','[]')) with ordinality a(x,n) order by n limit 99) q;
      b:=jsonb_set(b,'{parentLogs}',jsonb_build_array(parent_log)||prior,true);
    else
      parent_log:=parent_log||jsonb_build_object('lastActiveAt',stamp,'enteredStore',coalesce((parent_log->>'enteredStore')::boolean,false) or coalesce((p_args->>'store')::boolean,false));
      b:=jsonb_set(b,array['parentLogs',log_index::text],parent_log,true);
    end if;
  elsif p_action='equip' then
    select x into item from jsonb_array_elements(products) x where x->>'id'=p_args->>'itemId';
    if item is null or item->>'kind'<>'cosmetic' or not inventory ? (item->>'id') then raise exception 'هذه الخاصية ليست ضمن ملكيات الطالب'; end if;
    slot:=item->>'slot';value:=coalesce(item->>'value','');
    if slot not in ('frame','crown','glow','cardbg') then raise exception 'نوع خاصية غير صالح'; end if;
    s:=jsonb_set(s,array[case when slot='cardbg' then 'cardBg' else slot end],case when slot='cardbg' and value='' then 'null'::jsonb else to_jsonb(case when slot='cardbg' and value='gold' then 'yellow' when slot='cardbg' and value='mint' then 'green' when slot='cardbg' and value='coral' then 'pink' else value end) end,true);
    b:=jsonb_set(b,array['students',idx::text],s);
  elsif p_action='checkout' then
    rid:=p_args->>'requestId';
    if jsonb_typeof(p_args->'requestId') is distinct from 'string' or rid is null or length(rid)<12 or length(rid)>100 or jsonb_typeof(p_args->'lines') is distinct from 'array' or jsonb_array_length(p_args->'lines')<1 or jsonb_array_length(p_args->'lines')>20 then raise exception 'معرف العملية أو السلة غير صالح'; end if;
    for line in select x from jsonb_array_elements(p_args->'lines') x loop
      if jsonb_typeof(line->'itemId') is distinct from 'string' or jsonb_typeof(line->'qty') is distinct from 'number' or (line->>'qty')::numeric<>trunc((line->>'qty')::numeric) or (line->>'qty')::numeric<1 or (line->>'qty')::numeric>99 or coalesce(line->>'itemId','')='' then raise exception 'كمية الشراء غير صالحة'; end if;
    end loop;
    select coalesce(jsonb_agg(x),'[]') into existing from jsonb_array_elements(orders) x where x->>'requestId'=rid;
    if jsonb_array_length(existing)>0 then
      if exists(select 1 from jsonb_array_elements(existing) x where x->>'studentId' is distinct from s->>'id') or
        (select jsonb_object_agg(x->>'itemId',x->'quantity') from jsonb_array_elements(existing) x) is distinct from
        (select jsonb_object_agg(id,to_jsonb(n)) from (select x->>'itemId' as id,sum((x->>'qty')::integer)::integer n from jsonb_array_elements(p_args->'lines') x group by x->>'itemId') a) then raise exception 'معرف الشراء مستخدم لعملية مختلفة'; end if;
      return public.noor_parent_read(p_token,'overview','{}')||jsonb_build_object('success',true,'requestId',rid,'changedProducts','[]'::jsonb,'baseCatalog',old_catalog);
    end if;
    if coalesce((b->>'parentStoreOpen')::boolean,false) is not true then raise exception 'المتجر مغلق حاليًا'; end if;
    if jsonb_typeof(s->'coins') is distinct from 'number' or (s->>'coins')::numeric<0 or (s->>'coins')::numeric<>trunc((s->>'coins')::numeric) or (s->>'coins')::numeric>9007199254740991 then raise exception 'رصيد الطالب غير صالح'; end if;
    xp:=greatest(0,coalesce((s->>'xp')::numeric,0));
    while xp>=90+(lvl-1)*10 loop xp:=xp-(90+(lvl-1)*10);lvl:=lvl+1;if lvl>100000 then raise exception 'رصيد النقاط غير صالح'; end if;end loop;
    for line in select jsonb_build_object('itemId',id,'qty',quantity) from (select x->>'itemId' id,sum((x->>'qty')::integer) quantity,min(n) first_seen from jsonb_array_elements(p_args->'lines') with ordinality a(x,n) group by x->>'itemId') q order by first_seen loop
      qty:=(line->>'qty')::integer;item_id:=line->>'itemId';if qty>99 then raise exception 'كمية الشراء غير صالحة';end if;
      if item_id='__restore-heart__' then
        if jsonb_array_length(p_args->'lines')<>1 or qty<>1 or coalesce((s->>'hearts')::integer,3)>=3 then raise exception 'لا يمكن شراء قلب بهذه الحالة';end if;
        cost:=coalesce((b->>'heartPrice')::numeric,40);
        if cost<0 or cost<>trunc(cost) or cost>9007199254740991 then raise exception 'سعر القلب غير صالح';end if;
        s:=s||jsonb_build_object('hearts',least(3,(s->>'hearts')::integer+1));
        new_orders:=jsonb_build_array(jsonb_build_object('id',rid||':heart','requestId',rid,'studentId',s->'id','studentName',s->'name','itemId',item_id,'itemName','استعادة قلب','itemKind','heart','itemIcon','heart','unitPrice',cost,'quantity',1,'price',cost,'purchasedAt',stamp,'status','delivered','deliveredAt',stamp));
        exit;
      end if;
      if coalesce((s->>'hearts')::numeric,0)<=0 then raise exception 'نفدت قلوب الطالب؛ استعد قلبًا أولًا';end if;
      select x,n::integer-1 into item,pi from jsonb_array_elements(products) with ordinality a(x,n) where x->>'id'=item_id;
      if item is null then raise exception 'المنتج لم يعد متوفرًا';end if;
      amount:=(item->>'price')::numeric;
      if jsonb_typeof(item->'price') is distinct from 'number' or amount<0 or amount<>trunc(amount) or amount>9007199254740991 then raise exception 'سعر المنتج غير صالح';end if;
      if lvl<coalesce((item->>'minLevel')::integer,1) then raise exception 'المنتج يتطلب مستوى أعلى';end if;
      if jsonb_typeof(item->'stock')='number' then
        if (item->>'stock')::numeric<>trunc((item->>'stock')::numeric) or (item->>'stock')::numeric<qty or (item->>'stock')::numeric>9007199254740991 then raise exception 'الكمية المتوفرة لا تكفي أو غير صالحة';end if;
        products:=jsonb_set(products,array[pi::text,'stock'],to_jsonb((item->>'stock')::numeric-qty));
      end if;
      if item->>'kind'='cosmetic' then
        if qty<>1 or inventory ? item_id then raise exception 'الطالب يملك الخاصية أو الكمية غير صالحة';end if;
        inventory:=inventory||jsonb_build_array(item_id);slot:=item->>'slot';value:=coalesce(item->>'value','');
        if slot in ('frame','crown','glow','cardbg') then s:=jsonb_set(s,array[case when slot='cardbg' then 'cardBg' else slot end],case when slot='cardbg' and value='' then 'null'::jsonb else to_jsonb(case when slot='cardbg' and value='gold' then 'yellow' when slot='cardbg' and value='mint' then 'green' when slot='cardbg' and value='coral' then 'pink' else value end) end,true);end if;
      else
        select x,n::integer-1 into prior,bi from jsonb_array_elements(bag) with ordinality a(x,n) where x->>'itemId'=item_id;
        if prior is not null and coalesce((prior->>'qty')::integer,0)>0 and coalesce((item->>'repeatable')::boolean,false) is not true then raise exception 'تم شراء المنتج مسبقًا';end if;
        if prior is null then bag:=bag||jsonb_build_array(jsonb_build_object('itemId',item_id,'qty',qty,'receivedQty',0));else bag:=jsonb_set(bag,array[bi::text],prior||jsonb_build_object('qty',(prior->>'qty')::integer+qty));end if;
      end if;
      cost:=cost+amount*qty;if cost>9007199254740991 then raise exception 'إجمالي السعر غير صالح';end if;
      new_orders:=new_orders||jsonb_build_array((jsonb_build_object('id',rid||':'||(jsonb_array_length(new_orders)+1)::text,'requestId',rid,'studentId',s->'id','studentName',s->'name','itemId',item_id,'itemName',item->'name','itemKind',case when item->>'kind'='cosmetic' then 'cosmetic' else 'physical' end,'itemImage',item->'image','itemIcon',item->'icon','unitPrice',amount,'quantity',qty,'price',amount*qty,'purchasedAt',stamp,'status',case when item->>'kind'='cosmetic' then 'delivered' else 'pending' end,'deliveredAt',case when item->>'kind'='cosmetic' then stamp else null end) - case when item->>'kind'='cosmetic' then '__not_a_field__' else 'deliveredAt' end));
      seen:=array_append(seen,item_id);
    end loop;
    if (s->>'coins')::numeric<cost then raise exception 'رصيد العملات لا يكفي';end if;
    s:=s||jsonb_build_object('coins',(s->>'coins')::numeric-cost,'coinsSpent',coalesce((s->>'coinsSpent')::numeric,0)+cost,'inventory',inventory,'bag',bag);
    b:=jsonb_set(b,array['students',idx::text],s);b:=jsonb_set(b,'{products}',products);b:=jsonb_set(b,'{orders}',new_orders||orders);
    select x,n::integer-1 into parent_log,log_index from jsonb_array_elements(coalesce(b->'parentLogs','[]')) with ordinality a(x,n)
      where x->>'studentId'=s->>'id' and pg_input_is_valid(coalesce(x->>'lastActiveAt',''),'timestamptz') and (x->>'lastActiveAt')::timestamptz>now()-interval '30 minutes' order by n limit 1;
    if parent_log is null then
      parent_log:=jsonb_build_object('id',md5(rid||stamp),'studentId',s->'id','studentName',s->'name','enteredAt',stamp,'lastActiveAt',stamp,'enteredStore',true,'purchased',true);
      select coalesce(jsonb_agg(x),'[]') into prior from (select x from jsonb_array_elements(coalesce(b->'parentLogs','[]')) with ordinality a(x,n) order by n limit 99) q;
      b:=jsonb_set(b,'{parentLogs}',jsonb_build_array(parent_log)||prior,true);
    else
      parent_log:=parent_log||jsonb_build_object('lastActiveAt',stamp,'enteredStore',true,'purchased',true);
      b:=jsonb_set(b,array['parentLogs',log_index::text],parent_log,true);
    end if;

  else raise exception 'عملية غير مسموحة';end if;
  update public.app_state set data=b,rev=r+1,updated_at=now() where id='noor_al_hufaz_main';
  result:=public.noor_parent_read(p_token,'overview','{}');
  select coalesce(jsonb_agg(jsonb_build_object('id',x->'id')||case when x ? 'stock' then jsonb_build_object('stock',x->'stock') else '{}'::jsonb end),'[]') into prior from jsonb_array_elements(products) x where x->>'id'=any(seen);
  if p_action='checkout' and p_args->>'expected' = initial_overview->'versions'->>'overview' then
    select coalesce(jsonb_agg(jsonb_build_object('op','set','path',jsonb_build_array('student',key),'value',s->key)),'[]') into changed_fields
      from unnest(array['coins','coinsSpent','hearts','inventory','bag','frame','crown','glow','cardBg']) key where s->key is distinct from initial_student->key;
    result:=(result-'overview')||jsonb_build_object('delta',jsonb_build_object('base',initial_overview->'versions'->>'overview','changes',changed_fields));
  end if;
  return result||jsonb_build_object('success',true,'requestId',rid,'changedProducts',prior,'baseCatalog',old_catalog,'totalCost',cost);
end;
$$;
revoke all on function public.noor_parent_action(text,text,jsonb) from public;
grant execute on function public.noor_parent_action(text,text,jsonb) to anon,authenticated;

-- Parent notifications contain no student records, no photos, and no raw tokens.
-- Existing teacher broadcasts and data are not modified by this trigger.
create or replace function noor_internal.notify_parent_version()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare old_student jsonb; new_student jsonb; token text; global_change boolean; old_group jsonb; new_group jsonb; previous jsonb; following jsonb; delta jsonb; paths jsonb; root_change boolean; archive_change boolean; catalog_change boolean; previous_latest jsonb; following_latest jsonb;
begin
  if new.id<>'noor_al_hufaz_main' then return new;end if;
  catalog_change:=new.data->'products' is distinct from old.data->'products';archive_change:=new.data->'weeksLog' is distinct from old.data->'weeksLog';
  root_change:=(new.data->'week',new.data->'weekStartDateIso',new.data->'weekName',new.data->'halaqas',new.data->'heartPrice',new.data->'parentStoreOpen') is distinct from (old.data->'week',old.data->'weekStartDateIso',old.data->'weekName',old.data->'halaqas',old.data->'heartPrice',old.data->'parentStoreOpen');
  global_change:=(new.data->'week',new.data->'weekStartDateIso',new.data->'weekName',new.data->'weeksLog',new.data->'products',new.data->'halaqas',new.data->'heartPrice',new.data->'parentStoreOpen') is distinct from (old.data->'week',old.data->'weekStartDateIso',old.data->'weekName',old.data->'weeksLog',old.data->'products',old.data->'halaqas',old.data->'heartPrice',old.data->'parentStoreOpen');
  if not global_change and new.data->'students' is not distinct from old.data->'students' then return new;end if;
  for token in select distinct btrim(x->>'parentAccessToken') from jsonb_array_elements(coalesce(old.data->'students','[]')||coalesce(new.data->'students','[]')) x where length(btrim(coalesce(x->>'parentAccessToken','')))>=1 loop
    select x into new_student from jsonb_array_elements(coalesce(new.data->'students','[]')) x where btrim(x->>'parentAccessToken')=token;
    select x into old_student from jsonb_array_elements(coalesce(old.data->'students','[]')) x where btrim(x->>'parentAccessToken')=token;
    if global_change or new_student is distinct from old_student then
      if catalog_change and not root_change and not archive_change and new_student is not distinct from old_student then perform realtime.send(jsonb_build_object('rev',new.rev,'catalog',true),'version','noor-parent:'||md5(token),false);continue;end if;
      previous_latest:=public.noor_parent_latest(old.data,old_student,(statement_timestamp() at time zone 'Asia/Riyadh')::date);
      following_latest:=case when not archive_change and (old_student->'days',old_student->'ward',old_student->'recitationRatings',old.data->'weekStartDateIso') is not distinct from (new_student->'days',new_student->'ward',new_student->'recitationRatings',new.data->'weekStartDateIso') then previous_latest else public.noor_parent_latest(new.data,new_student,(statement_timestamp() at time zone 'Asia/Riyadh')::date) end;
      select jsonb_build_object('id',x->'id','name',x->'name') into old_group from jsonb_array_elements(coalesce(old.data->'halaqas','[]')) x where x->>'id'=old_student->>'halaqaId';
      select jsonb_build_object('id',x->'id','name',x->'name') into new_group from jsonb_array_elements(coalesce(new.data->'halaqas','[]')) x where x->>'id'=new_student->>'halaqaId';
      previous:=jsonb_build_object('latest',previous_latest,'student',old_student-array['parentAccessToken','guardianPhone','memorizationRecords','historicalXpCarry','historicalCoinsCarry','manualXpAdjust','manualCoinsAdjust'],'halaqa',old_group,'week',old.data->'week','weekName',old.data->'weekName','weekStartDateIso',old.data->'weekStartDateIso','heartPrice',coalesce(old.data->'heartPrice','40'::jsonb),'parentStoreOpen',coalesce(old.data->'parentStoreOpen','false'::jsonb));
      following:=jsonb_build_object('latest',following_latest,'student',new_student-array['parentAccessToken','guardianPhone','memorizationRecords','historicalXpCarry','historicalCoinsCarry','manualXpAdjust','manualCoinsAdjust'],'halaqa',new_group,'week',new.data->'week','weekName',new.data->'weekName','weekStartDateIso',new.data->'weekStartDateIso','heartPrice',coalesce(new.data->'heartPrice','40'::jsonb),'parentStoreOpen',coalesce(new.data->'parentStoreOpen','false'::jsonb));
      delta:=noor_internal.json_delta(previous,following);
      paths:=null;
      if jsonb_array_length(delta)<=60 and not exists(select 1 from jsonb_array_elements(delta) x where x->>'op'<>'set') then select coalesce(jsonb_agg(x->'path'),'[]') into paths from jsonb_array_elements(delta) x;end if;
      -- Paths/hashes only. Actual values are fetched through the token-checked RPC.
      perform realtime.send(jsonb_build_object('rev',new.rev,'base',md5(previous::text),'next',md5(following::text),'paths',paths,'catalog',new.data->'products' is distinct from old.data->'products','archive',new.data->'weeksLog' is distinct from old.data->'weeksLog'),'version','noor-parent:'||md5(token),false);
    end if;
  end loop;
  return new;
exception when others then
  raise warning 'Parent notification unavailable: %',SQLSTATE;return new;
end;
$$;
revoke all on function noor_internal.notify_parent_version() from public,anon,authenticated;
drop trigger if exists noor_parent_version on public.app_state;
create trigger noor_parent_version after update on public.app_state for each row execute function noor_internal.notify_parent_version();

COMMIT;
