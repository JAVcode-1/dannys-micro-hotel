import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import {
  requestReschedule,
  decideReschedule,
  rescheduleRows,
} from "../dist/rescheduling.js";
import { createGuestHold, guestReservations } from "../dist/guest-booking.js";
import { submitPaymentProof } from "../dist/payment-proofs.js";
import { decidePaymentReview } from "../dist/payment-review.js";
import {
  requestCancellation,
  decideCancellation,
} from "../dist/cancellations.js";
import { checkIn } from "../dist/check-in.js";
export let x02AfterCorrections;
export async function x02Postgres(t, pool) {
  await t.test(
    "X02 PostgreSQL T20/T28: atomic schedules, policy, authorization, races and rollback",
    async () => {
      const sql = readFileSync(
        new URL(
          "../../supabase/migrations/20261119001200_item_rescheduling.sql",
          import.meta.url,
        ),
        "utf8",
      );
      const installation = await pool.connect();
      try {
        await installation.query("begin");
        await installation.query(sql);
        await installation.query("rollback");
        assert.equal(
          (
            await installation.query(
              "select to_regclass('staytrack.reschedule_requests') as t",
            )
          ).rows[0].t,
          null,
        );
      } finally {
        installation.release();
      }
      await pool.query(sql);
      const actor = "33333333-3333-4333-8333-333333333333";
      const guest = {
        id: "11111111-1111-4111-8111-111111111111",
        email: "owner@example.test",
      };
      let n = 0;
      async function make(confirm = true, bed = false, ageMinutes = null) {
        n++;
        const start =
          Math.ceil((Date.now() + (3000 + n * 5) * 86400000) / 60000) * 60000;
        const cart = [
          {
            category: "double_standard",
            startAt: new Date(start).toISOString(),
            blocks: [180],
            adults: 1,
            children: 0,
            extraBed: false,
          },
          {
            category: bed ? "family_executive" : "double_standard",
            startAt: new Date(start + 86400000).toISOString(),
            blocks: [360],
            adults: 2,
            children: 0,
            extraBed: bed,
          },
        ];
        const hold = await createGuestHold(
          guest,
          `x02-booking-fixture-${n}`,
          "SYNTHETIC X02",
          cart,
          pool,
        );
        const items = (
          await pool.query(
            "select * from staytrack.room_bookings where reservation_id=$1 order by item_index",
            [hold.id],
          )
        ).rows;
        if (confirm) {
          const reference = `X02-PAID-${n}`;
          await submitPaymentProof(
            guest,
            hold.id,
            reference,
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
              "base64",
            ),
            "image/png",
            pool,
            { async upload() {}, async remove() {} },
          );
          const p = (
            await pool.query(
              "select id from staytrack.payment_submissions where reservation_id=$1",
              [hold.id],
            )
          ).rows[0];
          if (ageMinutes !== null) {
            const total = items.reduce(
              (sum, i) => sum + Number(i.total_centavos),
              0,
            );
            await pool.query(
              "update staytrack.reservations set online_confirmation_at=clock_timestamp()-$2*interval '1 minute',cancellation_terms_snapshot='SYNTHETIC confirmed policy' where id=$1",
              [hold.id, ageMinutes],
            );
            await pool.query(
              "update staytrack.room_bookings set status='confirmed' where reservation_id=$1",
              [hold.id],
            );
            await pool.query(
              "update staytrack.inventory_claims set state='confirmed' where id in (select claim_id from staytrack.room_bookings where reservation_id=$1)",
              [hold.id],
            );
            await pool.query(
              "update staytrack.payment_submissions set status='confirmed' where id=$1",
              [p.id],
            );
            await pool.query(
              "insert into staytrack.verified_online_payments(submission_id,normalized_reference,amount_centavos,recipient,received_at,verified_by) values($1,$2,$3,'TEST PAYEE ONLY',clock_timestamp()-interval '1 minute',$4)",
              [p.id, reference.replaceAll("-", ""), total, actor],
            );
            return { id: hold.id, items, payment: p.id };
          }
          await decidePaymentReview(
            actor,
            p.id,
            {
              decision: "confirmed",
              expectedVersion: 0,
              requestKey: `x02-review-fixture-${n}`,
              note: "Synthetic actual ledger verification",
              verification: {
                ledgerChecked: true,
                receivingAccountChecked: true,
                timeChecked: true,
                reference,
                recipient: "TEST PAYEE ONLY",
                amountCentavos: items.reduce(
                  (sum, i) => sum + Number(i.total_centavos),
                  0,
                ),
                receivedAt: new Date(Date.now() - 60000).toISOString(),
              },
            },
            pool,
          );
          return { id: hold.id, items, payment: p.id };
        }
        return { id: hold.id, items };
      }
      let sequence = 0;
      const snapshot = async (id) =>
        (
          await pool.query(
            `select b.*,i.room_id,i.buffer_minutes,i.start_at as claim_start,i.end_at as claim_end,i.buffered_end_at,i.state as claim_state from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1`,
            [id],
          )
        ).rows[0];
      const financial = async (id) =>
        (
          await pool.query(
            "select * from staytrack.reservation_financials where reservation_id=$1",
            [id],
          )
        ).rows[0];
      const request = async (item, shift = 86400000, patch = {}) => {
        const b = await snapshot(item.id);
        sequence++;
        return requestReschedule(
          guest,
          item.id,
          {
            requestKey: `x02-synthetic-request-${sequence}`,
            expectedRevision: Number(b.schedule_revision),
            startAt: new Date(+b.start_at + shift).toISOString(),
            endAt: new Date(+b.end_at + shift).toISOString(),
            blocks: b.pricing_snapshot.map((p) => p.durationMinutes),
            reason: "Synthetic schedule request",
            ...patch,
          },
          pool,
        );
      };
      const decision = (
        q,
        approved = true,
        key = `x02-synthetic-decision-${++sequence}`,
      ) =>
        decideReschedule(
          actor,
          q.id,
          {
            requestKey: key,
            expectedRevision: q.expectedRevision,
            approved,
            reason: "Synthetic guest consent checked",
          },
          pool,
        );
      async function waiting(count) {
        const until = Date.now() + 5000;
        while (Date.now() < until) {
          const n = (
            await pool.query(
              "select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()",
            )
          ).rows[0].n;
          if (n >= count) return;
          await delay(10);
        }
        assert.fail(`Expected ${count} genuinely blocked database sessions`);
      }
      async function contend(lock, values, first, second) {
        const gate = await pool.connect();
        let one, two;
        try {
          await gate.query("begin");
          await gate.query(lock, values);
          one = first().then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason }),
          );
          await waiting(1);
          two = second().then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason }),
          );
          await waiting(2);
          await gate.query("commit");
          return await Promise.all([one, two]);
        } finally {
          await gate.query("rollback");
          gate.release();
          await Promise.allSettled([one, two].filter(Boolean));
        }
      }
      const rights = (
        await pool.query(
          `select relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='staytrack' and c.relname in ('reschedule_requests','reschedule_decisions','reschedule_adjustment_proposals')`,
        )
      ).rows;
      assert.equal(rights.length, 3);
      assert.ok(
        rights.every((r) => r.relrowsecurity && !r.anon && !r.authenticated),
      );
      const acl = (
        await pool.query(
          `select has_function_privilege('authenticated',p.oid,'EXECUTE') as client,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='staytrack' and p.proname in ('guard_reschedule_request','guard_reschedule_decision','apply_reschedule_decision','guard_reschedule_projection','apply_reschedule_request','guard_reschedule_proposal','guard_reschedule_claim_projection')`,
        )
      ).rows;
      assert.equal(acl.length, 7);
      assert.ok(
        acl.every((r) => !r.client && r.proconfig.includes('search_path=""')),
      );
      const booking = await make();
      const [item, peer] = booking.items;
      const before = await snapshot(item.id),
        peerBefore = await snapshot(peer.id),
        moneyBefore = await financial(booking.id);
      const q = await request(item, 86400000, {
        requestKey: "x02-exact-request-replay",
      });
      const pending = await snapshot(item.id);
      assert.equal(+pending.start_at, +before.start_at);
      assert.equal(pending.claim_state, "confirmed");
      const replay = await Promise.all([
        decision(q, true, "x02-synthetic-same-decision"),
        decision(q, true, "x02-synthetic-same-decision"),
      ]);
      assert.ok(replay.every((r) => r.approved));
      assert.equal((await snapshot(item.id)).schedule_revision, "1");
      assert.deepEqual(await snapshot(peer.id), peerBefore);
      assert.deepEqual(await financial(booking.id), moneyBefore);
      assert.equal(
        (await decision(q, true, "x02-synthetic-same-decision")).id,
        q.id,
      );
      await assert.rejects(
        decision(q, true, "x02-synthetic-other-decision"),
        (e) => e.status === 409,
      );
      const exactBody = {
        requestKey: "x02-exact-request-replay",
        expectedRevision: 0,
        startAt: q.requestedStartAt,
        endAt: q.requestedEndAt,
        blocks: [180],
        reason: "Synthetic schedule request",
      };
      assert.deepEqual(
        await requestReschedule(guest, item.id, exactBody, pool),
        q,
      );
      await assert.rejects(
        requestReschedule(
          guest,
          item.id,
          { ...exactBody, reason: "Different body" },
          pool,
        ),
        (e) => e.status === 409,
      );
      await assert.rejects(
        decideReschedule(
          "44444444-4444-4444-8444-444444444444",
          q.id,
          {
            requestKey: "x02-synthetic-same-decision", // gitleaks:allow -- synthetic retry identifier, not a credential.
            expectedRevision: 0,
            approved: true,
            reason: "Synthetic guest consent checked",
          },
          pool,
        ),
        (e) => e.status === 409,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.room_bookings set claim_id=$2 where id=$1",
          [item.id, peer.claim_id],
        ),
        /identity and claim binding/,
      );
      const denied = await pool.connect();
      try {
        for (const role of ["anon", "authenticated"]) {
          await denied.query("begin");
          await denied.query(`set local role ${role}`);
          await assert.rejects(
            denied.query("select * from staytrack.reschedule_requests"),
            (e) => e.code === "42501",
          );
          await denied.query("rollback");
        }
      } finally {
        await denied.query("rollback");
        denied.release();
      }
      const moved = await snapshot(item.id);
      assert.equal(moved.id, before.id);
      assert.equal(moved.claim_id, before.claim_id);
      assert.equal(moved.total_centavos, before.total_centavos);
      const guestView = (await guestReservations(guest, pool))
        .find((r) => r.id === booking.id)
        .items.find((i) => i.id === item.id);
      assert.equal(+new Date(guestView.startAt), +moved.start_at);
      // Current rates changing/deactivating never rewrite a purchased package.
      const packageId = before.pricing_snapshot[0].id;
      const catalog = (
        await pool.query(
          "select price_centavos,active from staytrack.packages where id=$1",
          [packageId],
        )
      ).rows[0];
      await pool.query(
        "update staytrack.packages set active=false where id=$1",
        [packageId],
      );
      const again = await request(item, 2 * 86400000);
      assert.equal(again.originalCentavos, Number(before.total_centavos));
      await decision(again);
      await pool.query("update staytrack.packages set active=$2 where id=$1", [
        packageId,
        catalog.active,
      ]);
      await assert.rejects(
        pool.query(
          "update staytrack.room_bookings set start_at=start_at+interval '1 day',end_at=end_at+interval '1 day' where id=$1",
          [item.id],
        ),
        /Approved schedule event/,
      );
      await assert.rejects(
        pool.query("delete from staytrack.reschedule_requests where id=$1", [
          q.id,
        ]),
        /immutable/,
      );
      await assert.rejects(
        requestReschedule(
          { ...guest, email: "wrong@example.test" },
          peer.id,
          {
            requestKey: "x02-wrong-owner-synthetic", // gitleaks:allow -- synthetic retry identifier, not a credential.
            expectedRevision: 0,
            startAt: new Date(+peer.start_at + 86400000).toISOString(),
            endAt: new Date(+peer.end_at + 86400000).toISOString(),
            blocks: [360],
            reason: "Not owner",
          },
          pool,
        ),
        (e) => e.status === 404,
      );
      const rows = await rescheduleRows(guest, pool);
      assert.ok(rows.find((r) => r.id === q.id));
      assert.ok(
        rows.every((r) => !("payerAccount" in r) && !("paymentId" in r)),
      );
      await assert.rejects(
        rescheduleRows(guest, pool, -1),
        (e) => e.status === 400,
      );
      // T20: block every candidate destination, not just the provisional room.
      const blocked = await make();
      const blockedQ = await request(blocked.items[0]);
      const unchanged = await snapshot(blocked.items[0].id);
      const blockIds = (
        await pool.query(
          `insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select id,$1,$2,'SYNTHETIC X02 maintenance' from staytrack.rooms where category_id=(select category_id from staytrack.inventory_claims where id=$3) returning id`,
          [
            blockedQ.requestedStartAt,
            new Date(
              Date.parse(blockedQ.requestedEndAt) + 86400000,
            ).toISOString(),
            blocked.items[0].claim_id,
          ],
        )
      ).rows;
      await assert.rejects(decision(blockedQ), (e) => e.status === 409);
      assert.deepEqual(await snapshot(blocked.items[0].id), unchanged);
      await pool.query(
        "delete from staytrack.room_blocks where id=any($1::bigint[])",
        [blockIds.map((b) => b.id)],
      );
      // Audit failure cannot leave an approved event, pointer clear or moved claim.
      await pool.query(
        `create function staytrack.x02_fail_audit() returns trigger language plpgsql as $$ begin if new.action='room.reschedule_approved' then raise exception 'X02 audit failure' using errcode='XX000'; end if; return new; end $$; create trigger x02_fail_audit before insert on staytrack.staff_audit for each row execute function staytrack.x02_fail_audit()`,
      );
      await assert.rejects(decision(blockedQ), /X02 audit failure/);
      assert.deepEqual(await snapshot(blocked.items[0].id), unchanged);
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.reschedule_decisions where request_id=$1",
            [blockedQ.id],
          )
        ).rows[0].n,
        0,
      );
      await pool.query(
        "drop trigger x02_fail_audit on staytrack.staff_audit; drop function staytrack.x02_fail_audit()",
      );
      for (const table of ["room_bookings", "inventory_claims"]) {
        await pool.query(
          `create function staytrack.x02_projection_fail() returns trigger language plpgsql as $$ begin raise exception 'X02 projection failure' using errcode='XX000'; end $$; create trigger x02_projection_fail before update on staytrack.${table} for each row execute function staytrack.x02_projection_fail()`,
        );
        try {
          await assert.rejects(decision(blockedQ), /X02 projection failure/);
          assert.deepEqual(await snapshot(blocked.items[0].id), unchanged);
          assert.equal(
            (
              await pool.query(
                "select count(*)::int as n from staytrack.reschedule_decisions where request_id=$1",
                [blockedQ.id],
              )
            ).rows[0].n,
            0,
          );
        } finally {
          await pool.query(
            `drop trigger x02_projection_fail on staytrack.${table}; drop function staytrack.x02_projection_fail()`,
          );
        }
      }
      await decision(blockedQ, false);
      const replacement = await request(blocked.items[0], 2 * 86400000);
      await decision(replacement);
      // A buffer-only collision fails; a block ending exactly at arrival does not overlap.
      const previousBuffer = (
        await pool.query(
          "select cleaning_buffer_minutes from staytrack.operational_settings where id=true",
        )
      ).rows[0].cleaning_buffer_minutes;
      await pool.query(
        "update staytrack.operational_settings set cleaning_buffer_minutes=15 where id=true",
      );
      let bufferCase;
      try {
        bufferCase = await make();
      } finally {
        await pool.query(
          "update staytrack.operational_settings set cleaning_buffer_minutes=$1 where id=true",
          [previousBuffer],
        );
      }
      const bufferQ = await request(bufferCase.items[0]);
      assert.ok((await snapshot(bufferCase.items[0].id)).buffer_minutes > 0);
      let buffers = (
        await pool.query(
          `insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select id,$1,$2,'SYNTHETIC X02 buffer-only' from staytrack.rooms where category_id=(select category_id from staytrack.inventory_claims where id=$3) returning id`,
          [
            bufferQ.requestedEndAt,
            new Date(Date.parse(bufferQ.requestedEndAt) + 60000).toISOString(),
            bufferCase.items[0].claim_id,
          ],
        )
      ).rows;
      try {
        await assert.rejects(decision(bufferQ), (e) => e.status === 409);
      } finally {
        await pool.query(
          "delete from staytrack.room_blocks where id=any($1::bigint[])",
          [buffers.map((b) => b.id)],
        );
      }
      buffers = (
        await pool.query(
          `insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select id,$1,$2,'SYNTHETIC X02 boundary' from staytrack.rooms where category_id=(select category_id from staytrack.inventory_claims where id=$3) returning id`,
          [
            new Date(
              Date.parse(bufferQ.requestedStartAt) - 60000,
            ).toISOString(),
            bufferQ.requestedStartAt,
            bufferCase.items[0].claim_id,
          ],
        )
      ).rows;
      try {
        await decision(bufferQ);
      } finally {
        await pool.query(
          "delete from staytrack.room_blocks where id=any($1::bigint[])",
          [buffers.map((b) => b.id)],
        );
      }
      // Duration-changing proposals never become capacity or financial entries.
      const policy = await make();
      const policyBefore = await snapshot(policy.items[1].id),
        policyMoney = await financial(policy.id);
      const proposal = await request(policy.items[1], 86400000, {
        blocks: [180],
        endAt: new Date(
          +policy.items[1].start_at + 86400000 + 180 * 60000,
        ).toISOString(),
      });
      assert.equal(proposal.eligibility, "financial_policy_pending");
      assert.equal(proposal.proposalStatus, "policy_pending");
      assert.equal(
        proposal.proposalDeltaCentavos,
        Number(policy.items[0].total_centavos) -
          Number(policy.items[1].total_centavos),
      );
      await assert.rejects(decision(proposal), (e) => e.status === 409);
      assert.deepEqual(await financial(policy.id), policyMoney);
      assert.equal(
        +(await snapshot(policy.items[1].id)).start_at,
        +policyBefore.start_at,
      );
      const bed = await make(true, true);
      const bedQ = await request(bed.items[1]);
      assert.equal(bedQ.eligibility, "extra_bed_policy_pending");
      await assert.rejects(decision(bedQ), (e) => e.status === 409);
      // One last destination: two independently locked source items race for it.
      const a = await make(),
        b = await make();
      const target = +a.items[0].start_at + 7 * 86400000;
      const qa = await request(a.items[0], target - +a.items[0].start_at),
        qb = await request(b.items[0], target - +b.items[0].start_at);
      const room = (
        await pool.query(
          "select id from staytrack.rooms where active and operational_state='ready' and category_id=(select category_id from staytrack.inventory_claims where id=$1) order by id limit 1",
          [a.items[0].claim_id],
        )
      ).rows[0].id;
      const exclusions = (
        await pool.query(
          `insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select id,$1,$2,'SYNTHETIC X02 last slot' from staytrack.rooms where id<>$3 and category_id=(select category_id from staytrack.inventory_claims where id=$4) returning id`,
          [
            qa.requestedStartAt,
            new Date(Date.parse(qa.requestedEndAt) + 86400000).toISOString(),
            room,
            a.items[0].claim_id,
          ],
        )
      ).rows;
      const results = await contend(
        "select pg_advisory_xact_lock(category_id) from staytrack.inventory_claims where id=$1",
        [a.items[0].claim_id],
        () => decision(qa),
        () => decision(qb),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const loser = results[0].status === "rejected" ? a : b;
      assert.equal(
        +(await snapshot(loser.items[0].id)).start_at,
        +loser.items[0].start_at,
      );
      await pool.query(
        "delete from staytrack.room_blocks where id=any($1::bigint[])",
        [exclusions.map((b) => b.id)],
      );
      // Ordinary online booking competes with approval through the same category lock.
      for (const bookingFirst of [true, false]) {
        const c = await make();
        const rq = await request(c.items[0], 500 * 86400000);
        const blocks = (
          await pool.query(
            `insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select id,$1,$2,'SYNTHETIC X02 booking race' from staytrack.rooms where id<>$3 and category_id=(select category_id from staytrack.inventory_claims where id=$4) returning id`,
            [
              rq.requestedStartAt,
              new Date(Date.parse(rq.requestedEndAt) + 86400000).toISOString(),
              room,
              c.items[0].claim_id,
            ],
          )
        ).rows;
        try {
          const book = () =>
            createGuestHold(
              guest,
              `x02-ordinary-booking-${++sequence}`,
              "SYNTHETIC X02 ordinary contender",
              [
                {
                  category: "double_standard",
                  startAt: rq.requestedStartAt,
                  blocks: [180],
                  adults: 1,
                  children: 0,
                  extraBed: false,
                },
              ],
              pool,
            );
          const outcomes = await contend(
            "select pg_advisory_xact_lock(category_id) from staytrack.inventory_claims where id=$1",
            [c.items[0].claim_id],
            bookingFirst ? book : () => decision(rq),
            bookingFirst ? () => decision(rq) : book,
          );
          assert.equal(outcomes[0].status, "fulfilled");
          assert.equal(outcomes[1].status, "rejected");
          if (bookingFirst)
            assert.equal(
              +(await snapshot(c.items[0].id)).start_at,
              +c.items[0].start_at,
            );
        } finally {
          await pool.query(
            "delete from staytrack.room_blocks where id=any($1::bigint[])",
            [blocks.map((b) => b.id)],
          );
        }
      }
      // Force cancellation-first and reschedule-first orderings using held item locks.
      for (const cancellationFirst of [true, false]) {
        const c = await make();
        const rq = await request(c.items[0]);
        const cancel = () =>
          requestCancellation(
            guest,
            c.items[0].id,
            {
              requestKey: `x02-cancellation-${++sequence}`,
              reason: "Synthetic cancellation",
            },
            pool,
          );
        const outcomes = await contend(
          "select id from staytrack.reservations where id=$1 for update",
          [c.id],
          cancellationFirst ? cancel : () => decision(rq),
          cancellationFirst ? () => decision(rq) : cancel,
        );
        const cancellation = outcomes[cancellationFirst ? 0 : 1];
        assert.equal(cancellation.status, "fulfilled");
        assert.equal(cancellation.value.eligibility, "eligible");
        const move = outcomes[cancellationFirst ? 1 : 0];
        assert.equal(move.status, cancellationFirst ? "rejected" : "fulfilled");
        if (move.status === "fulfilled")
          assert.equal(move.value.confirmationAt, rq.confirmationAt);
        await decideCancellation(
          actor,
          c.items[0].id,
          {
            requestKey: `x02-cancel-decision-${++sequence}`,
            approved: true,
            reason: "Synthetic approved cancellation",
          },
          pool,
        );
        await assert.rejects(
          decision(rq, true, `x02-after-cancel-${++sequence}`),
          (e) => e.status === 409,
        );
      }
      // Fresh labelled disposable rooms isolate W02 early check-in from old suite stays.
      // Run these concurrency checks after the forward early-approval/readiness migration.
      x02AfterCorrections = async () => {
        await pool.query(
          "update staytrack.payment_qr set payee_label='TEST PAYEE ONLY'",
        );
        for (const checkinFirst of [true, false]) {
          const c = await make();
          const rq = await request(c.items[0]);
          const ready = (
            await pool.query(
              "insert into staytrack.rooms(category_id,code,operational_state,active) select category_id,$2,'ready',true from staytrack.inventory_claims where id=$1 returning id",
              [c.items[0].claim_id, `X02-SYNTHETIC-CHECKIN-${checkinFirst}`],
            )
          ).rows[0].id;
          await pool.query(
            "select staytrack.inspect_legacy_room($1,$2,$3,$4)",
            [
              actor,
              ready,
              `x02-inspection-${checkinFirst}-001`,
              "Synthetic current inspection",
            ],
          );
          const enter = () =>
            checkIn(
              actor,
              c.items[0].id,
              ready,
              `x02-synthetic-checkin-${++sequence}`,
              pool,
              "Synthetic explicit approval for early fixture arrival",
            );
          const [one, two] = await contend(
            "select id from staytrack.reservations where id=$1 for update",
            [c.id],
            checkinFirst ? enter : () => decision(rq),
            checkinFirst ? () => decision(rq) : enter,
          );
          assert.equal(one.status, "fulfilled");
          assert.equal(two.status, checkinFirst ? "rejected" : "fulfilled");
          const live = (await rescheduleRows({ staffId: actor }, pool)).find(
            (r) => r.id === rq.id,
          );
          if (checkinFirst) {
            assert.equal(live.canApprove, false);
            assert.match(live.blocker, /checked in/);
          }
          assert.ok(live.reason);
          assert.deepEqual(live.blocks, [180]);
          if (!checkinFirst)
            assert.equal(
              +two.value.checkout_at - +two.value.checked_in_at,
              Date.parse(rq.requestedEndAt) - Date.parse(rq.requestedStartAt),
            );
        }
        // T28 also preserves a sibling that is already checked in and counting down.
        const occupiedPeer = await make();
        const peerRoom = (
          await pool.query(
            "insert into staytrack.rooms(category_id,code,operational_state,active) select category_id,'X02-SYNTHETIC-SIBLING','ready',true from staytrack.inventory_claims where id=$1 returning id",
            [occupiedPeer.items[1].claim_id],
          )
        ).rows[0].id;
        await pool.query("select staytrack.inspect_legacy_room($1,$2,$3,$4)", [
          actor,
          peerRoom,
          "x02-inspection-sibling-001",
          "Synthetic current inspection",
        ]);
        await checkIn(
          actor,
          occupiedPeer.items[1].id,
          peerRoom,
          `x02-synthetic-peer-checkin-${++sequence}`,
          pool,
          "Synthetic explicitly approved early sibling check-in",
        );
        const siblingBefore = await snapshot(occupiedPeer.items[1].id);
        const checkinBefore = (
          await pool.query(
            "select * from staytrack.room_check_ins where room_booking_id=$1",
            [occupiedPeer.items[1].id],
          )
        ).rows[0];
        await decision(await request(occupiedPeer.items[0]));
        assert.deepEqual(
          await snapshot(occupiedPeer.items[1].id),
          siblingBefore,
        );
        assert.deepEqual(
          (
            await pool.query(
              "select * from staytrack.room_check_ins where room_booking_id=$1",
              [occupiedPeer.items[1].id],
            )
          ).rows[0],
          checkinBefore,
        );
      };
      // Rescheduling twice never restarts the immutable cancellation clock.
      const timed = await make(true, false, 61);
      for (const timedItem of timed.items) {
        await decision(await request(timedItem));
      }
      await decision(await request(timed.items[0], 2 * 86400000));
      for (const [index, offset] of [
        [0, "interval '1 hour'-interval '1 millisecond'"],
        [1, "interval '1 hour'"],
      ]) {
        const eligible = (
          await pool.query(
            `insert into staytrack.cancellation_requests(room_booking_id,guest_auth_user_id,guest_email,request_key,reason,requested_at,eligibility) select b.id,$2,$3,$4,'Synthetic immutable clock',r.online_confirmation_at+${offset},'unconfirmed' from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id where b.id=$1 returning eligibility`,
            [
              timed.items[index].id,
              guest.id,
              guest.email,
              `x02-clock-boundary-${index}`,
            ],
          )
        ).rows[0].eligibility;
        assert.equal(eligible, index === 0 ? "eligible" : "outside_window");
      }
      await pool.query(
        "update staytrack.staff_accounts set active=false where auth_user_id=$1",
        [actor],
      );
      await assert.rejects(decision(proposal, false), (e) => e.status === 403);
      await pool.query(
        "update staytrack.staff_accounts set active=true where auth_user_id=$1",
        [actor],
      );
    },
  );
}
