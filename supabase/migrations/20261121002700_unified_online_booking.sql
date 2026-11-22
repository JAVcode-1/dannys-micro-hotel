-- Additive candidate. Local disposable databases only until separately approved.
alter table staytrack.hall_reservations drop constraint hall_reservations_channel_check;
alter table staytrack.hall_reservations add constraint hall_reservations_channel_check
  check(channel in ('walk_in','telephone','messenger','online'));
create table staytrack.online_hall_items (
  reservation_id uuid primary key references staytrack.reservations,
  hall_reservation_id uuid not null unique references staytrack.hall_reservations,
  original_centavos bigint not null check(original_centavos>=300000),
  proof_deadline_at timestamptz not null,
  state text not null default 'held' check(state in ('held','proof_pending_review','confirmed','expired','released')),
  proof_submitted_at timestamptz,
  check(state<>'proof_pending_review' or proof_submitted_at is not null)
);
create trigger online_hall_price_immutable before update of reservation_id,hall_reservation_id,original_centavos,proof_deadline_at
  on staytrack.online_hall_items for each row execute function staytrack.protect_o01_prices();
alter table staytrack.online_hall_items enable row level security;
revoke all on staytrack.online_hall_items from public,anon,authenticated;

-- Allocations reference the single verified payment; no second receipt or GCash reference.
create view staytrack.online_payment_allocations with(security_invoker=true) as
  select p.reservation_id,v.submission_id,b.id room_booking_id,null::uuid hall_reservation_id,
    b.total_centavos amount_centavos,v.received_at,v.verified_at
  from staytrack.verified_online_payments v join staytrack.payment_submissions p on p.id=v.submission_id
  join staytrack.room_bookings b on b.reservation_id=p.reservation_id
  union all
  select p.reservation_id,v.submission_id,null,o.hall_reservation_id,o.original_centavos,v.received_at,v.verified_at
  from staytrack.verified_online_payments v join staytrack.payment_submissions p on p.id=v.submission_id
  join staytrack.online_hall_items o on o.reservation_id=p.reservation_id;
revoke all on staytrack.online_payment_allocations from public,anon,authenticated;

create function staytrack.expire_online_holds(at_time timestamptz) returns integer
language plpgsql set search_path='' as $$
declare r record; n integer:=0;
begin
  perform 1 from staytrack.hall_resource where id=1 for update;
  for r in select o.reservation_id,o.hall_reservation_id from staytrack.online_hall_items o
    join staytrack.reservations rr on rr.id=o.reservation_id
    where o.state='held' and o.proof_deadline_at<=at_time order by o.reservation_id for update of rr,o
  loop
    -- Proof submission locks the same reservation before transitioning every item.
    if not exists(select 1 from staytrack.payment_submissions where reservation_id=r.reservation_id) then
      update staytrack.online_hall_items set state='expired' where reservation_id=r.reservation_id;
      update staytrack.inventory_claims set state='expired' where state='held' and id in
        (select claim_id from staytrack.room_bookings where reservation_id=r.reservation_id);
      update staytrack.hall_claims set released_at=at_time where released_at is null and id in
        (select claim_id from staytrack.hall_reservations where id=r.hall_reservation_id);
      n:=n+1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function staytrack.expire_online_holds(timestamptz) from public,anon,authenticated;

-- Guard conservation at confirmation even for a privileged server caller.
create function staytrack.guard_online_allocation_total() returns trigger
language plpgsql set search_path='' as $$
declare expected bigint; actual bigint;
begin
  select r.total_centavos into expected from staytrack.reservations r join staytrack.payment_submissions p on p.reservation_id=r.id where p.id=new.submission_id;
  select coalesce((select sum(b.total_centavos) from staytrack.room_bookings b where b.reservation_id=p.reservation_id),0)
    +coalesce((select o.original_centavos from staytrack.online_hall_items o where o.reservation_id=p.reservation_id),0)
    into actual from staytrack.payment_submissions p where p.id=new.submission_id;
  if actual is distinct from expected or new.amount_centavos<>expected then raise exception 'Payment allocations must equal the full reservation amount'; end if;
  return new;
end $$;
revoke all on function staytrack.guard_online_allocation_total() from public,anon,authenticated;
create trigger unified_payment_conservation before insert on staytrack.verified_online_payments
  for each row execute function staytrack.guard_online_allocation_total();

create table staytrack.online_hall_requests (
  id uuid primary key default gen_random_uuid(),
  hall_reservation_id uuid not null references staytrack.hall_reservations,
  actor uuid not null,
  request_key text not null check(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  request_hash text not null,
  kind text not null check(kind in ('cancel','reschedule','extend')),
  reason text not null check(length(btrim(reason)) between 1 and 1000),
  input jsonb not null,
  result jsonb not null,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(actor,request_key)
);
alter table staytrack.online_hall_requests enable row level security;
revoke all on staytrack.online_hall_requests from public,anon,authenticated;
create trigger immutable_history before update or delete on staytrack.online_hall_requests
  for each row execute function staytrack.protect_payment_review_history();

-- A single outgoing GCash transfer cannot discharge both a room and a Hall obligation.
create function staytrack.guard_shared_refund_reference() returns trigger
language plpgsql set search_path='' as $$
declare ref text;
begin
  ref:=case when tg_table_name='refund_transfers' then to_jsonb(new)->>'normalized_reference'
    else to_jsonb(new)->>'reference' end;
  if ref is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('staytrack-refund:'||ref,0));
  if (tg_table_name='refund_transfers' and exists(select 1 from staytrack.hall_refund_transfers where reference=ref))
    or (tg_table_name='hall_refund_transfers' and exists(select 1 from staytrack.refund_transfers where normalized_reference=ref)) then
    raise exception 'Refund transfer reference is already recorded' using errcode='23505';
  end if;
  return new;
end $$;
revoke all on function staytrack.guard_shared_refund_reference() from public,anon,authenticated;
create trigger shared_refund_reference before insert on staytrack.refund_transfers
  for each row execute function staytrack.guard_shared_refund_reference();
create trigger shared_refund_reference before insert on staytrack.hall_refund_transfers
  for each row execute function staytrack.guard_shared_refund_reference();
