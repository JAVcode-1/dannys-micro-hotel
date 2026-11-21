-- Isolated development candidate only; hosted application requires separate approval.
create table staytrack.early_check_in_approvals (
  room_booking_id uuid primary key references staytrack.room_bookings(id),
  actor_auth_user_id uuid not null,
  request_key text not null,
  reason text not null check(length(trim(reason)) between 1 and 1000),
  original_start_at timestamptz not null, original_end_at timestamptz not null,
  start_at timestamptz not null, end_at timestamptz not null,
  occurred_at timestamptz not null default clock_timestamp(),
  check(start_at<original_start_at and end_at-start_at=original_end_at-original_start_at),
  unique(actor_auth_user_id,request_key)
);
create table staytrack.room_inspections (
  id bigint generated always as identity primary key,
  room_id bigint not null references staytrack.rooms(id),
  actor_auth_user_id uuid not null,
  request_key text not null,
  note text not null check(length(trim(note)) between 1 and 1000),
  occurred_at timestamptz not null default clock_timestamp(),
  unique(actor_auth_user_id,request_key)
);
create table staytrack.accommodation_no_show_reviews (
  id bigint generated always as identity primary key,
  room_booking_id uuid not null references staytrack.room_bookings(id),
  actor_auth_user_id uuid not null,
  request_key text not null,
  decision text not null check(decision in ('no_show','expected')),
  note text not null check(length(trim(note)) between 1 and 1000),
  occurred_at timestamptz not null default clock_timestamp(),
  unique(actor_auth_user_id,request_key)
);
do $$ declare t text; begin
  foreach t in array array['early_check_in_approvals','room_inspections','accommodation_no_show_reviews'] loop
    execute format('alter table staytrack.%I enable row level security',t);
    execute format('revoke all on staytrack.%I from public,anon,authenticated',t);
    execute format('create trigger immutable before update or delete on staytrack.%I for each row execute function staytrack.protect_payment_review_history()',t);
  end loop;
end $$;
revoke all on sequence staytrack.room_inspections_id_seq,staytrack.accommodation_no_show_reviews_id_seq from public,anon,authenticated;

-- This is a current physical inspection, never a fabricated historical cleaning event.
create function staytrack.inspect_legacy_room(actor uuid, room bigint, key text, note text) returns staytrack.room_inspections
language plpgsql set search_path='' as $$
declare category bigint; result staytrack.room_inspections;
begin
  perform 1 from staytrack.staff_accounts where auth_user_id=actor and active for share;
  if not found then raise exception 'Active staff required' using errcode='42501'; end if;
  if key !~ '^[A-Za-z0-9_-]{16,100}$' or note is null or length(trim(note)) not between 1 and 1000 then
    raise exception 'Inspection note and retry key required' using errcode='22023'; end if;
  select category_id into category from staytrack.rooms where id=room;
  if not found then raise exception 'Room not found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(category);
  lock table staytrack.room_blocks in share mode;
  perform 1 from staytrack.rooms where id=room for update;
  select * into result from staytrack.room_inspections where actor_auth_user_id=actor and request_key=key;
  if found then
    if result.room_id<>room or result.note<>trim(note) then raise exception 'Retry conflict'; end if;
    return result;
  end if;
  if exists(select 1 from staytrack.room_check_ins s where room_id=room and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=s.room_booking_id))
    or exists(select 1 from staytrack.room_blocks where room_id=room and tstzrange(start_at,end_at,'[)') @> clock_timestamp())
    or exists(select 1 from staytrack.rooms where id=room and operational_state not in ('unverified','ready','cleaning'))
    then raise exception 'Current inspection requires no open stay, maintenance or occupancy'; end if;
  insert into staytrack.room_inspections(room_id,actor_auth_user_id,request_key,note) values(room,actor,key,trim(note)) returning * into result;
  update staytrack.rooms set operational_state='ready' where id=room;
  insert into staytrack.staff_audit(actor_auth_user_id,action) values(actor,'room.legacy_inspected');
  return result;
end $$;
revoke all on function staytrack.inspect_legacy_room(uuid,bigint,text,text) from public,anon,authenticated;

