-- Guest receipt uploads no longer need a manually entered reference.
-- The verified GCash payment still requires a unique ledger reference.
alter table staytrack.payment_submissions
  alter column transaction_reference drop not null;
