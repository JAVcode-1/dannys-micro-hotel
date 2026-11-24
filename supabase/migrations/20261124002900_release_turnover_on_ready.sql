-- Keep the original turnover deadline while allowing explicit Ready to end the block early.
alter table staytrack.room_blocks
  add column planned_turnover_end_at timestamptz,
  add constraint room_blocks_turnover_end_check
    check (planned_turnover_end_at is null or
      (end_at is not null and end_at < planned_turnover_end_at));

create or replace function staytrack.protect_checkout_buffer() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from staytrack.room_checkouts where cleaning_block_id=old.id) then
    if tg_op='UPDATE' then
      if old.planned_turnover_end_at is null
        and new.planned_turnover_end_at=old.end_at
        and new.end_at<old.end_at
        and (new.id,new.room_id,new.start_at,new.reason) is not distinct from
          (old.id,old.room_id,old.start_at,old.reason)
        and exists(
          select 1 from staytrack.room_checkouts o
          join staytrack.housekeeping_events e on e.checkout_id=o.room_booking_id
          where o.cleaning_block_id=old.id and e.room_id=old.room_id
            and e.action='ready' and e.checks_confirmed
            and new.end_at=greatest(e.occurred_at,old.start_at+interval '1 microsecond')
        )
        then return new;
      end if;
    end if;
    raise exception 'Checkout cleaning buffer is protected';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;

create or replace function staytrack.guard_housekeeping_event() returns trigger
language plpgsql set search_path='' as $$
declare category bigint; room_state text; latest uuid; previous text;
begin
  perform 1 from staytrack.staff_accounts where auth_user_id=new.actor_auth_user_id and active for share;
  if not found then raise exception 'Active staff required'; end if;
  select category_id into category from staytrack.rooms where id=new.room_id;
  if not found then raise exception 'Unknown room'; end if;
  perform pg_advisory_xact_lock(category);
  if new.action='ready' then
    lock table staytrack.room_blocks in share row exclusive mode;
  else
    lock table staytrack.room_blocks in share mode;
  end if;
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

create or replace function staytrack.apply_housekeeping_event() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.action='ready' then
    update staytrack.room_blocks b
    set planned_turnover_end_at=b.end_at,
      end_at=greatest(new.occurred_at,b.start_at+interval '1 microsecond')
    from staytrack.room_checkouts o
    where o.room_booking_id=new.checkout_id
      and b.id=o.cleaning_block_id and b.room_id=new.room_id
      and b.planned_turnover_end_at is null
      and b.end_at>greatest(new.occurred_at,b.start_at+interval '1 microsecond');
    update staytrack.rooms set operational_state='ready' where id=new.room_id;
  end if;
  insert into staytrack.staff_audit(actor_auth_user_id,action,occurred_at)
    values(new.actor_auth_user_id,'room.housekeeping.' || new.action,new.occurred_at);
  return new;
end; $$;

create or replace function staytrack.guard_extended_room_block() returns trigger language plpgsql set search_path='' as $$
declare category bigint; begin
  if tg_op='UPDATE' then
    -- Shortening this block cannot create a new overlap with a purchased extension.
    if new.room_id=old.room_id and new.start_at=old.start_at
      and new.planned_turnover_end_at=old.end_at and new.end_at<old.end_at
      then return null; end if;
  end if;
 select category_id into category from staytrack.rooms where id=new.room_id; perform pg_advisory_xact_lock(category);
 if exists(select 1 from staytrack.stay_extension_requests q join staytrack.stay_extension_decisions d on d.request_id=q.id join staytrack.room_bookings b on b.id=q.room_booking_id join staytrack.inventory_claims c on c.id=b.claim_id
 where d.approved and c.state not in ('released','expired') and c.room_id=new.room_id and tstzrange(new.start_at,new.end_at,'[)') && tstzrange(q.old_end,q.new_end+c.buffer_minutes*interval '1 minute','[)')) then raise exception 'Maintenance conflicts with purchased extension'; end if; return null;
end $$;

-- Release outstanding turnover blocks whose staff Ready confirmation is already recorded.
update staytrack.room_blocks b
set planned_turnover_end_at=b.end_at,
  end_at=greatest(e.occurred_at,b.start_at+interval '1 microsecond')
from staytrack.room_checkouts o
join staytrack.housekeeping_events e on e.checkout_id=o.room_booking_id
where b.id=o.cleaning_block_id and e.room_id=b.room_id
  and e.action='ready' and e.checks_confirmed
  and b.end_at>statement_timestamp()
  and b.end_at>greatest(e.occurred_at,b.start_at+interval '1 microsecond');
