import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";
import { Pool } from "pg";
import {
  createClaims,
  releaseClaims,
  revalidateClaim,
} from "../dist/inventory-claims.js";
import {
  expireClaims,
  submitClaimProof,
  reviewAge,
} from "../dist/claim-holds.js";

test("isolated PostgreSQL serializes thirty capacity contenders and replays idempotently", async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, "TEST_DATABASE_URL is required");
  const target = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.equal(target.pathname, "/staytrack_test");
  const pool = new Pool({ connectionString, max: 32 });
  try {
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$`);
    for (const file of [
      "20261117000100_foundation_catalog.sql",
      "20261118000300_inventory_claims.sql",
      "20261118000400_claim_hold_lifecycle.sql",
    ])
      await pool.query(
        readFileSync(
          new URL(`../../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await pool.query(`insert into staytrack.rooms(category_id, code, operational_state, active)
      select id, 'DS-TEST-V02', 'ready', true from staytrack.room_categories
      where code = 'double_standard'`);
    const start = Date.UTC(2026, 10, 18, 10);
    const item = {
      category: "double_standard",
      start,
      end: start + 60 * 60000,
      bufferMinutes: 15,
    };
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        createClaims(
          `test-v02-contender-${String(index).padStart(3, "0")}`,
          [item],
          pool,
        ),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === "created").length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === "unavailable").length,
      29,
    );
    const winner = results.findIndex((result) => result.status === "created");
    const key = `test-v02-contender-${String(winner).padStart(3, "0")}`;
    assert.deepEqual(await createClaims(key, [item], pool), {
      status: "replayed",
      ids: results[winner].ids,
    });
    await assert.rejects(
      createClaims(key, [{ ...item, end: item.end + 60000 }], pool),
      /Idempotency key reused/,
    );
    const { rows } = await pool.query(
      "select count(*)::int as count from staytrack.inventory_claims where state = 'held'",
    );
    assert.equal(rows[0].count, 1);
    const denied = await pool.query(`select c.relrowsecurity as rls,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated
      from pg_class c where c.oid = 'staytrack.inventory_claims'::regclass`);
    assert.deepEqual(denied.rows, [
      { rls: true, anon: false, authenticated: false },
    ]);
    const claimId = results[winner].ids[0];
    const roomId = Number(
      (
        await pool.query(
          "select id from staytrack.rooms where code = 'DS-TEST-V02'",
        )
      ).rows[0].id,
    );
    assert.equal(
      await revalidateClaim(
        claimId,
        {
          start,
          end: item.end + 30 * 60000,
          bufferMinutes: 15,
          roomId,
          state: "confirmed",
        },
        pool,
      ),
      true,
    );
    assert.equal(
      await revalidateClaim(
        claimId,
        {
          start,
          end: item.end,
          bufferMinutes: 15,
          roomId,
          state: "held",
        },
        pool,
      ),
      false,
    );
    assert.equal(await releaseClaims(key, pool), true);
    assert.equal(await releaseClaims(key, pool), true);
    assert.equal(
      (await createClaims("test-v02-after-release", [item], pool)).status,
      "created",
    );
    const heldId = (
      await pool.query(
        "select id from staytrack.inventory_claims where idempotency_key = 'test-v02-after-release'",
      )
    ).rows[0].id;
    const fakeNow = Date.UTC(2026, 10, 18, 12);
    await pool.query(
      "update staytrack.inventory_claims set proof_deadline_at = $2 where id = $1",
      [heldId, new Date(fakeNow)],
    );
    assert.equal(await expireClaims(fakeNow, pool), 1);
    assert.equal(await expireClaims(fakeNow, pool), 0);
    assert.equal(
      await submitClaimProof(Number(heldId), fakeNow + 1, pool),
      "late_reconciliation",
    );
    const protectedClaim = await createClaims(
      "test-v03-proof-protected",
      [item],
      pool,
    );
    assert.equal(protectedClaim.status, "created");
    const protectedId = protectedClaim.ids[0];
    await pool.query(
      "update staytrack.inventory_claims set proof_deadline_at = $2 where id = $1",
      [protectedId, new Date(fakeNow + 29 * 60000)],
    );
    assert.equal(
      await submitClaimProof(protectedId, fakeNow + 29 * 60000, pool),
      "protected",
    );
    assert.equal(await expireClaims(fakeNow + 90 * 60000, pool), 0);
    assert.equal(
      reviewAge(fakeNow + 29 * 60000, fakeNow + 90 * 60000),
      "critical",
    );
    assert.equal(await releaseClaims("test-v03-proof-protected", pool), true);
    assert.equal(
      (
        await pool.query(
          "select state from staytrack.inventory_claims where id = $1",
          [protectedId],
        )
      ).rows[0].state,
      "proof_pending_review",
    );
  } finally {
    await pool.end();
  }
});
