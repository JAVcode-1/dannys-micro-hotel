-- Candidate: local isolated verification only; hosted application requires separate approval.
-- Marker commits with the invitation credential and notification outbox row.
create table staytrack.review_invitation_jobs (
  reservation_id uuid primary key references staytrack.reservations(id),
  queued_at timestamptz not null default clock_timestamp()
);
alter table staytrack.review_invitation_jobs enable row level security;
revoke all on staytrack.review_invitation_jobs from public,anon,authenticated;
create trigger review_invitation_jobs_immutable before update or delete
  on staytrack.review_invitation_jobs for each row execute function staytrack.protect_o01_prices();
