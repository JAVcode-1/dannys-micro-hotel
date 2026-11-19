-- W01 candidate. Owner approval required; no hosted inventory or money is seeded.
alter table staytrack.reservations
  add column channel text not null default 'online' check (channel in ('online','walk_in')),
  add column created_by uuid,
  alter column owner_auth_user_id drop not null,
  alter column verified_email drop not null,
  add constraint reservation_channel_identity check (
    (channel='online' and owner_auth_user_id is not null and verified_email is not null)
    or (channel='walk_in' and owner_auth_user_id is null and verified_email is null
      and created_by is not null and online_confirmation_at is null and cancellation_terms_snapshot is null));
alter table staytrack.inventory_claims
  drop constraint inventory_claims_state_check,
  add constraint inventory_claims_state_check check
    (state in ('held','proof_pending_review','confirmed','released','expired','walkin_reserved'));
-- Existing NOT IN ('released','expired') exclusion/index predicates already protect walkin_reserved.
create or replace function staytrack.schedule_payment_reminders() returns trigger
language plpgsql set search_path = '' as $$ begin
  if new.channel <> 'online' then return new; end if;
  insert into staytrack.payment_reminders(reservation_id,minute_offset,due_at)
  select new.id,minutes,min(i.proof_deadline_at)-(30-minutes)*interval '1 minute'
  from staytrack.inventory_claims i cross join (values (15),(25)) offsets(minutes)
  where i.idempotency_key=new.idempotency_key and i.state='held' group by minutes;
  return new;
end; $$;
revoke all on function staytrack.schedule_payment_reminders() from public,anon,authenticated;

create table staytrack.walkin_ledger (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references staytrack.reservations(id),
  kind text not null check (kind in ('charge','payment')),
  room_booking_id uuid unique references staytrack.room_bookings(id),
  method text check (method in ('cash','gcash')),
  amount_centavos bigint not null check (amount_centavos >= 0 and (kind='charge' or amount_centavos>0)),
  transaction_reference text,
  normalized_reference text unique,
  recipient text,
  received_at timestamptz,
  ledger_checked boolean not null default false,
  receiving_account_checked boolean not null default false,
  time_checked boolean not null default false,
  actor_auth_user_id uuid not null,
  recorded_at timestamptz not null default clock_timestamp(),
  request_key text not null,
  request_hash text not null check (length(request_hash)=64),
  unique (reservation_id,request_key),
  check (
    (kind='charge' and room_booking_id is not null and method is null
      and transaction_reference is null and normalized_reference is null and recipient is null and received_at is null
      and not ledger_checked and not receiving_account_checked and not time_checked)
    or (kind='payment' and room_booking_id is null and method is not null and (
      (method='cash' and transaction_reference is null and normalized_reference is null and recipient is null and received_at is null
        and not ledger_checked and not receiving_account_checked and not time_checked)
      or (method='gcash' and transaction_reference is not null and length(btrim(transaction_reference)) between 1 and 100
        and normalized_reference is not null and normalized_reference ~ '^[A-Z0-9]{1,100}$'
        and recipient is not null and length(btrim(recipient)) between 1 and 120 and received_at is not null
        and ledger_checked and receiving_account_checked and time_checked))))
);
create index walkin_ledger_reservation on staytrack.walkin_ledger(reservation_id,recorded_at,id);

create table staytrack.gcash_reference_registry (
  normalized_reference text primary key check (normalized_reference ~ '^[A-Z0-9]{1,100}$'),
  online_submission_id uuid unique references staytrack.verified_online_payments(submission_id),
  walkin_entry_id uuid unique references staytrack.walkin_ledger(id),
  check ((online_submission_id is not null and walkin_entry_id is null)
      or (online_submission_id is null and walkin_entry_id is not null))
);
-- Backfill only existing verified references; no new receipt or payment is fabricated.
insert into staytrack.gcash_reference_registry(normalized_reference,online_submission_id)
  select normalized_reference,submission_id from staytrack.verified_online_payments;
alter table staytrack.walkin_ledger enable row level security;
alter table staytrack.gcash_reference_registry enable row level security;
revoke all on staytrack.walkin_ledger,staytrack.gcash_reference_registry from public,anon,authenticated;

create function staytrack.register_gcash_reference() returns trigger
language plpgsql set search_path = '' as $$ begin
  if tg_table_name='verified_online_payments' then
    insert into staytrack.gcash_reference_registry(normalized_reference,online_submission_id)
      values (new.normalized_reference,new.submission_id);
  elsif new.method='gcash' then
    insert into staytrack.gcash_reference_registry(normalized_reference,walkin_entry_id)
      values (new.normalized_reference,new.id);
  end if;
  return new;
end; $$;
revoke all on function staytrack.register_gcash_reference() from public,anon,authenticated;
create trigger online_gcash_reference after insert on staytrack.verified_online_payments
  for each row execute function staytrack.register_gcash_reference();
create trigger walkin_gcash_reference after insert on staytrack.walkin_ledger
  for each row execute function staytrack.register_gcash_reference();
create trigger walkin_ledger_immutable before update or delete on staytrack.walkin_ledger
  for each row execute function staytrack.protect_payment_review_history();
create trigger gcash_registry_immutable before update or delete on staytrack.gcash_reference_registry
  for each row execute function staytrack.protect_payment_review_history();

create function staytrack.guard_walkin_ledger() returns trigger
language plpgsql set search_path = '' as $$
declare total bigint; charged bigint; paid bigint; item_total bigint;
begin
  select total_centavos into total from staytrack.reservations where id=new.reservation_id and channel='walk_in' for update;
  if not found then raise exception 'Ledger requires a walk-in reservation'; end if;
  perform 1 from staytrack.staff_accounts where auth_user_id=new.actor_auth_user_id and active for share;
  if not found then raise exception 'Active staff required'; end if;
  if new.kind='charge' then
    select total_centavos into item_total from staytrack.room_bookings
      where id=new.room_booking_id and reservation_id=new.reservation_id;
    if not found or item_total<>new.amount_centavos then raise exception 'Charge must match the booked item'; end if;
  else
    select coalesce(sum(amount_centavos) filter (where kind='charge'),0),
      coalesce(sum(amount_centavos) filter (where kind='payment'),0) into charged,paid
      from staytrack.walkin_ledger where reservation_id=new.reservation_id;
    if charged<>total or new.amount_centavos>charged-paid then raise exception 'Payment exceeds remaining journal balance or charges are incomplete'; end if;
    if exists(select 1 from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id
      where b.reservation_id=new.reservation_id and i.state<>'walkin_reserved') then raise exception 'Walk-in capacity requires reconciliation'; end if;
    if new.method='gcash' and new.received_at>clock_timestamp() then raise exception 'Future GCash receipt time'; end if;
  end if;
  return new;
end; $$;
revoke all on function staytrack.guard_walkin_ledger() from public,anon,authenticated;
create trigger walkin_ledger_guard before insert on staytrack.walkin_ledger
  for each row execute function staytrack.guard_walkin_ledger();
