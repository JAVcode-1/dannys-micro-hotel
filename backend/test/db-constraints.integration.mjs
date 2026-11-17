import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";
import { Pool } from "pg";

const connectionString = process.env.TEST_DATABASE_URL;

test("isolated PostgreSQL rejects a Family Executive 3-hour package", async () => {
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
  try {
    await client.query("BEGIN");
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$`);
    const migration = readFileSync(
      new URL(
        "../../supabase/migrations/20261117000100_foundation_catalog.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await client.query(migration);
    await client.query("SAVEPOINT invalid_package");
    const category = await client.query(
      "SELECT id FROM staytrack.room_categories WHERE code = $1",
      ["family_executive"],
    );
    await assert.rejects(
      client.query(
        "INSERT INTO staytrack.packages (category_id, category_code, duration_minutes, price_centavos) VALUES ($1, $2, $3, $4)",
        [category.rows[0].id, "family_executive", 180, 20000],
      ),
      (error) =>
        error.code === "23514" &&
        error.constraint === "valid_category_duration",
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_package");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
