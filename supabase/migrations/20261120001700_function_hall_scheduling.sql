-- Candidate only. Apply to disposable PostgreSQL until separately approved.
create table staytrack.hall_resource (
  id smallint primary key check (id=1),
  ready boolean not null default false
);
insert into staytrack.hall_resource(id) values(1);

create table staytrack.hall_settings (
  id bigint generated always as identity primary key,
  actor uuid references staytrack.staff_accounts(auth_user_id),
  recorded_at timestamptz not null default clock_timestamp(),
  opening integer not null check(opening between 0 and 1439),
  closing integer not null check(closing between 1 and 1439 and closing>opening),
  notice integer not null check(notice between 0 and 129600),
  horizon integer not null check(horizon between 0 and 3650),
  preparation integer not null check(preparation between 0 and 1440),
  cleanup integer not null check(cleanup between 0 and 1440),
  no_show_grace integer not null check(no_show_grace between 0 and 1440),
  reminder integer not null check(reminder between 0 and 1440)
);
insert into staytrack.hall_settings(opening,closing,notice,horizon,preparation,cleanup,no_show_grace,reminder)
values(480,1320,180,90,30,30,60,15);
create trigger hall_settings_immutable before update or delete on staytrack.hall_settings
for each row execute function staytrack.protect_payment_review_history();

create table staytrack.hall_claims (
  id uuid primary key default gen_random_uuid(),
  resource_id smallint not null default 1 references staytrack.hall_resource,
  setup text not null check(setup in ('theater','room')),
  attendees integer not null check(attendees between 1 and case setup when 'theater' then 70 else 50 end),
  event_start timestamptz not null,
  event_end timestamptz not null,
  preparation_start timestamptz not null,
  cleanup_end timestamptz not null,
  released_at timestamptz,
  check (isfinite(preparation_start) and isfinite(cleanup_end)
    and preparation_start<=event_start and event_end>event_start and cleanup_end>=event_end),
  exclude using gist (resource_id with =, tstzrange(preparation_start,cleanup_end,'[)') with &&)
    where (released_at is null)
);
alter table staytrack.hall_resource enable row level security;
alter table staytrack.hall_settings enable row level security;
alter table staytrack.hall_claims enable row level security;
revoke all on staytrack.hall_resource,staytrack.hall_settings,staytrack.hall_claims from public,anon,authenticated;
