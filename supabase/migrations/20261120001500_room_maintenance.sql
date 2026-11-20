-- H02 candidate. Hosted application requires separate authorization.
create table staytrack.maintenance_events (
  id bigint generated always as identity primary key,
  block_id bigint not null references staytrack.room_blocks(id),
  action text not null check (action in ('open','progress','clear')),
  note text not null check (length(btrim(note)) between 1 and 1000),
  restore_ready boolean not null check (not restore_ready or action='clear'),
  prior_state text check (prior_state in ('ready','cleaning','unverified')),
  check ((prior_state is not null) = (action='open')),
  actor_auth_user_id uuid not null,
  request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  occurred_at timestamptz not null,
  unique(actor_auth_user_id,request_key)
);
create index maintenance_events_block on staytrack.maintenance_events(block_id,id);
create unique index maintenance_terminal_actions on staytrack.maintenance_events(block_id,action)
  where action in ('open','clear');
alter table staytrack.maintenance_events enable row level security;
revoke all on staytrack.maintenance_events,staytrack.maintenance_events_id_seq from public,anon,authenticated;
create trigger maintenance_immutable before update or delete on staytrack.maintenance_events
  for each row execute function staytrack.protect_payment_review_history();

create function staytrack.record_maintenance(
  p_actor uuid,p_room bigint,p_action text,p_block bigint,p_note text,p_key text,p_ready boolean
) returns staytrack.maintenance_events language plpgsql set search_path='' as $$
declare
  v_category bigint;
  v_room staytrack.rooms;
  v_block staytrack.room_blocks;
  v_prior staytrack.maintenance_events;
  v_open staytrack.maintenance_events;
  v_checkout uuid;
  v_now timestamptz;
  v_state text;
begin
  if p_action is null or p_action not in ('open','progress','clear')
    or (p_block is null) <> (p_action='open')
    or p_note is null or length(btrim(p_note)) not between 1 and 1000
    or p_key is null or p_key !~ '^[A-Za-z0-9_-]{16,100}$'
    or p_ready is null or (p_ready and p_action<>'clear')
  then raise exception 'Invalid maintenance request' using errcode='22023'; end if;

  perform 1 from staytrack.staff_accounts where auth_user_id=p_actor and active for share;
  if not found then raise exception 'Active staff required' using errcode='42501'; end if;
  select category_id into v_category from staytrack.rooms where id=p_room;
  if not found then raise exception 'Room not found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(v_category);
  lock table staytrack.room_blocks in share row exclusive mode;
  select * into v_room from staytrack.rooms where id=p_room for update;
  select * into v_prior from staytrack.maintenance_events where actor_auth_user_id=p_actor and request_key=p_key;
  if found then
    if v_prior.action=p_action and v_prior.note=btrim(p_note) and v_prior.restore_ready=p_ready
      and (p_block is null or v_prior.block_id=p_block)
      and exists(select 1 from staytrack.room_blocks where id=v_prior.block_id and room_id=p_room)
    then return v_prior; end if;
    raise exception 'Maintenance retry key is already in use';
  end if;

  v_now := clock_timestamp();
  if p_action='open' then
    if not v_room.active or v_room.operational_state not in ('ready','cleaning','unverified')
      or exists(select 1 from staytrack.room_check_ins i where i.room_id=p_room
        and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=i.room_booking_id))
    then raise exception 'Resolve the occupied or unavailable room before opening maintenance'; end if;
    if exists(select 1 from staytrack.room_blocks b where b.room_id=p_room
      and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(v_now,null,'[)')
      and not exists(select 1 from staytrack.room_checkouts o where o.cleaning_block_id=b.id))
    then raise exception 'Existing maintenance block requires review'; end if;
    insert into staytrack.room_blocks(room_id,start_at,reason)
      values(p_room,v_now,btrim(p_note)) returning * into v_block;
    update staytrack.rooms set operational_state='maintenance' where id=p_room;
  else
    select * into v_block from staytrack.room_blocks where id=p_block and room_id=p_room and end_at is null;
    if not found or v_room.operational_state<>'maintenance' then raise exception 'Maintenance is no longer active'; end if;
    select * into v_open from staytrack.maintenance_events where block_id=p_block and action='open';
    if not found then raise exception 'Maintenance opening is missing'; end if;
    if p_action='clear' then
      select o.room_booking_id into v_checkout from staytrack.room_checkouts o
        join staytrack.room_check_ins i on i.room_booking_id=o.room_booking_id
        where i.room_id=p_room order by o.checked_out_at desc,o.room_booking_id desc limit 1;
      v_state := 'unverified';
      if (v_checkout is not null and not exists(select 1 from staytrack.housekeeping_events e
        where e.checkout_id=v_checkout and e.action='ready')) or (v_checkout is not null and v_open.prior_state='cleaning')
      then v_state := 'cleaning'; end if;
      if v_state<>'cleaning' and v_open.prior_state='ready' and not p_ready
      then raise exception 'Explicit Ready confirmation is required to return this room to service'; end if;
      if p_ready then
        if v_state='cleaning' or v_open.prior_state<>'ready' or not v_room.active
          or exists(select 1 from staytrack.room_blocks b where b.room_id=p_room and b.id<>p_block
            and tstzrange(b.start_at,b.end_at,'[)') @> v_now)
        then raise exception 'Ready requires completed housekeeping and expired turnover protection'; end if;
        v_state := 'ready';
      end if;
      v_now := greatest(v_now,v_block.start_at+interval '1 microsecond');
      update staytrack.room_blocks set end_at=v_now where id=v_block.id;
      update staytrack.rooms set operational_state=v_state where id=p_room;
    end if;
  end if;

  insert into staytrack.maintenance_events(block_id,action,note,restore_ready,prior_state,actor_auth_user_id,request_key,occurred_at)
    values(v_block.id,p_action,btrim(p_note),p_ready,
      case when p_action='open' then v_room.operational_state end,p_actor,p_key,v_now)
    returning * into v_prior;
  insert into staytrack.staff_audit(actor_auth_user_id,action,occurred_at)
    values(p_actor,'room.maintenance.'||p_action,v_now);
  return v_prior;
end $$;
revoke all on function staytrack.record_maintenance(uuid,bigint,text,bigint,text,text,boolean)
  from public,anon,authenticated;
