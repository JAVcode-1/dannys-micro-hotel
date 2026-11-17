-- Prepared for owner review. Do not apply without explicit approval.
create table staytrack.staff_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staytrack.staff_audit (
  id bigint generated always as identity primary key,
  -- Keep the actor UUID after an employee Auth account is deleted.
  actor_auth_user_id uuid not null,
  action text not null,
  occurred_at timestamptz not null default now()
);

create index staff_audit_actor_time on staytrack.staff_audit (actor_auth_user_id, occurred_at desc);

alter table staytrack.staff_accounts enable row level security;
alter table staytrack.staff_audit enable row level security;
revoke all on staytrack.staff_accounts, staytrack.staff_audit from public, anon, authenticated;
revoke all on sequence staytrack.staff_audit_id_seq from public, anon, authenticated;
