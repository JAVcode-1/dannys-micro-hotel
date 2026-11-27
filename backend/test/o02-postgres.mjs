/* global fetch */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import { createApp } from "../dist/app.js";
import { createGuestHold } from "../dist/guest-booking.js";
import {
  configurePaymentQr,
  guestPaymentSession,
  submitPaymentProof,
  duePaymentReminders,
} from "../dist/payment-proofs.js";
import { expireClaims } from "../dist/claim-holds.js";

export async function o02Postgres(t, pool) {
  await t.test(
    "O02 PostgreSQL: private QR/proof, ownership, atomic pending review, deadlines and reminder schedule",
    async () => {
      // CI-only Storage catalog substitute. Actual hosted Storage behavior is a separate acceptance gate.
      await pool.query(`create schema auth; create table auth.users(id uuid primary key);
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id));
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      create policy test_broad_access on storage.objects for all to anon, authenticated using (true) with check (true)`);
      for (const file of [
        "20261118000100_staff_identities.sql",
        "20261118000600_payment_proof_submission.sql",
        "20261127003600_receipt_only_guest_proof.sql",
      ])
        await pool.query(
          readFileSync(
            new URL(`../../supabase/migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
      const rights = await pool.query(`select c.relrowsecurity as rls,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated
      from pg_class c where c.oid in ('staytrack.payment_qr'::regclass, 'staytrack.payment_submissions'::regclass, 'staytrack.payment_reminders'::regclass)`);
      assert.equal(rights.rows.length, 3);
      assert.ok(
        rights.rows.every((row) => row.rls && !row.anon && !row.authenticated),
      );
      assert.ok(
        (await pool.query("select public from storage.buckets")).rows.every(
          (row) => !row.public,
        ),
      );
      await pool.query(
        "insert into storage.objects(bucket_id) values ('payment-proofs'), ('payment-qr')",
      );
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("set local role authenticated");
        assert.equal(
          (await client.query("select * from storage.objects")).rowCount,
          0,
        );
        await assert.rejects(
          client.query(
            "insert into storage.objects(bucket_id) values ('payment-proofs')",
          ),
          /row-level security/,
        );
      } finally {
        await client.query("rollback");
        client.release();
      }
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
        "base64",
      );
      const uploads = new Map();
      const store = {
        async upload(bucket, key, bytes, mime) {
          assert.ok(["payment-qr", "payment-proofs"].includes(bucket));
          assert.equal(mime, "image/png");
          uploads.set(key, bytes);
        },
        async remove(_bucket, key) {
          uploads.delete(key);
        },
        async signedUrl(bucket, key) {
          assert.equal(bucket, "payment-qr");
          assert.ok(uploads.has(key));
          return "https://storage.example.test/signed-qr";
        },
      };
      const actor = "33333333-3333-4333-8333-333333333333";
      await pool.query(
        "insert into auth.users(id) values($1) on conflict do nothing",
        [actor],
      );
      await pool.query(
        "insert into staytrack.staff_accounts(auth_user_id,active) values($1,true) on conflict(auth_user_id) do update set active=true",
        [actor],
      );
      await configurePaymentQr(
        actor,
        "TEST PAYEE ONLY",
        png,
        "image/png",
        pool,
        store,
      );
      assert.equal(
        (
          await pool.query(
            "select actor_auth_user_id from staytrack.staff_audit where action = 'payment.qr_configured'",
          )
        ).rows[0].actor_auth_user_id,
        actor,
      );
      const guest = {
        id: "11111111-1111-4111-8111-111111111111",
        email: "owner@example.test",
      };
      const other = {
        id: "22222222-2222-4222-8222-222222222222",
        email: "other@example.test",
      };
      const start = Math.ceil((Date.now() + 30 * 86400000) / 60000) * 60000;
      const cart = [
        {
          category: "double_standard",
          startAt: new Date(start).toISOString(),
          blocks: [360],
          adults: 2,
          children: 0,
          extraBed: false,
        },
        {
          category: "family_executive",
          startAt: new Date(start + 86400000).toISOString(),
          blocks: [1440, 1440],
          adults: 3,
          children: 1,
          extraBed: true,
        },
      ];
      const make = (key, offset) =>
        createGuestHold(
          guest,
          key,
          "O02 TEST GUEST",
          cart.map((item) => ({
            ...item,
            startAt: new Date(
              Date.parse(item.startAt) + offset * 86400000,
            ).toISOString(),
          })),
          pool,
        );
      const hold = await make("o02-private-proof-001", 0);
      const session = await guestPaymentSession(guest, hold.id, pool, store);
      assert.equal(session.amountDueCentavos, 290000);
      assert.equal(session.status, "awaiting_proof");
      assert.equal(session.qrUrl, "https://storage.example.test/signed-qr");
      assert.equal(session.emailDeliveryEnabled, false);
      const reminders = await pool.query(
        `select minute_offset, extract(epoch from (i.proof_deadline_at - m.due_at))::int as seconds
      from staytrack.payment_reminders m join staytrack.reservations r on r.id = m.reservation_id
      join staytrack.inventory_claims i on i.idempotency_key = r.idempotency_key
      where r.id = $1 order by minute_offset, i.id`,
        [hold.id],
      );
      assert.deepEqual(
        reminders.rows.map((row) => row.seconds),
        [900, 900, 300, 300],
      );
      await assert.rejects(
        guestPaymentSession(other, hold.id, pool, store),
        /not found/,
      );
      const before = uploads.size;
      await assert.rejects(
        submitPaymentProof(
          other,
          hold.id,
          "0200000001",
          png,
          "image/png",
          pool,
          store,
        ),
        /not found/,
      );
      assert.equal(uploads.size, before);
      await assert.rejects(
        submitPaymentProof(guest, hold.id, "", png, "image/png", pool, store),
        /reference/,
      );
      await assert.rejects(
        submitPaymentProof(
          guest,
          hold.id,
          "0200000001",
          Buffer.from("bad"),
          "image/png",
          pool,
          store,
        ),
        /PNG/,
      );
      // Failure after the upload cannot leave partial claim protection or a submission row.
      await pool.query(`create function staytrack.o02_test_fail() returns trigger language plpgsql as $$ begin raise exception 'test proof failure'; end $$;
      create trigger o02_test_fail before update on staytrack.inventory_claims for each row execute function staytrack.o02_test_fail()`);
      await assert.rejects(
        submitPaymentProof(
          guest,
          hold.id,
          "0200000001",
          png,
          "image/png",
          pool,
          store,
        ),
        /test proof failure/,
      );
      assert.equal(uploads.size, before);
      assert.equal(
        (
          await pool.query(
            "select * from staytrack.payment_submissions where reservation_id = $1",
            [hold.id],
          )
        ).rowCount,
        0,
      );
      assert.ok(
        (
          await pool.query(
            "select i.state from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id = i.id where b.reservation_id = $1",
            [hold.id],
          )
        ).rows.every((row) => row.state === "held"),
      );
      await pool.query(
        "drop trigger o02_test_fail on staytrack.inventory_claims; drop function staytrack.o02_test_fail()",
      );
      const app = createApp(
        async () => {},
        async () => ({ id: actor, email: null }),
        async () => {},
        async (token) => (token === "owner" ? guest : other),
        { pool, store, guestEnabled: true },
      );
      const server = app.listen(0, "127.0.0.1");
      try {
        await new Promise((resolve) => server.once("listening", resolve));
        const base = `http://127.0.0.1:${server.address().port}/guest/payments/${hold.id}`;
        assert.equal(
          (await fetch(base, { headers: { Authorization: "Bearer other" } }))
            .status,
          404,
        );
        const unauthorized = await fetch(`${base}/proof`, {
          method: "POST",
          headers: {
            Authorization: "Bearer other",
            "Content-Type": "image/png",
          },
          body: png,
        });
        assert.equal(unauthorized.status, 404);
        const accepted = await fetch(`${base}/proof`, {
          method: "POST",
          headers: {
            Authorization: "Bearer owner",
            "Content-Type": "image/png",
          },
          body: png,
        });
        assert.equal(accepted.status, 200);
        assert.deepEqual(await accepted.json(), {
          status: "pending_review",
          replayed: false,
        });
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
      assert.deepEqual(
        await submitPaymentProof(
          guest,
          hold.id,
          null,
          png,
          "image/png",
          pool,
          store,
        ),
        { status: "pending_review", replayed: true },
      );
      await assert.rejects(
        submitPaymentProof(
          guest,
          hold.id,
          "0200000002",
          png,
          "image/png",
          pool,
          store,
        ),
        /already submitted/,
      );
      assert.equal(uploads.size, before + 1);
      const saved = await pool.query(
        "select status, transaction_reference, amount_due_centavos::int from staytrack.payment_submissions where reservation_id = $1",
        [hold.id],
      );
      assert.deepEqual(saved.rows, [
        {
          status: "pending_review",
          transaction_reference: null,
          amount_due_centavos: 290000,
        },
      ]);
      assert.equal(
        (await guestPaymentSession(guest, hold.id, pool, store)).status,
        "pending_review",
      );
      assert.equal(
        (
          await pool.query(
            "select state from staytrack.payment_reminders where reservation_id = $1",
            [hold.id],
          )
        ).rows.filter((row) => row.state === "scheduled").length,
        0,
      );
      // Minute-90 cleanup cannot release submitted proof's capacity; neither item is confirmed.
      await expireClaims(Date.now() + 90 * 60000, pool);
      const claims = await pool.query(
        "select i.state, b.status from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id = i.id where b.reservation_id = $1",
        [hold.id],
      );
      assert.deepEqual(claims.rows, [
        { state: "proof_pending_review", status: "pending" },
        { state: "proof_pending_review", status: "pending" },
      ]);
      const late = await make("o02-expired-proof-001", 10);
      await pool.query(
        "update staytrack.inventory_claims set proof_deadline_at = clock_timestamp() - interval '1 minute' where idempotency_key = (select idempotency_key from staytrack.reservations where id = $1)",
        [late.id],
      );
      await expireClaims(Date.now(), pool);
      await assert.rejects(
        submitPaymentProof(
          guest,
          late.id,
          "0200000003",
          png,
          "image/png",
          pool,
          store,
        ),
        /deadline has passed/,
      );
      assert.equal(
        (await guestPaymentSession(guest, late.id, pool, store)).status,
        "expired",
      );
      assert.equal(
        (
          await pool.query(
            "select * from staytrack.payment_submissions where reservation_id = $1",
            [late.id],
          )
        ).rowCount,
        0,
      );
      assert.deepEqual(await duePaymentReminders(pool), []);
    },
  );
}