create function staytrack.room_is_physically_ready(room bigint) returns boolean language sql stable set search_path='' as $$
  select exists(select 1 from staytrack.rooms r where r.id=room and r.active and r.operational_state='ready'
    and not exists(select 1 from staytrack.room_check_ins s where s.room_id=room
      and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=s.room_booking_id))
    and not exists(select 1 from staytrack.room_blocks b where b.room_id=room and tstzrange(b.start_at,b.end_at,'[)') @> statement_timestamp())
    and (exists(select 1 from staytrack.room_inspections e where e.room_id=room and not exists(select 1 from staytrack.room_checkouts o join staytrack.room_check_ins s on s.room_booking_id=o.room_booking_id where s.room_id=room and o.checked_out_at>=e.occurred_at))
      or exists(select 1 from staytrack.room_checkouts o join staytrack.room_check_ins s on s.room_booking_id=o.room_booking_id
        where s.room_id=room and exists(select 1 from staytrack.housekeeping_events e where e.checkout_id=o.room_booking_id and e.action='ready')
        and not exists(select 1 from staytrack.room_checkouts newer join staytrack.room_check_ins ns on ns.room_booking_id=newer.room_booking_id
          where ns.room_id=room and (newer.checked_out_at,newer.room_booking_id)>(o.checked_out_at,o.room_booking_id)))))
$$;
revoke all on function staytrack.room_is_physically_ready(bigint) from public,anon,authenticated;

create or replace function staytrack.guard_physical_readiness() returns trigger
language plpgsql set search_path='' as $$
declare latest uuid; departure timestamptz;
begin
  if new.operational_state=old.operational_state then return new; end if;
  if new.operational_state='occupied' then
    if old.operational_state<>'ready' or not new.active then raise exception 'A Ready active room is required'; end if;
    if exists(select 1 from staytrack.room_blocks b where b.room_id=new.id and tstzrange(b.start_at,b.end_at,'[)') @> clock_timestamp())
      then raise exception 'Room turnover or maintenance is still protected'; end if;
  end if;
  if new.operational_state in ('ready','occupied') then
    select o.room_booking_id,o.checked_out_at into latest,departure from staytrack.room_checkouts o
      join staytrack.room_check_ins i on i.room_booking_id=o.room_booking_id where i.room_id=new.id order by o.checked_out_at desc,o.room_booking_id desc limit 1;
    if latest is not null and not exists(select 1 from staytrack.housekeeping_events e where e.checkout_id=latest and e.action='ready')
      and not exists(select 1 from staytrack.room_inspections e where e.room_id=new.id and e.occurred_at>departure)
      then raise exception 'Explicit housekeeping Ready or current inspection is required'; end if;
    if exists(select 1 from staytrack.room_check_ins i where i.room_id=new.id and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=i.room_booking_id))
      then raise exception 'An occupied stay requires reconciliation'; end if;
  end if;
  return new;
end $$;

create function staytrack.guard_no_show_review() returns trigger language plpgsql set search_path='' as $$
begin
  perform 1 from staytrack.staff_accounts where auth_user_id=new.actor_auth_user_id and active for share;
  if not found then raise exception 'Active staff required' using errcode='42501'; end if;
  perform 1 from staytrack.reservations r join staytrack.room_bookings b on b.reservation_id=r.id
    join staytrack.inventory_claims i on i.id=b.claim_id
    where b.id=new.room_booking_id and r.channel='online' and b.status='confirmed' and i.state='confirmed'
      and clock_timestamp()>=b.start_at+interval '1 hour' for update of r,b,i;
  if not found or exists(select 1 from staytrack.room_check_ins where room_booking_id=new.room_booking_id)
    then raise exception 'Only unarrived confirmed online stays after the grace period can be reviewed'; end if;
  new.occurred_at=clock_timestamp();
  insert into staytrack.staff_audit(actor_auth_user_id,action) values(new.actor_auth_user_id,'room.no_show.'||new.decision);
  return new;
end $$;
create trigger no_show_guard before insert on staytrack.accommodation_no_show_reviews for each row execute function staytrack.guard_no_show_review();
revoke all on function staytrack.guard_no_show_review() from public,anon,authenticated;

