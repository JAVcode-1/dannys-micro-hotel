-- Optional shared API throttling for multi-instance deployments. Candidate only.
create table staytrack.request_limits (
 key_digest text primary key check(length(key_digest)=64),
 window_start timestamptz not null,
 count integer not null check(count between 1 and 31)
);
alter table staytrack.request_limits enable row level security;
revoke all on staytrack.request_limits from public,anon,authenticated;
