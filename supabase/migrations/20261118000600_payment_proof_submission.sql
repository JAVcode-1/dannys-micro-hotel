-- O02 candidate. Owner approval required. No booking/payment confirmation is added.
create table staytrack.payment_qr (
  id boolean primary key default true check (id),
  object_key text not null unique,
  payee_label text not null check (length(payee_label) between 1 and 120),
  updated_by uuid not null,
  updated_at timestamptz not null default now()
);

create table staytrack.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references staytrack.reservations(id),
  submitted_by uuid not null,
  transaction_reference text not null check (length(transaction_reference) between 1 and 100),
  object_key text not null unique,
  content_type text not null check (content_type in ('image/png', 'image/jpeg')),
  byte_length integer not null check (byte_length between 12 and 5242880),
  request_hash text not null check (length(request_hash) = 64),
  amount_due_centavos bigint not null check (amount_due_centavos >= 0),
  status text not null default 'pending_review' check (status = 'pending_review'),
  submitted_at timestamptz not null
);

create table staytrack.payment_reminders (
  reservation_id uuid not null references staytrack.reservations(id),
  minute_offset integer not null check (minute_offset in (15, 25)),
  due_at timestamptz not null,
  state text not null default 'scheduled' check (state in ('scheduled', 'cancelled')),
  primary key (reservation_id, minute_offset)
);

create function staytrack.schedule_payment_reminders() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into staytrack.payment_reminders(reservation_id, minute_offset, due_at)
  select new.id, minutes, min(i.proof_deadline_at) - (30 - minutes) * interval '1 minute'
  from staytrack.inventory_claims i cross join (values (15), (25)) offsets(minutes)
  where i.idempotency_key = new.idempotency_key and i.state = 'held'
  group by minutes;
  return new;
end;
$$;
revoke all on function staytrack.schedule_payment_reminders() from public, anon, authenticated;
create trigger reservation_payment_reminders after insert on staytrack.reservations
  for each row execute function staytrack.schedule_payment_reminders();

alter table staytrack.payment_qr enable row level security;
alter table staytrack.payment_submissions enable row level security;
alter table staytrack.payment_reminders enable row level security;
revoke all on staytrack.payment_qr, staytrack.payment_submissions, staytrack.payment_reminders
  from public, anon, authenticated;
create index payment_reminders_due on staytrack.payment_reminders(due_at) where state = 'scheduled';

-- Storage API is the only blob writer. Browser Data/Storage APIs get no policies.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/png','image/jpeg']),
       ('payment-qr', 'payment-qr', false, 5242880, array['image/png','image/jpeg'])
on conflict (id) do nothing;
do $$ begin
  if exists (select 1 from storage.buckets where id in ('payment-proofs','payment-qr')
    and (public or file_size_limit is distinct from 5242880
      or allowed_mime_types is distinct from array['image/png','image/jpeg'])) then
    raise exception 'Existing payment bucket configuration requires owner review';
  end if;
end $$;
-- Restrictive guard also denies clients if another permissive Storage policy exists.
create policy staytrack_private_payment_media on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id not in ('payment-proofs', 'payment-qr'))
  with check (bucket_id not in ('payment-proofs', 'payment-qr'));
