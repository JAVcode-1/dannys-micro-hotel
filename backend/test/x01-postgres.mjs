import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import {
  requestCancellation,
  decideCancellation,
  recordManualRefund,
  cancellationRows,
} from "../dist/cancellations.js";
import { createGuestHold } from "../dist/guest-booking.js";
import { submitPaymentProof } from "../dist/payment-proofs.js";
import { decidePaymentReview } from "../dist/payment-review.js";
import { checkIn } from "../dist/check-in.js";
export async function x01Postgres(t, pool) {
  await t.test(
    "X01 PostgreSQL T17/T18/T19/T27: item isolation, eligibility, claims, refunds, rollback and concurrency",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261119001100_item_cancellation_manual_refund.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      // W03 already asserted its deliberate late-cleaning/future-claim conflict and independence.
      // End only that labelled disposable reservation before new allocator scenarios.
      await pool.query(`update staytrack.inventory_claims set state='released' where id in (
        select b.claim_id from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
        where r.primary_name='SYNTHETIC FUTURE' and r.channel='walk_in')`);
      const actor = "33333333-3333-4333-8333-333333333333";
      const guest = {
        id: "11111111-1111-4111-8111-111111111111",
        email: "owner@example.test",
      };
      const other = {
        id: "22222222-2222-4222-8222-222222222222",
        email: "other@example.test",
      };
      // Dedicated disposable inventory avoids earlier fixtures, without changing their claims.
      await pool.query(
        `insert into staytrack.rooms(category_id,code,operational_state,active) select id,'X01-SYNTHETIC-ONLY','ready',true from staytrack.room_categories where code='double_standard'`,
      );
      let n = 0;
      async function make(confirm = true, bed = false, ageMinutes = null) {
        n++;
        const start =
          Math.ceil((Date.now() + (1500 + n * 5) * 86400000) / 60000) * 60000;
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
          `x01-booking-fixture-${n}`,
          "SYNTHETIC X01",
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
          const reference = `X01-PAID-${n}`;
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
              requestKey: `x01-review-fixture-${n}`,
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
      const request = (id, key = "x01-request-fixture-001") =>
        requestCancellation(
          guest,
          id,
          { requestKey: key, reason: "Synthetic requested cancellation" },
          pool,
        );
      const decision = (
        id,
        key = "x01-decision-fixture-001",
        approved = true,
      ) =>
        decideCancellation(
          actor,
          id,
          { requestKey: key, approved, reason: "Synthetic staff decision" },
          pool,
        );
      const snapshot = async (id) =>
        (
          await pool.query(
            "select b.*,i.state as claim_state,i.start_at as claim_start,i.end_at as claim_end from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1",
            [id],
          )
        ).rows[0];
      const rights = (
        await pool.query(
          `select c.relname,c.relrowsecurity as rls,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='staytrack' and c.relname in ('cancellation_requests','cancellation_decisions','refund_claims','refund_transfers')`,
        )
      ).rows;
      assert.equal(rights.length, 4);
      assert.ok(rights.every((r) => r.rls && !r.anon && !r.authenticated));
      const forty = await make(true, false, 40);
      assert.equal(
        (await request(forty.items[0].id, "x01-forty-minute-001")).eligibility,
        "eligible",
      );
      const sixty = await make(true, false, 61);
      const exact = await pool.query(
        `insert into staytrack.cancellation_requests(room_booking_id,guest_auth_user_id,guest_email,request_key,reason,requested_at,eligibility)
        select b.id,$2,$3,'x01-exact-boundary-001','Synthetic exact boundary',r.online_confirmation_at+interval '1 hour','unconfirmed'
        from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id where b.id=$1 returning eligibility`,
        [sixty.items[0].id, guest.id, guest.email],
      );
      assert.equal(exact.rows[0].eligibility, "outside_window");
      assert.equal(
        (await request(sixty.items[1].id, "x01-after-hour-001")).eligibility,
        "outside_window",
      );
      const delayed = await make(true, false, 61);
      const old = (
        await pool.query(
          "select online_confirmation_at from staytrack.reservations where id=$1",
          [delayed.id],
        )
      ).rows[0].online_confirmation_at;
      const stored = await pool.query(
        `insert into staytrack.cancellation_requests(room_booking_id,guest_auth_user_id,guest_email,request_key,reason,requested_at,eligibility) values($1,$2,$3,'x01-delayed-boundary-001','Synthetic trusted receive before lock wait',$4,'unconfirmed') returning eligibility`,
        [delayed.items[0].id, guest.id, guest.email, new Date(+old + 3599999)],
      );
      assert.equal(stored.rows[0].eligibility, "eligible");
      const booking = await make();
      const [item, peer] = booking.items;
      const peerBefore = await snapshot(peer.id);
      await assert.rejects(
        requestCancellation(
          other,
          item.id,
          { requestKey: "x01-wrong-owner-001", reason: "Unauthorized" },
          pool,
        ),
        (e) => e.status === 404,
      );
      const pending = await Promise.all([request(item.id), request(item.id)]);
      assert.equal(pending[0].eligibility, "eligible");
      assert.equal(+pending[0].requested_at, +pending[1].requested_at);
      assert.equal((await snapshot(item.id)).claim_state, "confirmed");
      const rm = (
        await pool.query(
          "select room_id from staytrack.inventory_claims where id=$1",
          [item.claim_id],
        )
      ).rows[0].room_id;
      await assert.rejects(
        checkIn(actor, item.id, rm, "x01-blocked-checkin-001", pool),
        /cancellation prevents/,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.inventory_claims set state='released' where id=$1",
          [item.claim_id],
        ),
        /Cancellation protects/,
      );
      await pool.query(
        `create function staytrack.x01_fail_audit() returns trigger language plpgsql as $$ begin if new.action like 'room.cancellation_%' then raise exception 'X01 audit failure' using errcode='XX000'; end if; return new; end $$; create trigger x01_fail_audit before insert on staytrack.staff_audit for each row execute function staytrack.x01_fail_audit()`,
      );
      await assert.rejects(decision(item.id), /X01 audit failure/);
      assert.equal((await snapshot(item.id)).claim_state, "confirmed");
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.cancellation_decisions where room_booking_id=$1",
            [item.id],
          )
        ).rows[0].n,
        0,
      );
      await pool.query(
        "drop trigger x01_fail_audit on staytrack.staff_audit; drop function staytrack.x01_fail_audit()",
      );
      const decisions = await Promise.all([
        decision(item.id),
        decision(item.id),
      ]);
      assert.equal(decisions[0].refund_centavos, item.total_centavos);
      assert.equal((await snapshot(item.id)).claim_state, "released");
      assert.deepEqual(await snapshot(peer.id), peerBefore);
      const financial = async () =>
        (
          await pool.query(
            "select * from staytrack.reservation_financials where reservation_id=$1",
            [booking.id],
          )
        ).rows[0];
      assert.equal(
        Number((await financial()).refund_due_centavos),
        Number(item.total_centavos),
      );
      const claim = {
        action: "claim",
        requestKey: "x01-refund-claim-001",
        originalPaymentId: booking.payment,
        payerName: "SYNTHETIC PAYER",
        payerAccount: "09999999999",
        verificationNote:
          "Synthetic actual receiving ledger source payer match",
        ledgerChecked: true,
        originalPayerMatched: true,
      };
      await recordManualRefund(actor, item.id, claim, pool);
      assert.equal(
        (await recordManualRefund(actor, item.id, claim, pool)).replayed,
        true,
      );
      await assert.rejects(
        recordManualRefund(
          actor,
          item.id,
          { ...claim, requestKey: "x01-other-claim-001" },
          pool,
        ),
        (e) => e.status === 409,
      );
      const when = new Date().toISOString();
      const transfer = {
        action: "transfer",
        requestKey: "x01-refund-transfer-001",
        amountCentavos: Number(item.total_centavos),
        reference: "X01-OUT-001",
        transferredAt: when,
        transferChecked: true,
      };
      await assert.rejects(
        recordManualRefund(
          actor,
          item.id,
          { ...transfer, amountCentavos: transfer.amountCentavos + 1 },
          pool,
        ),
        (e) => e.status === 409,
      );
      const otherStaff = "44444444-4444-4444-8444-444444444444";
      await pool.query(
        "insert into auth.users(id) values($1) on conflict do nothing",
        [otherStaff],
      );
      await pool.query(
        "insert into staytrack.staff_accounts(auth_user_id,active) values($1,true) on conflict(auth_user_id) do update set active=true",
        [otherStaff],
      );
      await assert.rejects(
        recordManualRefund(
          otherStaff,
          item.id,
          { ...transfer, requestKey: "x01-nonclaimant-001" },
          pool,
        ),
        (e) => e.status === 409,
      );
      await pool.query(`create function staytrack.x01_refund_audit_fail() returns trigger language plpgsql as $$ begin if new.action='refund.manual_transfer_recorded' then raise exception 'X01 refund audit failure' using errcode='XX000'; end if; return new; end $$;
        create trigger x01_refund_audit_fail before insert on staytrack.staff_audit for each row execute function staytrack.x01_refund_audit_fail()`);
      await assert.rejects(
        recordManualRefund(actor, item.id, transfer, pool),
        /X01 refund audit failure/,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.refund_transfers where room_booking_id=$1",
            [item.id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        Number((await financial()).refund_due_centavos),
        Number(item.total_centavos),
      );
      await pool.query(
        "drop trigger x01_refund_audit_fail on staytrack.staff_audit; drop function staytrack.x01_refund_audit_fail()",
      );
      const transfers = await Promise.all([
        recordManualRefund(actor, item.id, transfer, pool),
        recordManualRefund(actor, item.id, transfer, pool),
      ]);
      assert.equal(transfers.filter((r) => r.replayed).length, 1);
      assert.equal(Number((await financial()).refund_due_centavos), 0);
      assert.equal(Number((await financial()).balance_centavos), 0);
      assert.deepEqual(await snapshot(peer.id), peerBefore);
      const rows = await cancellationRows(guest, pool);
      assert.equal(rows.find((r) => r.id === item.id).payerAccount, null);
      assert.equal(rows.find((r) => r.id === item.id).paymentId, null);
      await assert.rejects(
        pool.query(
          "delete from staytrack.refund_transfers where room_booking_id=$1",
          [item.id],
        ),
        /immutable/,
      );
      const unconfirmed = await make(false);
      await assert.rejects(
        request(unconfirmed.items[0].id, "x01-unconfirmed-001"),
        (e) => e.status === 409,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.cancellation_requests where room_booking_id=$1",
            [unconfirmed.items[0].id],
          )
        ).rows[0].n,
        0,
      );
      const bed = await make(true, true);
      assert.equal(
        (await request(bed.items[1].id, "x01-bed-request-001")).eligibility,
        "extra_bed_policy_pending",
      );
      await assert.rejects(
        decision(bed.items[1].id, "x01-bed-decision-001"),
        (e) => e.status === 409,
      );
      const raced = await make();
      const raceItem = raced.items[0];
      const raceRoom = (
        await pool.query(
          "select room_id from staytrack.inventory_claims where id=$1",
          [raceItem.claim_id],
        )
      ).rows[0].room_id;
      // Both paths lock the same reservation/item; request-first blocks check-in; check-in-first makes the request ineligible.
      const race = await Promise.allSettled([
        request(raceItem.id, "x01-race-request-001"),
        checkIn(actor, raceItem.id, raceRoom, "x01-race-checkin-001", pool),
      ]);
      const req = race[0];
      assert.equal(req.status, "fulfilled");
      if (race[1].status === "fulfilled")
        assert.equal(req.value.eligibility, "checked_in");
      else assert.equal(req.value.eligibility, "eligible");
      await pool.query(
        "update staytrack.staff_accounts set active=false where auth_user_id=$1",
        [actor],
      );
      await assert.rejects(
        decision(peer.id, "x01-revoked-decision-001"),
        (e) => e.status === 403,
      );
      await pool.query(
        "update staytrack.staff_accounts set active=true where auth_user_id=$1",
        [actor],
      );
    },
  );
}
