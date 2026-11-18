-- V02 candidate. Owner approval is required before applying.
create extension if not exists btree_gist;
create unique index rooms_id_category on staytrack.rooms(id, category_id);

create table staytrack.room_blocks (
  id bigint generated always as identity primary key,
  room_id bigint not null references staytrack.rooms(id),
  start_at timestamptz not null,
  end_at timestamptz,
  reason text not null,
  check (end_at is null or end_at > start_at)
);

create table staytrack.claim_requests (
  idempotency_key text primary key,
  request_hash text not null,
  created_at timestamptz not null default now()
);

create table staytrack.inventory_claims (
  id bigint generated always as identity primary key,
  idempotency_key text not null references staytrack.claim_requests(idempotency_key),
  item_index integer not null check (item_index >= 0),
  category_id bigint not null references staytrack.room_categories(id),
  room_id bigint not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  buffer_minutes integer not null check (buffer_minutes between 0 and 1440),
  buffered_end_at timestamptz not null,
  state text not null check (state in ('held', 'confirmed', 'released')),
  created_at timestamptz not null default now(),
  unique (idempotency_key, item_index),
  foreign key (room_id, category_id) references staytrack.rooms(id, category_id),
  check (end_at > start_at),
  check (buffered_end_at = end_at + buffer_minutes * interval '1 minute'),
  exclude using gist (room_id with =, tstzrange(start_at, buffered_end_at, '[)') with &&)
    where (state <> 'released')
);

create index inventory_claims_category_active on staytrack.inventory_claims(category_id, start_at)
  where state <> 'released';
create index room_blocks_room_time on staytrack.room_blocks(room_id, start_at);

alter table staytrack.room_blocks enable row level security;
alter table staytrack.claim_requests enable row level security;
alter table staytrack.inventory_claims enable row level security;
revoke all on staytrack.room_blocks, staytrack.claim_requests, staytrack.inventory_claims
  from public, anon, authenticated;
revoke all on sequence staytrack.room_blocks_id_seq, staytrack.inventory_claims_id_seq
  from public, anon, authenticated;
