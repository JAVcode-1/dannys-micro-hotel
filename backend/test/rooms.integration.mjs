import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";
import { Pool } from "pg";

test("isolated database holds ten Double and five Family test rooms", async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, "TEST_DATABASE_URL is required");
  const target = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.equal(target.pathname, "/staytrack_test");
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("create schema if not exists auth");
    await client.query(
      readFileSync(
        new URL(
          "../../supabase/migrations/20261117000100_foundation_catalog.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const [category, prefix, count] of [
      ["double_standard", "DS-TEST", 10],
      ["family_executive", "FE-TEST", 5],
    ]) {
      for (let index = 1; index <= count; index++) {
        await client.query(
          `insert into staytrack.rooms (category_id, code)
          select id, $2 from staytrack.room_categories where code = $1`,
          [category, `${prefix}-${String(index).padStart(2, "0")}`],
        );
      }
    }
    const { rows } = await client.query(`select c.code, count(*)::int as total,
      bool_and(r.active = false and r.operational_state = 'unverified') as safe
      from staytrack.rooms r join staytrack.room_categories c on c.id = r.category_id group by c.code order by c.code`);
    assert.deepEqual(rows, [
      { code: "double_standard", total: 10, safe: true },
      { code: "family_executive", total: 5, safe: true },
    ]);
  } finally {
    await client.query("rollback");
    client.release();
    await pool.end();
  }
});
