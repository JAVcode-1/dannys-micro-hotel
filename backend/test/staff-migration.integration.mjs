import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";
import { Pool } from "pg";

test("isolated PostgreSQL applies A01 with private staff access and retained audits", async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    "TEST_DATABASE_URL is required for isolated DB tests",
  );
  const url = new URL(connectionString);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.equal(url.pathname, "/staytrack_test");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  const first = "00000000-0000-4000-8000-000000000001";
  const second = "00000000-0000-4000-8000-000000000002";
  try {
    await client.query("BEGIN");
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$`);
    await client.query("CREATE SCHEMA auth");
    await client.query("CREATE TABLE auth.users (id uuid PRIMARY KEY)");
    const foundation = readFileSync(
      new URL(
        "../../supabase/migrations/20261117000100_foundation_catalog.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const migration = readFileSync(
      new URL(
        "../../supabase/migrations/20261118000100_staff_identities.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await client.query(foundation);
    await client.query(migration);
    const security = await client.query(`
      SELECT c.relname, c.relrowsecurity,
        has_schema_privilege('anon', 'staytrack', 'USAGE') AS anon_schema,
        has_schema_privilege('authenticated', 'staytrack', 'USAGE') AS authenticated_schema,
        has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_table,
        has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_table
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'staytrack' AND c.relname IN ('staff_accounts', 'staff_audit')
      ORDER BY c.relname`);
    assert.deepEqual(
      security.rows.map((row) => row.relname),
      ["staff_accounts", "staff_audit"],
    );
    for (const row of security.rows) {
      assert.equal(row.relrowsecurity, true);
      assert.equal(row.anon_schema, false);
      assert.equal(row.authenticated_schema, false);
      assert.equal(row.anon_table, false);
      assert.equal(row.authenticated_table, false);
    }
    const sequence = await client.query(`SELECT
      has_sequence_privilege('anon', 'staytrack.staff_audit_id_seq', 'USAGE,SELECT,UPDATE') AS anon,
      has_sequence_privilege('authenticated', 'staytrack.staff_audit_id_seq', 'USAGE,SELECT,UPDATE') AS authenticated`);
    assert.equal(sequence.rows[0].anon, false);
    assert.equal(sequence.rows[0].authenticated, false);
    await client.query("INSERT INTO auth.users (id) VALUES ($1), ($2)", [
      first,
      second,
    ]);
    const inactiveByDefault = await client.query(
      "INSERT INTO staytrack.staff_accounts (auth_user_id) VALUES ($1) RETURNING active",
      [second],
    );
    assert.equal(inactiveByDefault.rows[0].active, false);
    await client.query(
      "INSERT INTO staytrack.staff_accounts (auth_user_id, active) VALUES ($1, true)",
      [first],
    );
    const active = await client.query(
      "SELECT auth_user_id FROM staytrack.staff_accounts WHERE auth_user_id = $1 AND active = true",
      [first],
    );
    const disabled = await client.query(
      "SELECT auth_user_id FROM staytrack.staff_accounts WHERE auth_user_id = $1 AND active = true",
      [second],
    );
    assert.equal(active.rowCount, 1);
    assert.equal(disabled.rowCount, 0);
    await client.query(
      "INSERT INTO staytrack.staff_audit (actor_auth_user_id, action) VALUES ($1, 'staff.session_verified')",
      [first],
    );
    await client.query("SAVEPOINT denied_staff_read");
    await client.query("SET LOCAL ROLE authenticated");
    await assert.rejects(
      client.query("SELECT * FROM staytrack.staff_accounts"),
      (error) => error.code === "42501",
    );
    await client.query("ROLLBACK TO SAVEPOINT denied_staff_read");
    await client.query("SAVEPOINT rls_check");
    await client.query("GRANT USAGE ON SCHEMA staytrack TO authenticated");
    await client.query(
      "GRANT ALL ON staytrack.staff_accounts, staytrack.staff_audit TO authenticated",
    );
    await client.query("SET LOCAL ROLE authenticated");
    for (const table of ["staff_accounts", "staff_audit"]) {
      const visible = await client.query(`SELECT * FROM staytrack.${table}`);
      assert.equal(visible.rowCount, 0);
    }
    await client.query("RESET ROLE");
    await client.query("ROLLBACK TO SAVEPOINT rls_check");
    await client.query("DELETE FROM auth.users WHERE id = $1", [first]);
    const retained = await client.query(
      "SELECT actor_auth_user_id FROM staytrack.staff_audit WHERE actor_auth_user_id = $1",
      [first],
    );
    assert.equal(retained.rowCount, 1);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