create table staytrack.room_reassignments (
 id bigint generated always as identity primary key,
 room_booking_id uuid not null references staytrack.room_bookings(id),
 old_room_id bigint not null references staytrack.rooms(id), new_room_id bigint not null references staytrack.rooms(id),
 actor_auth_user_id uuid not null, request_key text not null,
 note text not null check(length(trim(note)) between 1 and 1000),
 start_at timestamptz not null,end_at timestamptz not null,
 occurred_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_user_id,request_key),check(old_room_id<>new_room_id)
);
alter table staytrack.room_reassignments enable row level security;
revoke all on staytrack.room_reassignments from public,anon,authenticated;
revoke all on sequence staytrack.room_reassignments_id_seq from public,anon,authenticated;
create trigger immutable before update or delete on staytrack.room_reassignments for each row execute function staytrack.protect_payment_review_history();

create or replace function staytrack.guard_reschedule_claim_projection() returns trigger language plpgsql set search_path='' as $$
declare b staytrack.room_bookings;
begin
 if (new.start_at,new.end_at,new.room_id,new.buffer_minutes) is not distinct from (old.start_at,old.end_at,old.room_id,old.buffer_minutes) then return null; end if;
 select * into b from staytrack.room_bookings where claim_id=new.id;
 if not found then return null; end if;
 if exists(select 1 from staytrack.room_check_ins s where s.room_booking_id=b.id and s.room_id=new.room_id
   and (s.checked_in_at=new.start_at or (b.start_at=new.start_at and b.start_at<=s.checked_in_at))
   and s.checkout_at=new.end_at and new.buffered_end_at=new.end_at+new.buffer_minutes*interval '1 minute') then return null; end if;
 if exists(select 1 from staytrack.reschedule_decisions d where d.room_booking_id=b.id and d.approved
  and d.new_revision=b.schedule_revision and d.old_room_id=old.room_id and d.new_room_id=new.room_id
  and d.old_start_at=old.start_at and d.old_end_at=old.end_at and d.new_start_at=new.start_at and d.new_end_at=new.end_at
  and b.start_at=new.start_at and b.end_at=new.end_at and new.buffer_minutes=old.buffer_minutes
  and new.buffered_end_at=new.end_at+new.buffer_minutes*interval '1 minute') then return null; end if;
 if new.end_at>old.end_at and new.buffered_end_at=new.end_at+old.buffer_minutes*interval '1 minute'
  and (to_jsonb(new)-'end_at'-'buffered_end_at')=(to_jsonb(old)-'end_at'-'buffered_end_at')
  and exists(select 1 from staytrack.room_bookings rb join staytrack.stay_extension_requests q on q.room_booking_id=rb.id join staytrack.stay_extension_decisions d on d.request_id=q.id where rb.claim_id=old.id and d.approved and q.old_end=old.end_at and q.new_end=new.end_at and rb.stay_extension_revision=q.expected_revision+1) then return null; end if;
 if new.start_at=old.start_at and new.end_at=old.end_at and new.buffer_minutes=old.buffer_minutes and new.buffered_end_at=old.buffered_end_at
  and not exists(select 1 from staytrack.room_check_ins where room_booking_id=b.id)
  and exists(select 1 from staytrack.room_reassignments e where e.room_booking_id=b.id and e.old_room_id=old.room_id
    and e.new_room_id=new.room_id and e.start_at=new.start_at and e.end_at=new.end_at) then return null; end if;
 raise exception 'Approved schedule event, recorded check-in or maintenance reassignment required';
end $$;

create table staytrack.room_administration_events (
 id bigint generated always as identity primary key, room_id bigint not null references staytrack.rooms(id),
 actor_auth_user_id uuid not null, request_key text not null,
 old_code text not null,new_code text not null,old_active boolean not null,new_active boolean not null,
 note text not null check(length(trim(note)) between 1 and 1000),occurred_at timestamptz not null default clock_timestamp(),
 unique(actor_auth_user_id,request_key)
);
alter table staytrack.room_administration_events enable row level security;
revoke all on staytrack.room_administration_events from public,anon,authenticated;
revoke all on sequence staytrack.room_administration_events_id_seq from public,anon,authenticated;
create trigger immutable before update or delete on staytrack.room_administration_events for each row execute function staytrack.protect_payment_review_history();
