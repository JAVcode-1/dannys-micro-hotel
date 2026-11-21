-- Local correction candidate; never apply to a hosted project without separate approval.
-- Contact and disclosed policy snapshots are private; no legal approval is asserted.
create table staytrack.reservation_booking_contacts (
  reservation_id uuid primary key references staytrack.reservations(id),
  phone text not null check (length(phone) between 7 and 30 and phone ~ '^[+()0-9 -]+$'),
  policy_version text not null check (length(policy_version) between 1 and 80),
  policy_text text not null check (length(policy_text) between 1 and 4000),
  acknowledged_by uuid not null,
  acknowledged_at timestamptz not null default clock_timestamp()
);
alter table staytrack.reservation_booking_contacts enable row level security;
revoke all on staytrack.reservation_booking_contacts from public,anon,authenticated;
create trigger reservation_booking_contacts_immutable before update or delete
  on staytrack.reservation_booking_contacts for each row execute function staytrack.protect_o01_prices();
