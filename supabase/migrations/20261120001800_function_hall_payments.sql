-- Candidate only. Shared registry owns GCash identity, hall tables own hall finances.
create table staytrack.hall_reservations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check(channel in ('walk_in','telephone','messenger')),
  organizer text not null check(length(btrim(organizer)) between 1 and 120),
  requests text check(length(requests)<=2000),
  quote_input jsonb not null,
  status text not null default 'inquiry' check(status in ('inquiry','confirmed','in_progress','completed','cancelled','no_show')),
  claim_id uuid unique references staytrack.hall_claims,
  payment_resolution boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  actual_start timestamptz,
  actual_end timestamptz,
  check(actual_end is null or (actual_start is not null and actual_end>=actual_start))
);
create table staytrack.hall_revisions (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references staytrack.hall_reservations,
  claim_id uuid not null references staytrack.hall_claims,
  total_centavos bigint not null check(total_centavos>=300000),
  quote jsonb not null,
  recorded_at timestamptz not null default clock_timestamp()
);
create index hall_latest_revision on staytrack.hall_revisions(reservation_id,id desc);
create table staytrack.hall_receipts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references staytrack.hall_reservations,
  actor uuid not null references staytrack.staff_accounts(auth_user_id),
  method text not null check(method in ('cash','gcash')),
  amount_centavos bigint not null check(amount_centavos>0),
  normalized_reference text,
  evidence text not null check(length(btrim(evidence)) between 1 and 1000),
  received_at timestamptz not null check(isfinite(received_at)),
  recorded_at timestamptz not null default clock_timestamp(),
  check ((method='cash' and normalized_reference is null) or
    (method='gcash' and normalized_reference is not null and normalized_reference ~ '^[A-Z0-9]{1,100}$'))
);
create index hall_receipt_reservation on staytrack.hall_receipts(reservation_id);
alter table staytrack.gcash_reference_registry add column hall_receipt_id uuid unique references staytrack.hall_receipts;
alter table staytrack.gcash_reference_registry drop constraint gcash_reference_one_source;
alter table staytrack.gcash_reference_registry add constraint gcash_reference_one_source
  check(num_nonnulls(online_submission_id,walkin_entry_id,stay_receipt_id,hall_receipt_id)=1);
create function staytrack.register_hall_gcash_reference() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.method='gcash' then
    insert into staytrack.gcash_reference_registry(normalized_reference,hall_receipt_id)
      values(new.normalized_reference,new.id);
  end if;
  return new;
end $$;
revoke all on function staytrack.register_hall_gcash_reference() from public,anon,authenticated;
create trigger hall_gcash_reference after insert on staytrack.hall_receipts
  for each row execute function staytrack.register_hall_gcash_reference();

create table staytrack.hall_actions (
  actor uuid not null references staytrack.staff_accounts(auth_user_id),
  request_key text not null check(request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  payload_hash text not null,
  action text not null,
  reservation_id uuid references staytrack.hall_reservations,
  result jsonb not null,
  recorded_at timestamptz not null default clock_timestamp(),
  primary key(actor,request_key)
);
do $$ declare t text; begin
  foreach t in array array['hall_reservations','hall_revisions','hall_receipts','hall_actions'] loop
    execute format('alter table staytrack.%I enable row level security',t);
    execute format('revoke all on staytrack.%I from public,anon,authenticated',t);
    if t<>'hall_reservations' then
      execute format('create trigger immutable before update or delete on staytrack.%I for each row execute function staytrack.protect_payment_review_history()',t);
    end if;
  end loop;
end $$;
