import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import { createGuestHold } from "../dist/guest-booking.js";
import { submitPaymentProof } from "../dist/payment-proofs.js";
import {
  decidePaymentReview,
  staffPaymentReviews,
} from "../dist/payment-review.js";
import { expireClaims } from "../dist/claim-holds.js";

export async function o03Postgres(t, pool) {
  await t.test(
    "O03 PostgreSQL: atomic manual confirmation, duplicate references, conflicts, reconciliation, outbox rollback and immutable snapshots",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261119000700_staff_payment_review.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const actor = "33333333-3333-4333-8333-333333333333";
      await pool.query(
        "insert into auth.users(id) values ($1) on conflict do nothing",
        [actor],
      );
      await pool.query(
        "insert into staytrack.staff_accounts(auth_user_id,active) values ($1,true) on conflict(auth_user_id) do update set active=true",
        [actor],
      );
      await pool.query(
        "update staytrack.operational_settings set cancellation_display_text='TEST ONLY: free cancellation within one hour after confirmation and before that room checks in; manual refund.'",
      );
      const rights =
        await pool.query(`select c.relrowsecurity as rls,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated from pg_class c
      where c.oid in ('staytrack.payment_reviews'::regclass,'staytrack.verified_online_payments'::regclass,'staytrack.payment_notification_outbox'::regclass)`);
      assert.equal(rights.rowCount, 3);
      assert.ok(
        rights.rows.every((row) => row.rls && !row.anon && !row.authenticated),
      );
      const guest = {
        id: "11111111-1111-4111-8111-111111111111",
        email: "owner@example.test",
      };
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
        "base64",
      );
      const store = {
        async upload() {},
        async remove() {},
        async signedUrl() {
          throw new Error("not needed");
        },
      };
      let counter = 0;
      async function make(reference) {
        counter++;
        const start =
          Math.ceil((Date.now() + (180 + counter * 4) * 86400000) / 60000) *
          60000;
        const hold = await createGuestHold(
          guest,
          `o03-postgres-booking-${String(counter).padStart(4, "0")}`,
          "O03 SYNTHETIC GUEST",
          [
            {
              category: "double_standard",
              startAt: new Date(start).toISOString(),
              blocks: [180],
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
          ],
          pool,
        );
        const receivedAt = new Date(Date.now() - 60000).toISOString();
        await submitPaymentProof(
          guest,
          hold.id,
          reference,
          png,
          "image/png",
          pool,
          store,
        );
        const submission = (
          await pool.query(
            "select id from staytrack.payment_submissions where reservation_id=$1",
            [hold.id],
          )
        ).rows[0];
        const input = {
          decision: "confirmed",
          expectedVersion: 0,
          requestKey: `o03-review-request-${String(counter).padStart(4, "0")}`,
          note: "TEST ONLY actual account checks simulated, never real money.",
          verification: {
            ledgerChecked: true,
            receivingAccountChecked: true,
            timeChecked: true,
            reference,
            recipient: "TEST PAYEE ONLY",
            // O01 deliberately revised the Standard 3h rate to 30000 earlier in this fixture.
            amountCentavos: 280000,
            receivedAt,
          },
        };
        return { id: submission.id, reservationId: hold.id, input };
      }
      const decide = (record, input = record.input) =>
        decidePaymentReview(actor, record.id, input, pool);
      const items = async (record) =>
        (
          await pool.query(
            "select id,start_at,end_at,pricing_snapshot,base_centavos,extra_bed_centavos,total_centavos from staytrack.room_bookings where reservation_id=$1 order by item_index",
            [record.reservationId],
          )
        ).rows;
      const state = async (record) =>
        (
          await pool.query(
            "select i.state,b.status from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.reservation_id=$1 order by b.item_index",
            [record.reservationId],
          )
        ).rows;
      const confirmed = await make("0300000001");
      const before = await items(confirmed);
      await assert.rejects(
        pool.query(
          "update staytrack.reservations set online_confirmation_at=clock_timestamp() where id=$1",
          [confirmed.reservationId],
        ),
        /online_confirmation_terms/,
      );
      assert.deepEqual(await decide(confirmed), {
        status: "confirmed",
        version: 1,
        replayed: false,
      });
      assert.deepEqual(await state(confirmed), [
        { state: "confirmed", status: "confirmed" },
        { state: "confirmed", status: "confirmed" },
      ]);
      assert.deepEqual(await items(confirmed), before);
      const reservation = (
        await pool.query(
          "select online_confirmation_at,cancellation_terms_snapshot,total_centavos from staytrack.reservations where id=$1",
          [confirmed.reservationId],
        )
      ).rows[0];
      assert.ok(reservation.online_confirmation_at);
      assert.match(reservation.cancellation_terms_snapshot, /one hour/);
      assert.equal(reservation.total_centavos, "280000");
      const outbox = (
        await pool.query(
          "select state,payload from staytrack.payment_notification_outbox where reservation_id=$1",
          [confirmed.reservationId],
        )
      ).rows[0];
      assert.equal(outbox.state, "pending");
      assert.equal(outbox.payload.items.length, 2);
      assert.equal(outbox.payload.amountCentavos, 280000);
      assert.deepEqual(await decide(confirmed), {
        status: "confirmed",
        version: 1,
        replayed: true,
      });
      await assert.rejects(
        decide(confirmed, { ...confirmed.input, note: "Changed" }),
        /Request key/,
      );
      await assert.rejects(
        decide(confirmed, {
          ...confirmed.input,
          requestKey: "o03-new-confirm-request",
          expectedVersion: 1,
        }),
        /already confirmed/,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.payment_reviews where submission_id=$1",
            [confirmed.id],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.reservations set online_confirmation_at=online_confirmation_at+interval '1 hour' where id=$1",
          [confirmed.reservationId],
        ),
        /immutable/,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.room_bookings set total_centavos=total_centavos where reservation_id=$1",
          [confirmed.reservationId],
        ),
        /immutable/,
      );
      await assert.rejects(
        pool.query(
          "delete from staytrack.verified_online_payments where submission_id=$1",
          [confirmed.id],
        ),
        /immutable/,
      );

      const duplicate = await make("0300000001");
      assert.equal(
        (await staffPaymentReviews(pool)).find((row) => row.id === duplicate.id)
          .duplicateReference,
        true,
      );
      await assert.rejects(decide(duplicate), /already verified/);
      assert.ok(
        (await state(duplicate)).every(
          (row) =>
            row.state === "proof_pending_review" && row.status === "pending",
        ),
      );
      const races = await Promise.all([make("0300000002"), make("0300000002")]);
      const results = await Promise.allSettled(races.map((row) => decide(row)));
      assert.equal(
        results.filter((row) => row.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.filter(
          (row) => row.status === "rejected" && row.reason.status === 409,
        ).length,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.verified_online_payments where normalized_reference='0300000002'",
          )
        ).rows[0].n,
        1,
      );

      const unresolved = await make("0300000003");
      const conflict = await Promise.allSettled(
        ["unresolved", "mismatched"].map((decision, index) =>
          decide(unresolved, {
            ...unresolved.input,
            decision,
            requestKey: `o03-conflicting-request-${index}`,
          }),
        ),
      );
      assert.equal(
        conflict.filter((row) => row.status === "fulfilled").length,
        1,
      );
      assert.equal(
        conflict.filter(
          (row) => row.status === "rejected" && row.reason.status === 409,
        ).length,
        1,
      );
      await expireClaims(Date.now() + 90 * 60000, pool);
      assert.ok(
        (await state(unresolved)).every(
          (row) => row.state === "proof_pending_review",
        ),
      );
      assert.deepEqual(
        await decide(unresolved, {
          ...unresolved.input,
          expectedVersion: 1,
          requestKey: "o03-resolve-after-contact",
        }),
        { status: "confirmed", version: 2, replayed: false },
      );
      for (const [index, decision] of [
        "rejected",
        "mismatched",
        "late_reconciliation",
      ].entries()) {
        const record = await make(`030000000${7 + index}`);
        await decide(record, { ...record.input, decision });
        assert.ok(
          (await state(record)).every(
            (row) =>
              row.state === "proof_pending_review" && row.status === "pending",
          ),
        );
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as n from staytrack.verified_online_payments where submission_id=$1",
              [record.id],
            )
          ).rows[0].n,
          0,
        );
      }

      const failure = await make("0300000004");
      const auditBefore = (
        await pool.query("select count(*)::int as n from staytrack.staff_audit")
      ).rows[0].n;
      await pool.query(`create function staytrack.o03_test_outbox_fail() returns trigger language plpgsql as $$ begin raise exception 'O03 outbox failure'; end $$;
      create trigger o03_test_outbox_fail before insert on staytrack.payment_notification_outbox for each row execute function staytrack.o03_test_outbox_fail()`);
      await assert.rejects(decide(failure), /O03 outbox failure/);
      await pool.query(
        "drop trigger o03_test_outbox_fail on staytrack.payment_notification_outbox; drop function staytrack.o03_test_outbox_fail()",
      );
      assert.ok(
        (await state(failure)).every(
          (row) =>
            row.state === "proof_pending_review" && row.status === "pending",
        ),
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.payment_reviews where submission_id=$1",
            [failure.id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.verified_online_payments where submission_id=$1",
            [failure.id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "select online_confirmation_at from staytrack.reservations where id=$1",
            [failure.reservationId],
          )
        ).rows[0].online_confirmation_at,
        null,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.staff_audit",
          )
        ).rows[0].n,
        auditBefore,
      );
      for (const verification of [
        { amountCentavos: 1 },
        { recipient: "WRONG ACCOUNT" },
        { reference: "OTHER-REF" },
        { receivedAt: new Date(Date.now() + 86400000).toISOString() },
      ])
        await assert.rejects(
          decide(failure, {
            ...failure.input,
            verification: { ...failure.input.verification, ...verification },
          }),
        );
      await pool.query(
        "update staytrack.staff_accounts set active=false where auth_user_id=$1",
        [actor],
      );
      await assert.rejects(decide(failure), /Staff access denied/);
      await pool.query(
        "update staytrack.staff_accounts set active=true where auth_user_id=$1",
        [actor],
      );
      const terms = (
        await pool.query(
          "select cancellation_display_text from staytrack.operational_settings",
        )
      ).rows[0].cancellation_display_text;
      await pool.query(
        "update staytrack.operational_settings set cancellation_display_text=null",
      );
      await assert.rejects(decide(failure), /cancellation terms/);
      await pool.query(
        "update staytrack.operational_settings set cancellation_display_text=$1",
        [terms],
      );
      // Create fixtures before deliberately making the shared inventory infeasible.
      const unavailable = await make("0300000005");
      const blocked = await make("0300000006");
      await pool.query(
        `insert into staytrack.room_blocks(room_id,start_at,end_at,reason)
      select i.room_id,i.start_at,i.end_at,'O03 TEST MAINTENANCE' from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id where b.reservation_id=$1`,
        [blocked.reservationId],
      );
      await assert.rejects(decide(blocked), /Availability changed/);
      assert.ok(
        (await state(blocked)).every(
          (row) => row.state === "proof_pending_review",
        ),
      );
      await pool.query(
        "update staytrack.inventory_claims set state='released' where id in (select claim_id from staytrack.room_bookings where reservation_id=$1)",
        [unavailable.reservationId],
      );
      await assert.rejects(decide(unavailable), /manual reconciliation/);
      assert.ok(
        (await state(unavailable)).every(
          (row) => row.state === "released" && row.status === "pending",
        ),
      );
    },
  );
}
