-- W03 candidate ONLY: separate owner approval required. No hosted application or seed.
create table staytrack.room_checkouts (
  room_booking_id uuid primary key references staytrack.room_check_ins(room_booking_id),
  actor_auth_user_id uuid not null,
  request_key text not null check (request_key ~ '^[A-Za-z0-9_-]{16,100}$'),
  checked_out_at timestamptz not null,
  balance_centavos bigint not null check (balance_centavos >= 0),
  exception_reason text check (length(btrim(exception_reason)) between 1 and 1000),
  cleaning_block_id bigint not null unique references staytrack.room_blocks(id),
  check (balance_centavos = 0 or exception_reason is not null),
  unique (actor_auth_user_id, request_key)
);
alter table staytrack.room_checkouts enable row level security;
revoke all on staytrack.room_checkouts from public, anon, authenticated;
create trigger room_checkout_immutable before update or delete on staytrack.room_checkouts
  for each row execute function staytrack.protect_payment_review_history();

-- W02 protection remains for every change except the departing item's exact release.
create or replace function staytrack.protect_checked_in_claim() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from staytrack.room_check_ins s
    join staytrack.room_bookings b on b.id=s.room_booking_id where b.claim_id=old.id)
  then
    if old.state <> 'released' and new.state='released'
      and (to_jsonb(new)-'state')=(to_jsonb(old)-'state')
      and exists (select 1 from staytrack.room_checkouts o
        join staytrack.room_bookings b on b.id=o.room_booking_id
        join staytrack.room_blocks p on p.id=o.cleaning_block_id
        where b.claim_id=old.id and p.room_id=old.room_id
        and p.start_at=o.checked_out_at
        and p.end_at >= greatest(old.buffered_end_at,
          o.checked_out_at + old.buffer_minutes * interval '1 minute'))
    then return new; end if;
    raise exception 'Checked-in capacity is protected';
  end if;
  return new;
end; $$;

create function staytrack.protect_checkout_buffer() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from staytrack.room_checkouts where cleaning_block_id=old.id)
  then raise exception 'Checkout cleaning buffer is protected'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function staytrack.protect_checkout_buffer() from public, anon, authenticated;
create trigger checkout_buffer_protected before update or delete on staytrack.room_blocks
  for each row execute function staytrack.protect_checkout_buffer();

-- Null preserves the existing single-threshold setting; no owner default is invented.
alter table staytrack.operational_settings add column checkout_warning_minutes integer[]
  check (checkout_warning_minutes is null or
    (cardinality(checkout_warning_minutes) between 1 and 10
      and array_position(checkout_warning_minutes,null) is null
      and 1 <= all(checkout_warning_minutes) and 1440 >= all(checkout_warning_minutes)));
