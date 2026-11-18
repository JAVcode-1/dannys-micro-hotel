-- O01 candidate ONLY. Owner review/approval required before hosted application.
-- No physical rooms, guest identities, payments or booking records are seeded.
create table staytrack.reservations (
  id uuid primary key default gen_random_uuid(),
  owner_auth_user_id uuid not null,
  verified_email text not null,
  primary_name text not null check (length(primary_name) between 1 and 120),
  idempotency_key text not null unique references staytrack.claim_requests(idempotency_key),
  request_hash text not null,
  total_centavos bigint not null check (total_centavos >= 0),
  created_at timestamptz not null default now()
);

create table staytrack.room_bookings (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references staytrack.reservations(id),
  item_index integer not null check (item_index between 0 and 14),
  claim_id bigint not null unique references staytrack.inventory_claims(id),
  category_code text not null references staytrack.room_categories(code),
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  adult_count bigint not null check (adult_count >= 1),
  child_count bigint not null check (child_count >= 0),
  base_centavos bigint not null check (base_centavos >= 0),
  extra_bed_centavos bigint not null check (extra_bed_centavos in (0, 10000)),
  total_centavos bigint not null check (total_centavos = base_centavos + extra_bed_centavos),
  pricing_snapshot jsonb not null check (jsonb_typeof(pricing_snapshot) = 'array' and jsonb_array_length(pricing_snapshot) between 1 and 30),
  status text not null default 'pending' check (status = 'pending'),
  unique (reservation_id, item_index),
  check (category_code = 'family_executive' or extra_bed_centavos = 0)
);

-- O01 has no confirmation, cancellation, rescheduling or payment transition.
-- Package versions/unit prices are copied into each item's immutable snapshot.
create function staytrack.protect_o01_prices() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'O01 booked price snapshots are immutable';
end;
$$;
revoke all on function staytrack.protect_o01_prices() from public, anon, authenticated;
create trigger room_booking_price_immutable before update of
  pricing_snapshot, base_centavos, extra_bed_centavos, total_centavos
  on staytrack.room_bookings for each row execute function staytrack.protect_o01_prices();
create trigger reservation_price_immutable before update of total_centavos
  on staytrack.reservations for each row execute function staytrack.protect_o01_prices();

create index reservations_owner on staytrack.reservations(owner_auth_user_id, created_at);
alter table staytrack.reservations enable row level security;
alter table staytrack.room_bookings enable row level security;
revoke all on staytrack.reservations, staytrack.room_bookings from public, anon, authenticated;
