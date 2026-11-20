-- H01 candidate only. Separate approval is required before hosted application.
-- Keep physical readiness separate from immutable checkout turnover blocks.
create table staytrack.housekeeping_events (
  id bigint generated always as identity primary key,
  checkout_id uuid not null references staytrack.room_checkouts(room_booking_id),
  room_id bigint not null references staytrack.rooms(id),
  action text not null check (action in ('start','finish','ready')),
  actor_auth_user_id uuid not null,
  request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  checks_confirmed boolean not null default false,
  occurred_at timestamptz not null default clock_timestamp(),
  check (checks_confirmed = (action='ready')),
  unique (checkout_id,action),
  unique (actor_auth_user_id,request_key)
);
alter table staytrack.housekeeping_events enable row level security;
revoke all on staytrack.housekeeping_events from public,anon,authenticated;
revoke all on sequence staytrack.housekeeping_events_id_seq from public,anon,authenticated;
create trigger housekeeping_immutable before update or delete on staytrack.housekeeping_events
  for each row execute function staytrack.protect_payment_review_history();

create function staytrack.guard_housekeeping_event() returns trigger
language plpgsql set search_path='' as $$
declare category bigint; room_state text; latest uuid; previous text;
begin
  perform 1 from staytrack.staff_accounts where auth_user_id=new.actor_auth_user_id and active for share;
  if not found then raise exception 'Active staff required'; end if;
  select category_id into category from staytrack.rooms where id=new.room_id;
  if not found then raise exception 'Unknown room'; end if;
  perform pg_advisory_xact_lock(category);
  lock table staytrack.room_blocks in share mode;
  select operational_state into room_state from staytrack.rooms where id=new.room_id and active for update;
  if not found or room_state<>'cleaning' then raise exception 'Room must require cleaning'; end if;
  select o.room_booking_id into latest from staytrack.room_checkouts o
    join staytrack.room_check_ins i on i.room_booking_id=o.room_booking_id
    where i.room_id=new.room_id order by o.checked_out_at desc,o.room_booking_id desc limit 1;
  if latest is distinct from new.checkout_id then raise exception 'Checkout changed; refresh room board'; end if;
  if exists(select 1 from staytrack.room_check_ins i where i.room_id=new.room_id
    and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=i.room_booking_id))
    then raise exception 'An occupied stay requires reconciliation'; end if;
  new.occurred_at := clock_timestamp();
  if exists(select 1 from staytrack.room_blocks b where b.room_id=new.room_id
    and tstzrange(b.start_at,b.end_at,'[)') @> new.occurred_at
    and not exists(select 1 from staytrack.room_checkouts o where o.cleaning_block_id=b.id))
    then raise exception 'Maintenance blocks housekeeping'; end if;
  select action into previous from staytrack.housekeeping_events where checkout_id=new.checkout_id
    order by case action when 'ready' then 3 when 'finish' then 2 else 1 end desc limit 1;
  if (new.action='start' and previous is not null)
    or (new.action='finish' and previous is distinct from 'start')
    or (new.action='ready' and previous is distinct from 'finish')
    then raise exception 'Invalid housekeeping transition'; end if;
  return new;
end; $$;
revoke all on function staytrack.guard_housekeeping_event() from public,anon,authenticated;
create trigger housekeeping_guard before insert on staytrack.housekeeping_events
  for each row execute function staytrack.guard_housekeeping_event();

create function staytrack.apply_housekeeping_event() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.action='ready' then
    update staytrack.rooms set operational_state='ready' where id=new.room_id;
  end if;
  insert into staytrack.staff_audit(actor_auth_user_id,action,occurred_at)
    values(new.actor_auth_user_id,'room.housekeeping.' || new.action,new.occurred_at);
  return new;
end; $$;
revoke all on function staytrack.apply_housekeeping_event() from public,anon,authenticated;
create trigger housekeeping_applied after insert on staytrack.housekeeping_events
  for each row execute function staytrack.apply_housekeeping_event();

create function staytrack.guard_physical_readiness() returns trigger
language plpgsql set search_path='' as $$
declare latest uuid;
begin
  if new.operational_state=old.operational_state then return new; end if;
  if new.operational_state='occupied' then
    if old.operational_state<>'ready' or not new.active then raise exception 'A Ready active room is required'; end if;
    if exists(select 1 from staytrack.room_blocks b where b.room_id=new.id
      and tstzrange(b.start_at,b.end_at,'[)') @> clock_timestamp())
      then raise exception 'Room turnover or maintenance is still protected'; end if;
  end if;
  if new.operational_state in ('ready','occupied') then
    select o.room_booking_id into latest from staytrack.room_checkouts o
      join staytrack.room_check_ins i on i.room_booking_id=o.room_booking_id
      where i.room_id=new.id order by o.checked_out_at desc,o.room_booking_id desc limit 1;
    if latest is not null and not exists(select 1 from staytrack.housekeeping_events e
      where e.checkout_id=latest and e.action='ready')
      then raise exception 'Explicit housekeeping Ready is required'; end if;
    if exists(select 1 from staytrack.room_check_ins i where i.room_id=new.id
      and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=i.room_booking_id))
      then raise exception 'An occupied stay requires reconciliation'; end if;
  end if;
  return new;
end; $$;
revoke all on function staytrack.guard_physical_readiness() from public,anon,authenticated;
create trigger physical_readiness_guard before update of operational_state on staytrack.rooms
  for each row execute function staytrack.guard_physical_readiness();
