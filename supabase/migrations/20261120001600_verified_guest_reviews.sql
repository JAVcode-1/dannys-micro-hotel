-- H04 candidate. Hosted application requires separate approval.
create table staytrack.review_contacts (
  reservation_id uuid primary key references staytrack.reservations,
  email text not null check (length(email) between 1 and 254 and email=lower(btrim(email))),
  verified_auth_user_id uuid not null,
  verified_at timestamptz not null default clock_timestamp(),
  invitation_consent_at timestamptz
);
create table staytrack.review_credentials (
  digest text primary key check (digest ~ '^[0-9a-f]{64}$'),
  reservation_id uuid not null references staytrack.reservations,
  purpose text not null check (purpose in ('enrollment_pair','enrollment','invitation','feedback_otp','withdrawal_otp','review','feedback','withdrawal')),
  email text,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  otp_digest text check (otp_digest ~ '^[0-9a-f]{64}$'),
  delivery_state text check (delivery_state in ('pending','sent','failed')),
  check (expires_at > created_at),
  check (consumed_at is null or revoked_at is null)
);
create index review_credentials_issue_history
  on staytrack.review_credentials(reservation_id,purpose,created_at);
create unique index review_one_unused_invitation
  on staytrack.review_credentials(reservation_id)
  where purpose='invitation' and consumed_at is null and revoked_at is null;

create table staytrack.guest_reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references staytrack.reservations,
  stars smallint not null check (stars between 1 and 5),
  comment text check (length(comment) between 1 and 2000),
  alias text not null check (length(alias) between 1 and 64),
  status text not null default 'published' check (status in ('published','held','hidden','withdrawn')),
  request_key text not null,
  request_hash text not null,
  submitted_at timestamptz not null default clock_timestamp(),
  consent_at timestamptz not null default clock_timestamp()
);
create index review_published_page
  on staytrack.guest_reviews(submitted_at desc,id desc) where status='published';

create table staytrack.private_feedback (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references staytrack.reservations,
  message text not null check (length(btrim(message)) between 1 and 4000),
  follow_up_email text check (length(follow_up_email) between 1 and 254),
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  request_key text not null,
  request_hash text not null,
  submitted_at timestamptz not null default clock_timestamp(),
  unique (reservation_id,request_key)
);
create table staytrack.review_replies (
  review_id uuid primary key references staytrack.guest_reviews,
  actor_auth_user_id uuid not null,
  message text not null check (length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create table staytrack.review_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references staytrack.guest_reviews,
  feedback_id uuid references staytrack.private_feedback,
  actor_auth_user_id uuid,
  actor_grant_digest text references staytrack.review_credentials(digest),
  action text not null check (action in ('hold','hide','restore','reply','withdraw','in_progress','resolved','contact_access')),
  reason_code text check (reason_code in ('spam_fraud','abuse','private_information','prohibited_content')),
  reason text check (length(btrim(reason)) between 1 and 1000),
  previous_status text,
  next_status text,
  request_key text not null,
  request_hash text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  check (num_nonnulls(review_id,feedback_id)=1),
  check (action='withdraw' or actor_auth_user_id is not null),
  check (num_nonnulls(actor_auth_user_id,actor_grant_digest)=1),
  check (action not in ('hold','hide','restore') or
    (reason_code is not null and reason is not null and previous_status is not null and next_status is not null))
);
create unique index review_event_retry on staytrack.review_events(review_id,request_key) where review_id is not null;
create unique index feedback_event_retry on staytrack.review_events(feedback_id,request_key) where feedback_id is not null;

create function staytrack.protect_guest_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Review content is immutable';
  end if;
  if old.status = 'withdrawn' and new.status is distinct from old.status then
    raise exception 'Withdrawal is final';
  end if;
  return new;
end;
$$;
revoke all on function staytrack.protect_guest_review() from public,anon,authenticated;
create trigger protect_guest_review before update or delete on staytrack.guest_reviews
  for each row execute function staytrack.protect_guest_review();
create trigger protect_review_events before update or delete on staytrack.review_events
  for each row execute function staytrack.protect_payment_review_history();
create trigger protect_review_replies before update or delete on staytrack.review_replies
  for each row execute function staytrack.protect_payment_review_history();

do $$ declare t text; begin
  foreach t in array array['review_contacts','review_credentials','guest_reviews','private_feedback','review_replies','review_events'] loop
    execute format('alter table staytrack.%I enable row level security',t);
    execute format('revoke all on staytrack.%I from public,anon,authenticated',t);
  end loop;
end $$;
