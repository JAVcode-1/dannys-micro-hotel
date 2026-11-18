import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";
import { Pool } from "pg";

test("isolated settings migration defaults to pending and denies client roles", async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, "TEST_DATABASE_URL is required");
  const target = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.equal(target.pathname, "/staytrack_test");
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$`);
    for (const file of [
      "20261117000100_foundation_catalog.sql",
      "20261118000200_operational_settings.sql",
    ])
      await client.query(
        readFileSync(
          new URL(`../../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    const { rows } =
      await client.query(`select cleaning_buffer_minutes, checkout_alert_minutes,
      gcash_qr_object_key, gcash_payee_label, cancellation_display_text
      from staytrack.operational_settings`);
    assert.deepEqual(rows, [
      {
        cleaning_buffer_minutes: null,
        checkout_alert_minutes: null,
        gcash_qr_object_key: null,
        gcash_payee_label: null,
        cancellation_display_text: null,
      },
    ]);
    const { rows: rights } = await client.query(`select c.relrowsecurity as rls,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated
      from pg_class c where c.oid = 'staytrack.operational_settings'::regclass`);
    assert.deepEqual(rights, [
      { rls: true, anon: false, authenticated: false },
    ]);
  } finally {
    await client.query("rollback");
    client.release();
    await pool.end();
  }
});
