import assert from "node:assert/strict";
import {
  probeDatabase,
  databasePool,
  closeDatabase,
} from "../backend/dist/database.js";

const expected = [
  ["double_standard", 180, 20000, true, 1],
  ["double_standard", 360, 40000, true, 1],
  ["double_standard", 720, 60000, true, 1],
  ["double_standard", 1440, 100000, true, 1],
  ["family_executive", 360, 60000, true, 1],
  ["family_executive", 720, 90000, true, 1],
  ["family_executive", 1440, 120000, true, 1],
];

const projectRef = "pgbierfxeviouyjsmjnh";
const apiUrl = new URL(process.env.SUPABASE_URL);
const databaseUrl = new URL(process.env.DATABASE_URL);
assert.equal(apiUrl.hostname, `${projectRef}.supabase.co`);
assert.ok(
  databaseUrl.hostname === `db.${projectRef}.supabase.co` ||
    (databaseUrl.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(databaseUrl.username) === `postgres.${projectRef}`),
  "DATABASE_URL must target the approved F02 project",
);

try {
  await probeDatabase();
  const pool = databasePool();
  const { rows: tables } = await pool.query(
    "select table_name from information_schema.tables where table_schema = 'staytrack' order by table_name",
  );
  assert.deepEqual(
    tables.map((row) => row.table_name),
    ["packages", "room_categories", "rooms"],
  );
  const { rows: categories } = await pool.query(
    "select code from staytrack.room_categories order by code",
  );
  assert.deepEqual(
    categories.map((row) => row.code),
    ["double_standard", "family_executive"],
  );
  const { rows: packages } = await pool.query(
    "select category_code, duration_minutes, price_centavos, active, version from staytrack.packages order by category_code, duration_minutes",
  );
  assert.deepEqual(
    packages.map((row) => [
      row.category_code,
      row.duration_minutes,
      Number(row.price_centavos),
      row.active,
      row.version,
    ]),
    expected,
  );
  const { rows: rooms } = await pool.query(
    "select count(*)::integer as total from staytrack.rooms",
  );
  assert.equal(rooms[0].total, 0);

  const { rows: constraints } = await pool.query(
    "select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid in ('staytrack.room_categories'::regclass, 'staytrack.rooms'::regclass, 'staytrack.packages'::regclass)",
  );
  const constraintNames = new Set(constraints.map((row) => row.conname));
  for (const name of [
    "valid_category_duration",
    "packages_duration_minutes_check",
    "packages_price_centavos_check",
    "packages_category_id_category_code_fkey",
    "rooms_category_id_fkey",
    "room_categories_code_key",
    "room_categories_code_check",
    "rooms_code_key",
    "rooms_operational_state_check",
    "packages_category_id_duration_minutes_version_key",
    "packages_version_check",
  ]) {
    assert.ok(constraintNames.has(name), `missing constraint ${name}`);
  }
  const familyDuration = constraints.find(
    (row) => row.conname === "valid_category_duration",
  )?.definition;
  assert.match(familyDuration, /category_code <> 'family_executive'/);
  assert.match(familyDuration, /duration_minutes <> 180/);
  const duration = constraints.find(
    (row) => row.conname === "packages_duration_minutes_check",
  )?.definition;
  assert.match(duration, /ARRAY\[180, 360, 720, 1440\]/);
  const price = constraints.find(
    (row) => row.conname === "packages_price_centavos_check",
  )?.definition;
  assert.match(price, /price_centavos >= 0/);
  const categoryCode = constraints.find(
    (row) => row.conname === "room_categories_code_check",
  )?.definition;
  assert.match(categoryCode, /double_standard/);
  assert.match(categoryCode, /family_executive/);
  const operationalState = constraints.find(
    (row) => row.conname === "rooms_operational_state_check",
  )?.definition;
  for (const state of [
    "unverified",
    "ready",
    "occupied",
    "cleaning",
    "maintenance",
  ]) {
    assert.match(operationalState, new RegExp(state));
  }
  const categoryForeignKey = constraints.find(
    (row) => row.conname === "packages_category_id_category_code_fkey",
  )?.definition;
  assert.match(
    categoryForeignKey,
    /FOREIGN KEY \(category_id, category_code\) REFERENCES staytrack\.room_categories\(id, code\)/,
  );
  const { rows: indexes } = await pool.query(
    "select indexname, indexdef from pg_indexes where schemaname = 'staytrack' and tablename = 'packages'",
  );
  const activeDurationIndex = indexes.find(
    (row) => row.indexname === "packages_one_active_duration",
  );
  assert.ok(activeDurationIndex, "missing active package duration index");
  assert.match(activeDurationIndex.indexdef, /CREATE UNIQUE INDEX/);
  assert.match(
    activeDurationIndex.indexdef,
    /\(category_id, duration_minutes\)/,
  );
  assert.match(activeDurationIndex.indexdef, /WHERE active/);
  const { rows: privileges } = await pool.query(
    "select role_name, table_name, has_schema_privilege(role_name, 'staytrack', 'USAGE') as schema_usage, has_table_privilege(role_name, format('staytrack.%I', table_name), 'SELECT, INSERT, UPDATE, DELETE') as table_access from (values ('anon'), ('authenticated')) as roles(role_name) cross join (values ('packages'), ('room_categories'), ('rooms')) as tables(table_name)",
  );
  assert.equal(privileges.length, 6);
  for (const row of privileges) {
    assert.equal(row.schema_usage, false, `${row.role_name} has schema usage`);
    assert.equal(
      row.table_access,
      false,
      `${row.role_name} has ${row.table_name} access`,
    );
  }
  const { rows: sequencePrivileges } = await pool.query(
    "select role_name, relname, has_sequence_privilege(role_name, c.oid, 'SELECT, USAGE, UPDATE') as sequence_access from (values ('anon'), ('authenticated')) as roles(role_name) cross join pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'staytrack' and c.relkind = 'S'",
  );
  assert.ok(
    sequencePrivileges.length > 0,
    "expected catalog identity sequences",
  );
  for (const row of sequencePrivileges) {
    assert.equal(
      row.sequence_access,
      false,
      `${row.role_name} has ${row.relname} access`,
    );
  }

  console.log(
    "F02 hosted schema, constraints, seven rates, and zero rooms verified read-only",
  );
} finally {
  await closeDatabase();
}
