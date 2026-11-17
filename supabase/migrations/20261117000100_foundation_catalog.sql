-- F02 foundation only. Hotel booking, payment and auth flows are later phases.
create schema if not exists staytrack;

create table staytrack.room_categories (
  id bigint generated always as identity primary key,
  code text not null unique check (code in ('double_standard', 'family_executive')),
  name text not null,
  standard_occupancy_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, code)
);

create table staytrack.rooms (
  id bigint generated always as identity primary key,
  category_id bigint not null references staytrack.room_categories(id),
  code text not null unique,
  operational_state text not null default 'unverified'
    check (operational_state in ('unverified', 'ready', 'occupied', 'cleaning', 'maintenance')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table staytrack.packages (
  id bigint generated always as identity primary key,
  category_id bigint not null references staytrack.room_categories(id),
  category_code text not null,
  duration_minutes integer not null check (duration_minutes in (180, 360, 720, 1440)),
  constraint valid_category_duration check (category_code <> 'family_executive' or duration_minutes <> 180),
  price_centavos bigint not null check (price_centavos >= 0),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category_id, duration_minutes, version),
  foreign key (category_id, category_code) references staytrack.room_categories(id, code)
);

create unique index packages_one_active_duration
  on staytrack.packages (category_id, duration_minutes) where active;

-- No public grants or policies: application access remains server-only until
-- authentication, authorization and RLS are designed in later phases.
revoke all on schema staytrack from public, anon, authenticated;
revoke all on all tables in schema staytrack from public, anon, authenticated;
revoke all on all sequences in schema staytrack from public, anon, authenticated;
alter default privileges in schema staytrack revoke all on tables from public, anon, authenticated;
alter default privileges in schema staytrack revoke all on sequences from public, anon, authenticated;

-- Approved initial catalog. Physical room identifiers remain local seed data only.
insert into staytrack.room_categories (code, name, standard_occupancy_note) values
  ('double_standard', 'Double Standard', 'Typical occupancy is two; policy is advisory.'),
  ('family_executive', 'Family Executive', 'Typical occupancy is three; policy is advisory.');

insert into staytrack.packages (category_id, category_code, duration_minutes, price_centavos)
select c.id, c.code, p.duration_minutes, p.price_centavos
from staytrack.room_categories c
join (values
  ('double_standard', 180, 20000),
  ('double_standard', 360, 40000),
  ('double_standard', 720, 60000),
  ('double_standard', 1440, 100000),
  ('family_executive', 360, 60000),
  ('family_executive', 720, 90000),
  ('family_executive', 1440, 120000)
) as p(code, duration_minutes, price_centavos) on p.code = c.code;
