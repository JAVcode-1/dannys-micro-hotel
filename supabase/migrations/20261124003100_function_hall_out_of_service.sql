-- Candidate migration. Apply only after separate approval.
alter table staytrack.hall_claims
  add column purpose text not null default 'event',
  alter column setup drop not null,
  alter column attendees drop not null,
  add constraint hall_claim_purpose_check check (
    (purpose = 'event' and setup is not null and attendees is not null)
    or (
      purpose = 'out_of_service' and setup is null and attendees is null
      and preparation_start = event_start and cleanup_end = event_end
    )
  );
