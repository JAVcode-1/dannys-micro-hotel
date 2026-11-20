-- Candidate only. All money movements remain in the hall ledger.
create table staytrack.hall_refund_approvals (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references staytrack.hall_reservations,
  amount_centavos bigint not null check(amount_centavos>=0),
  reason text not null check(length(btrim(reason)) between 1 and 1000)
);
create table staytrack.hall_refund_transfers (
  approval_id uuid primary key references staytrack.hall_refund_approvals,
  method text not null check(method in ('cash','gcash')),
  reference text unique,
  transferred_at timestamptz not null check(isfinite(transferred_at)),
  evidence text not null check(length(btrim(evidence)) between 1 and 1000),
  check((method='cash' and reference is null) or
    (method='gcash' and reference is not null and reference ~ '^[A-Z0-9]{1,100}$'))
);
create table staytrack.hall_overtime_charges (
  reservation_id uuid primary key references staytrack.hall_reservations,
  amount_centavos bigint not null check(amount_centavos>0),
  reason text not null check(length(btrim(reason)) between 1 and 1000)
);
do $$ declare t text; begin
  foreach t in array array['hall_refund_approvals','hall_refund_transfers','hall_overtime_charges'] loop
    execute format('alter table staytrack.%I enable row level security',t);
    execute format('revoke all on staytrack.%I from public,anon,authenticated',t);
    execute format('create trigger immutable before update or delete on staytrack.%I for each row execute function staytrack.protect_payment_review_history()',t);
  end loop;
end $$;
create unique index hall_one_occupied on staytrack.hall_reservations((true)) where status='in_progress';
