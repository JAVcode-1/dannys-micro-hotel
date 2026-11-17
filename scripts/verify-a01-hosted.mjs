import assert from "node:assert/strict";
import { databasePool, closeDatabase } from "../backend/dist/database.js";

const ref = "pgbierfxeviouyjsmjnh";
const api = new URL(process.env.SUPABASE_URL);
const db = new URL(process.env.DATABASE_URL);
assert.equal(api.hostname, `${ref}.supabase.co`);
assert.ok(
  db.hostname === `db.${ref}.supabase.co` ||
    (db.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(db.username) === `postgres.${ref}`),
  "Database target differs from approved project",
);

const pool = databasePool();
try {
  const { rows: versions } = await pool.query(
    "select version from supabase_migrations.schema_migrations order by version",
  );
  assert.deepEqual(
    versions.map(({ version }) => version),
    ["20261117000100", "20261118000100"],
  );
  const { rows: tables } = await pool.query(`
    select c.relname, c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') anon_access,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') authenticated_access
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'staytrack' and c.relname in ('staff_accounts', 'staff_audit')
    order by c.relname`);
  assert.deepEqual(
    tables.map(({ relname }) => relname),
    ["staff_accounts", "staff_audit"],
  );
  for (const table of tables) {
    assert.equal(table.relrowsecurity, true);
    assert.equal(table.anon_access, false);
    assert.equal(table.authenticated_access, false);
  }
  const { rows: policies } = await pool.query(
    "select tablename from pg_policies where schemaname = 'staytrack' and tablename in ('staff_accounts', 'staff_audit')",
  );
  assert.equal(policies.length, 0);
  const { rows: grants } = await pool.query(`
    select has_schema_privilege('anon', 'staytrack', 'USAGE') anon_schema,
      has_schema_privilege('authenticated', 'staytrack', 'USAGE') authenticated_schema,
      has_sequence_privilege('anon', 'staytrack.staff_audit_id_seq', 'USAGE,SELECT,UPDATE') anon_sequence,
      has_sequence_privilege('authenticated', 'staytrack.staff_audit_id_seq', 'USAGE,SELECT,UPDATE') authenticated_sequence`);
  for (const value of Object.values(grants[0])) assert.equal(value, false);
  for (const role of ["anon", "authenticated"]) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(`SET LOCAL ROLE ${role}`);
      await assert.rejects(
        client.query("select * from staytrack.staff_accounts limit 1"),
        (error) => error.code === "42501",
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }
  const { rows: constraints } = await pool.query(`
    select conname from pg_constraint
    where conrelid in ('staytrack.staff_accounts'::regclass, 'staytrack.staff_audit'::regclass)`);
  const names = new Set(constraints.map(({ conname }) => conname));
  for (const name of [
    "staff_accounts_pkey",
    "staff_accounts_auth_user_id_fkey",
    "staff_audit_pkey",
  ])
    assert.ok(names.has(name), `Missing ${name}`);
  const { rows: columns } = await pool.query(`
    select column_default, is_nullable from information_schema.columns
    where table_schema = 'staytrack' and table_name = 'staff_accounts' and column_name = 'active'`);
  assert.equal(columns.length, 1);
  assert.equal(columns[0].column_default, "false");
  assert.equal(columns[0].is_nullable, "NO");
  const { rows: counts } = await pool.query(`
    select (select count(*) from staytrack.staff_accounts)::int accounts,
      (select count(*) from staytrack.staff_audit)::int audits`);
  console.log(
    "A01 hosted versions, tables, RLS, grants, constraints, and inactive default verified",
  );
  console.log(
    `Existing staff rows: ${counts[0].accounts}; audit rows: ${counts[0].audits}`,
  );
} finally {
  await closeDatabase();
}
