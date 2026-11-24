-- Additional cash is accepted after check-in regardless of the booking channel.
create or replace function staytrack.guard_stay_receipt() returns trigger
language plpgsql set search_path='' as $$
begin
  select b.reservation_id into new.reservation_id
  from staytrack.room_bookings b where b.id=new.room_booking_id;
  if not exists(
    select 1 from staytrack.room_check_ins where room_booking_id=new.room_booking_id
  ) or new.received_at>clock_timestamp() or not isfinite(new.received_at) then
    raise exception 'Verified supported receipt required';
  end if;
  return new;
end; $$;
