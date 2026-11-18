-- O03 candidate: separate owner approval required before hosted application.
-- No inventory, identities, payment data or Storage objects are seeded.
alter table staytrack.payment_submissions
  drop constraint payment_submissions_status_check,
  add constraint payment_submissions_status_check check
    (status in ('pending_review','confirmed','rejected','mismatched','unresolved','late_reconciliation')),
  add column review_version integer not null default 0 check (review_version >= 0);
alter table staytrack.room_bookings
  drop constraint room_bookings_status_check,
  add constraint room_bookings_status_check check (status in ('pending','confirmed'));
alter table staytrack.reservations
  add column online_confirmation_at timestamptz,
  add column cancellation_terms_snapshot text,
  add constraint online_confirmation_terms check
    ((online_confirmation_at is null and cancellation_terms_snapshot is null)
      or (online_confirmation_at is not null and cancellation_terms_snapshot is not null
        and length(btrim(cancellation_terms_snapshot)) > 0));

create table staytrack.payment_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references staytrack.payment_submissions(id),
  version integer not null check (version > 0),
  request_key text not null,
  request_hash text not null,
  decision text not null check (decision in ('confirmed','rejected','mismatched','unresolved','late_reconciliation')),
  note text not null check (length(note) between 1 and 1000),
  actor_auth_user_id uuid not null,
  evidence jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (submission_id, version),
  unique (submission_id, request_key)
);
create table staytrack.verified_online_payments (
  submission_id uuid primary key references staytrack.payment_submissions(id),
  normalized_reference text not null unique check
    (normalized_reference ~ '^[A-Z0-9]{1,100}$'),
  amount_centavos bigint not null check (amount_centavos >= 0),
  recipient text not null,
  received_at timestamptz not null,
  verified_by uuid not null,
  verified_at timestamptz not null default clock_timestamp()
);
create table staytrack.payment_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references staytrack.payment_reviews(id),
  reservation_id uuid not null references staytrack.reservations(id),
  recipient_email text not null,
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','sent')),
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz,
  check ((state = 'pending' and sent_at is null) or (state = 'sent' and sent_at is not null))
);
alter table staytrack.payment_reviews enable row level security;
alter table staytrack.verified_online_payments enable row level security;
alter table staytrack.payment_notification_outbox enable row level security;
revoke all on staytrack.payment_reviews, staytrack.verified_online_payments,
  staytrack.payment_notification_outbox from public, anon, authenticated;
create index payment_notification_pending on staytrack.payment_notification_outbox(created_at) where state = 'pending';

-- Keep receipt evidence and actor history append-only, including after staff deletion.
create function staytrack.protect_payment_review_history() returns trigger
language plpgsql set search_path = '' as $$ begin
  raise exception 'Payment verification history is immutable';
end; $$;
revoke all on function staytrack.protect_payment_review_history() from public, anon, authenticated;
create trigger payment_review_immutable before update or delete on staytrack.payment_reviews
  for each row execute function staytrack.protect_payment_review_history();
create trigger verified_payment_immutable before update or delete on staytrack.verified_online_payments
  for each row execute function staytrack.protect_payment_review_history();
create function staytrack.protect_online_confirmation() returns trigger
language plpgsql set search_path = '' as $$ begin
  if old.online_confirmation_at is not null and
    (new.online_confirmation_at is distinct from old.online_confirmation_at
     or new.cancellation_terms_snapshot is distinct from old.cancellation_terms_snapshot) then
    raise exception 'Online confirmation timestamp and terms are immutable';
  end if;
  return new;
end; $$;
revoke all on function staytrack.protect_online_confirmation() from public, anon, authenticated;
create trigger online_confirmation_immutable before update of online_confirmation_at, cancellation_terms_snapshot
  on staytrack.reservations for each row execute function staytrack.protect_online_confirmation();
