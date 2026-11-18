-- V03 candidate: apply only after owner review.
alter table staytrack.inventory_claims
  add column proof_deadline_at timestamptz,
  add column proof_submitted_at timestamptz;

-- Keep any existing claim protected; old held claims receive their original 30m deadline.
update staytrack.inventory_claims
set proof_deadline_at = created_at + interval '30 minutes';

alter table staytrack.inventory_claims
  alter column proof_deadline_at set not null,
  drop constraint inventory_claims_state_check,
  add constraint inventory_claims_state_check
    check (state in ('held', 'proof_pending_review', 'confirmed', 'released', 'expired')),
  add constraint inventory_claims_proof_state_check
    check ((state <> 'proof_pending_review' or proof_submitted_at is not null)
      and (proof_submitted_at is null or proof_submitted_at <= proof_deadline_at));

alter table staytrack.inventory_claims drop constraint inventory_claims_room_id_tstzrange_excl;
alter table staytrack.inventory_claims add constraint inventory_claims_room_id_tstzrange_excl
  exclude using gist (room_id with =, tstzrange(start_at, buffered_end_at, '[)') with &&)
  where (state not in ('released', 'expired'));

drop index staytrack.inventory_claims_category_active;
create index inventory_claims_category_active on staytrack.inventory_claims(category_id, start_at)
  where state not in ('released', 'expired');
create index inventory_claims_expiring on staytrack.inventory_claims(proof_deadline_at)
  where state = 'held';
