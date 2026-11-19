-- W02 candidate. Apply only after separate owner approval.
create table staytrack.room_check_ins (
  room_booking_id uuid primary key references staytrack.room_bookings(id),
  room_id bigint not null references staytrack.rooms(id),
  actor_auth_user_id uuid not null,
  request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  checked_in_at timestamptz not null,
  checkout_at timestamptz not null check (checkout_at > checked_in_at),
  unique (actor_auth_user_id, request_key)
);
alter table staytrack.room_check_ins enable row level security;
revoke all on staytrack.room_check_ins from public, anon, authenticated;
create trigger room_check_in_immutable before update or delete on staytrack.room_check_ins
  for each row execute function staytrack.protect_payment_review_history();

create function staytrack.protect_checked_in_claim() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from staytrack.room_check_ins s
    join staytrack.room_bookings b on b.id = s.room_booking_id where b.claim_id = old.id)
  then raise exception 'Checked-in capacity is protected'; end if;
  return new;
end; $$;
revoke all on function staytrack.protect_checked_in_claim() from public, anon, authenticated;
create trigger checked_in_claim_protected before update on staytrack.inventory_claims
  for each row execute function staytrack.protect_checked_in_claim();
