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
    await client.query("INSERT INTO auth.users (id) VALUES ($1), ($2)", [
      first,
      second,
    ]);
    await client.query(
      "INSERT INTO staytrack.staff_accounts (auth_user_id, active) VALUES ($1, true), ($2, false)",
      [first, second],
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
