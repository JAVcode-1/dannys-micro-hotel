-- Candidate: isolated verification only; no hosted application authorized.
create table staytrack.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 dedupe_key text not null unique check(length(dedupe_key) between 1 and 200),
 recipient text not null check(length(recipient) between 3 and 254),
 kind text not null check(kind in ('reservation_created','payment_submitted','reservation_confirmed','payment_reminder','review_invitation','review_otp')),
 reservation_id uuid references staytrack.reservations(id),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default clock_timestamp(),
 due_at timestamptz not null default clock_timestamp(),
 attempts integer not null default 0 check(attempts between 0 and 5),
 lease_token uuid, lease_until timestamptz,
 state text not null default 'pending' check(state in ('pending','sent','failed','cancelled')),
 sent_at timestamptz,
 check ((lease_token is null)=(lease_until is null))
);
alter table staytrack.notification_outbox enable row level security;
revoke all on staytrack.notification_outbox from public,anon,authenticated;
create index notification_outbox_due on staytrack.notification_outbox(due_at) where state='pending';

create function staytrack.enqueue_booking_notification() returns trigger language plpgsql set search_path='' as $$
declare reservation staytrack.reservations; notification_kind text;
begin
 if tg_table_name='reservations' then
  reservation=new; notification_kind='reservation_created';
 elsif tg_table_name='payment_submissions' then
  select * into reservation from staytrack.reservations where id=new.reservation_id;
  notification_kind='payment_submitted';
 else
  select r.* into reservation from staytrack.reservations r join staytrack.payment_submissions p on p.reservation_id=r.id where p.id=new.submission_id;
  notification_kind='reservation_confirmed';
 end if;
 if reservation.channel='online' and reservation.verified_email is not null then
  insert into staytrack.notification_outbox(dedupe_key,recipient,kind,reservation_id,payload)
  values(notification_kind||':'||reservation.id,reservation.verified_email,notification_kind,reservation.id,jsonb_build_object('reservationId',reservation.id)) on conflict(dedupe_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function staytrack.enqueue_booking_notification() from public,anon,authenticated;
create trigger booking_notification after insert on staytrack.reservations for each row execute function staytrack.enqueue_booking_notification();
create trigger proof_notification after insert on staytrack.payment_submissions for each row execute function staytrack.enqueue_booking_notification();
create trigger confirmation_notification after insert on staytrack.verified_online_payments for each row execute function staytrack.enqueue_booking_notification();
