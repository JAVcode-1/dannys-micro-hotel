-- C03 proposal. Apply only after owner approval and isolated database checks.
create table staytrack.operational_settings (
  id boolean primary key default true check (id),
  cleaning_buffer_minutes integer check (cleaning_buffer_minutes between 0 and 1440),
  checkout_alert_minutes integer check (checkout_alert_minutes between 1 and 1440),
  gcash_qr_object_key text,
  gcash_payee_label text,
  cancellation_display_text text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into staytrack.operational_settings (id) values (true);
alter table staytrack.operational_settings enable row level security;
revoke all on staytrack.operational_settings from public, anon, authenticated;
