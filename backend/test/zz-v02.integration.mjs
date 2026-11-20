import { h03AuditPostgres } from "./h03-audit-postgres.mjs";
import { h02Postgres } from "./h02-postgres.mjs";
import { x03Postgres, x03Behavior } from "./x03-postgres.mjs";
import { h01Postgres } from "./h01-postgres.mjs";
import { x02Postgres } from "./x02-postgres.mjs";
import { x01Postgres } from "./x01-postgres.mjs";
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
import { createGuestHold, guestReservations } from "../dist/guest-booking.js";
import { o02Postgres } from "./o02-postgres.mjs";
import { o03Postgres } from "./o03-postgres.mjs";
import { w01Postgres } from "./w01-postgres.mjs";

test("isolated PostgreSQL serializes thirty capacity contenders and replays idempotently", async (t) => {
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
    await t.test(
      "O01 PostgreSQL: guest multi-room migration, schedules, snapshots, ownership, rollback and Family extra bed",
      async () => {
        // O01 uses only this disposable loopback database, never hosted inventory.
        for (const file of [
          "20261118000200_operational_settings.sql",
          "20261118000500_guest_multi_room_booking.sql",
        ])
          await pool.query(
            readFileSync(
              new URL(`../../supabase/migrations/${file}`, import.meta.url),
              "utf8",
            ),
          );
        await pool.query(
          "update staytrack.operational_settings set cleaning_buffer_minutes = 15",
        );
        await pool.query(`insert into staytrack.rooms(category_id, code, operational_state, active)
      select id, 'FE-TEST-O01', 'ready', true from staytrack.room_categories where code = 'family_executive'`);
        const guest = {
          id: "11111111-1111-4111-8111-111111111111",
          email: "owner@example.test",
        };
        const other = {
          id: "22222222-2222-4222-8222-222222222222",
          email: "other@example.test",
        };
        const arrival = Date.now() + 7 * 86400000;
        const at = (offset) =>
          new Date(Math.ceil((arrival + offset) / 60000) * 60000).toISOString();
        const cart = [
          {
            category: "double_standard",
            startAt: at(0),
            blocks: [180],
            adults: 2,
            children: 0,
            extraBed: false,
          },
          {
            category: "family_executive",
            startAt: at(86400000),
            blocks: [1440, 1440],
            adults: 5,
            children: 1,
            extraBed: true,
          },
        ];
        const hold = await createGuestHold(
          guest,
          "o01-mixed-request-001",
          "Test Guest",
          cart,
          pool,
        );
        assert.equal(hold.replayed, false);
        let stored = await guestReservations(guest, pool);
        assert.equal(stored.length, 1);
        assert.equal(stored[0].totalCentavos, 270000);
        assert.equal(stored[0].items.length, 2);
        assert.notEqual(stored[0].items[0].startAt, stored[0].items[1].startAt);
        assert.equal(
          Date.parse(stored[0].items[0].startAt),
          Date.parse(cart[0].startAt),
        );
        assert.equal(
          Date.parse(stored[0].items[0].endAt),
          Date.parse(cart[0].startAt) + 180 * 60000,
        );
        assert.equal(
          Date.parse(stored[0].items[1].startAt),
          Date.parse(cart[1].startAt),
        );
        assert.equal(
          Date.parse(stored[0].items[1].endAt),
          Date.parse(cart[1].startAt) + 2880 * 60000,
        );
        const prices = await pool.query(
          `select category_code, base_centavos::int, extra_bed_centavos::int, total_centavos::int
      from staytrack.room_bookings where reservation_id = $1 order by item_index`,
          [hold.id],
        );
        assert.deepEqual(prices.rows, [
          {
            category_code: "double_standard",
            base_centavos: 20000,
            extra_bed_centavos: 0,
            total_centavos: 20000,
          },
          {
            category_code: "family_executive",
            base_centavos: 240000,
            extra_bed_centavos: 10000,
            total_centavos: 250000,
          },
        ]);
        assert.ok(stored[0].items.every((item) => item.state === "held"));
        assert.deepEqual(await guestReservations(other, pool), []);
        assert.deepEqual(
          await guestReservations({ ...guest, email: other.email }, pool),
          [],
        );
        await pool.query(
          "update staytrack.packages set price_centavos = 30000 where category_code = 'double_standard' and duration_minutes = 180 and active",
        );
        assert.deepEqual(
          await createGuestHold(
            guest,
            "o01-mixed-request-001",
            "Test Guest",
            cart,
            pool,
          ),
          { id: hold.id, replayed: true },
        );
        stored = await guestReservations(guest, pool);
        assert.equal(stored[0].totalCentavos, 270000);
        const snapshot = await pool.query(
          "select pricing_snapshot from staytrack.room_bookings where reservation_id = $1 and item_index = 0",
          [hold.id],
        );
        assert.equal(snapshot.rows[0].pricing_snapshot[0].priceCentavos, 20000);
        await assert.rejects(
          pool.query(
            "update staytrack.room_bookings set base_centavos = base_centavos + 1 where reservation_id = $1",
            [hold.id],
          ),
          /immutable/,
        );
        await assert.rejects(
          createGuestHold(
            guest,
            "o01-mixed-request-001",
            "Test Guest",
            [cart[0]],
            pool,
          ),
          /different booking/,
        );
        const before = await pool.query(
          "select count(*)::int as count from staytrack.inventory_claims",
        );
        await assert.rejects(
          createGuestHold(
            other,
            "o01-no-capacity-001",
            "Other",
            [cart[0], cart[0]],
            pool,
          ),
          /no longer available/,
        );
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as count from staytrack.inventory_claims",
            )
          ).rows[0].count,
          before.rows[0].count,
        );
        // Force failure after claims exist: the entire reservation and new claims roll back.
        await pool.query(`create function staytrack.o01_test_fail() returns trigger language plpgsql as $$ begin raise exception 'test item failure'; end $$;
      create trigger o01_test_fail before insert on staytrack.room_bookings for each row execute function staytrack.o01_test_fail()`);
        await assert.rejects(
          createGuestHold(
            other,
            "o01-item-rollback-001",
            "Other",
            [{ ...cart[0], startAt: at(10 * 86400000) }],
            pool,
          ),
          /test item failure/,
        );
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as count from staytrack.inventory_claims",
            )
          ).rows[0].count,
          before.rows[0].count,
        );
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as count from staytrack.reservations",
            )
          ).rows[0].count,
          1,
        );
        await pool.query(
          "drop trigger o01_test_fail on staytrack.room_bookings; drop function staytrack.o01_test_fail()",
        );
        const deniedO01 = await pool.query(`select c.relrowsecurity as rls,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated
      from pg_class c where c.oid in ('staytrack.reservations'::regclass, 'staytrack.room_bookings'::regclass)`);
        assert.deepEqual(deniedO01.rows, [
          { rls: true, anon: false, authenticated: false },
          { rls: true, anon: false, authenticated: false },
        ]);
      },
    );
    await o02Postgres(t, pool);
    await o03Postgres(t, pool);
    await w01Postgres(t, pool);
    await x01Postgres(t, pool);
    await x02Postgres(t, pool);
    await x03Postgres(t, pool);
    await x03Behavior(t, pool);
    await h01Postgres(t, pool);
    await h02Postgres(t, pool);
    await h03AuditPostgres(t, pool);
  } finally {
    await pool.end();
  }
});
