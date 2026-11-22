import assert from "node:assert/strict";
import console from "node:console";
import { Buffer } from "node:buffer";
import { createGuestHold, guestReservations } from "../dist/guest-booking.js";
import {
  guestPaymentSession,
  submitPaymentProof,
} from "../dist/payment-proofs.js";
import { decidePaymentReview } from "../dist/payment-review.js";
import { expireClaims } from "../dist/claim-holds.js";
import { guestHallAction } from "../dist/unified-hall-actions.js";
import { hallCommand } from "../dist/hall-reservations.js";
import { claimTransaction } from "../dist/inventory-claims.js";
import { quoteUnified } from "../dist/unified-booking.js";
import {
  assertUnifiedFinance,
  assertHallCancellationFinance,
} from "./unified-finance-postgres.mjs";

export async function unifiedBookingPostgres(pool) {
  const actor = "33333333-3333-4333-8333-333333333333";
  const guest = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "synthetic@example.test",
  };
  await pool.query("insert into auth.users(id) values($1),($2)", [
    actor,
    guest.id,
  ]);
  await pool.query(
    "insert into staytrack.staff_accounts(auth_user_id,active) values($1,true)",
    [actor],
  );
  await pool.query(`insert into staytrack.rooms(category_id,code,operational_state,active)
    select id,'SYNTHETIC-'||code||'-'||n,'unverified',true from staytrack.room_categories
    cross join lateral generate_series(1,case code when 'double_standard' then 10 else 5 end) n`);
  await pool.query(
    "update staytrack.operational_settings set cleaning_buffer_minutes=15,cancellation_display_text='SYNTHETIC UB05: one hour before actual start; manual refunds.'",
  );
  await pool.query(
    "insert into staytrack.payment_qr(id,object_key,payee_label,updated_by) values(true,'synthetic-qr','SYNTHETIC PAYEE',$1)",
    [actor],
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
    "base64",
  );
  const store = {
    async upload() {},
    async remove() {},
    async signedUrl() {
      return "http://127.0.0.1/synthetic-private-media";
    },
  };
  const day = (n) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const hall = (n) => ({
    setup: "theater",
    start: day(n) + "T10:00",
    minutes: 180,
    attendees: 20,
    requests: "SYNTHETIC ONLY",
  });
  const rooms = [
    {
      category: "double_standard",
      startAt: day(2) + "T10:00:00+08:00",
      blocks: [180],
      adults: 2,
      children: 0,
      extraBed: false,
    },
  ];
  const contact = {
    phone: "09123456789",
    policyVersion: "booking-v1",
    policyAcknowledged: true,
  };
  const make = (key, items, h) =>
    createGuestHold(
      guest,
      key,
      "SYNTHETIC GUEST",
      items,
      pool,
      [],
      contact,
      undefined,
      h,
    );
  const mixed = await make("unified-mixed-hold-0001", rooms, hall(2));
  assert.equal(
    (await make("unified-mixed-hold-0001", rooms, hall(2))).replayed,
    true,
  );
  const mixedGuest = (
    await guestReservations(guest, pool, { reservationId: mixed.id })
  )[0];
  assert.equal(mixedGuest.serviceKind, "combined");
  assert.equal(mixedGuest.items.length, 1);
  assert.equal(mixedGuest.hallItems.length, 1);
  const session = await guestPaymentSession(guest, mixed.id, pool, store);
  assert.equal(session.allocations.length, 2);
  assert.equal(
    session.allocations.reduce((n, a) => n + a.amountCentavos, 0),
    session.amountDueCentavos,
  );
  const before = (
    await pool.query("select count(*)::int n from staytrack.reservations")
  ).rows[0].n;
  await assert.rejects(
    make("unified-conflict-00001", rooms, { ...hall(2), setup: "room" }),
  );
  assert.equal(
    (await pool.query("select count(*)::int n from staytrack.reservations"))
      .rows[0].n,
    before,
    "Hall conflict must roll back room claims and reservation",
  );
  const receivedAt = new Date(Date.now() - 1000).toISOString();
  await submitPaymentProof(
    guest,
    mixed.id,
    "SYNTHETIC-UB-001",
    png,
    "image/png",
    pool,
    store,
  );
  await expireClaims(Date.now() + 31 * 60000, pool);
  assert.equal(
    (
      await pool.query(
        "select state from staytrack.online_hall_items where reservation_id=$1",
        [mixed.id],
      )
    ).rows[0].state,
    "proof_pending_review",
  );
  const submission = (
    await pool.query(
      "select id from staytrack.payment_submissions where reservation_id=$1",
      [mixed.id],
    )
  ).rows[0];
  const decision = {
    decision: "confirmed",
    expectedVersion: 0,
    requestKey: "unified-review-000001",
    note: "SYNTHETIC actual-ledger simulation only",
    verification: {
      ledgerChecked: true,
      receivingAccountChecked: true,
      timeChecked: true,
      reference: "SYNTHETIC-UB-001",
      recipient: "SYNTHETIC PAYEE",
      amountCentavos: session.amountDueCentavos,
      receivedAt,
    },
  };
  await assert.rejects(
    decidePaymentReview(
      actor,
      submission.id,
      {
        ...decision,
        verification: { ...decision.verification, amountCentavos: 300000 },
      },
      pool,
    ),
  );
  await assert.rejects(
    decidePaymentReview(guest.id, submission.id, decision, pool),
  );
  await pool.query(`create function staytrack.unified_test_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure' using errcode='XX000'; end $$;
    create trigger unified_test_audit_failure before insert on staytrack.staff_audit for each row execute function staytrack.unified_test_audit_failure()`);
  await assert.rejects(
    decidePaymentReview(actor, submission.id, decision, pool),
  );
  assert.equal(
    (
      await pool.query(
        "select state from staytrack.online_hall_items where reservation_id=$1",
        [mixed.id],
      )
    ).rows[0].state,
    "proof_pending_review",
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from staytrack.verified_online_payments where submission_id=$1",
        [submission.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "select i.state from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id where b.reservation_id=$1",
        [mixed.id],
      )
    ).rows[0].state,
    "proof_pending_review",
  );
  await pool.query(
    "drop trigger unified_test_audit_failure on staytrack.staff_audit;drop function staytrack.unified_test_audit_failure()",
  );
  await decidePaymentReview(actor, submission.id, decision, pool);
  assert.equal(
    (await decidePaymentReview(actor, submission.id, decision, pool)).replayed,
    true,
  );
  await assertUnifiedFinance(pool, mixed.id);
  const outbox = (
    await pool.query(
      "select payload from staytrack.payment_notification_outbox where reservation_id=$1",
      [mixed.id],
    )
  ).rows[0];
  assert.equal(outbox.payload.items.length, 1);
  assert.equal(outbox.payload.hallItems.length, 1);
  assert.equal(
    (await pool.query("select count(*)::int n from staytrack.hall_receipts"))
      .rows[0].n,
    0,
    "unified payment must not create duplicate Hall receipt",
  );
  const hallId = mixedGuest.hall.id;
  await assert.rejects(
    guestHallAction(pool, { ...guest, id: actor }, hallId, "cancel", {
      requestKey: "unified-wrong-guest-01",
      reason: "test",
    }),
  );
  const roomSnapshot = (
    await pool.query(
      "select to_jsonb(b) snapshot from staytrack.room_bookings b where reservation_id=$1",
      [mixed.id],
    )
  ).rows;
  await guestHallAction(pool, guest, hallId, "cancel", {
    requestKey: "unified-cancel-000001",
    reason: "SYNTHETIC cancellation",
  });
  assert.equal(
    (
      await guestHallAction(pool, guest, hallId, "cancel", {
        requestKey: "unified-cancel-000001",
        reason: "SYNTHETIC cancellation",
      })
    ).replayed,
    true,
  );
  assert.deepEqual(
    (
      await pool.query(
        "select to_jsonb(b) snapshot from staytrack.room_bookings b where reservation_id=$1",
        [mixed.id],
      )
    ).rows,
    roomSnapshot,
  );
  await assertHallCancellationFinance(pool, mixed.id);
  const approval = (
    await pool.query(
      "select id from staytrack.hall_refund_approvals where reservation_id=$1",
      [hallId],
    )
  ).rows[0];
  await hallCommand(pool, actor, "unified-refund-000001", "complete_refund", {
    id: hallId,
    approval: approval.id,
    method: "gcash",
    reference: "SYNTHETIC-UB-REFUND",
    transferredAt: new Date().toISOString(),
    verified: true,
    evidence: "SYNTHETIC transfer only",
  });
  await assertHallCancellationFinance(pool, mixed.id, true);
  const hallOnly = await make("unified-hallonly-00001", [], hall(3));
  const onlySession = await guestPaymentSession(
    guest,
    hallOnly.id,
    pool,
    store,
  );
  assert.equal(onlySession.amountDueCentavos, 300000);
  assert.equal(onlySession.allocations.length, 1);
  const onlyGuest = (
    await guestReservations(guest, pool, { reservationId: hallOnly.id })
  )[0];
  assert.equal(onlyGuest.items.length, 0);
  assert.equal(onlyGuest.serviceKind, "hall");
  await expireClaims(Date.now() + 31 * 60000, pool);
  assert.equal(
    (
      await pool.query(
        "select state from staytrack.online_hall_items where reservation_id=$1",
        [hallOnly.id],
      )
    ).rows[0].state,
    "expired",
  );
  assert.ok(
    (
      await pool.query(
        "select c.released_at from staytrack.hall_claims c join staytrack.hall_reservations h on h.claim_id=c.id where h.id=$1",
        [onlyGuest.hall.id],
      )
    ).rows[0].released_at,
  );
  const competing = await Promise.allSettled([
    make("unified-race-a-000001", [], hall(4)),
    make("unified-race-b-000001", [], { ...hall(4), setup: "room" }),
  ]);
  assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
  const changeHold = await make("unified-change-hold-01", [], hall(6));
  const changeReceivedAt = new Date(Date.now() - 1000).toISOString();
  await submitPaymentProof(
    guest,
    changeHold.id,
    "SYNTHETIC-UB-CHANGE",
    png,
    "image/png",
    pool,
    store,
  );
  const changeSubmission = (
    await pool.query(
      "select id from staytrack.payment_submissions where reservation_id=$1",
      [changeHold.id],
    )
  ).rows[0];
  await decidePaymentReview(
    actor,
    changeSubmission.id,
    {
      ...decision,
      requestKey: "unified-hallonly-review",
      verification: {
        ...decision.verification,
        reference: "SYNTHETIC-UB-CHANGE",
        amountCentavos: 300000,
        receivedAt: changeReceivedAt,
      },
    },
    pool,
  );
  const changeHall = (
    await guestReservations(guest, pool, { reservationId: changeHold.id })
  )[0].hall;
  await guestHallAction(pool, guest, changeHall.id, "change", {
    requestKey: "unified-guest-move-0001",
    reason: "SYNTHETIC move request",
    ...hall(7),
  });
  let changeClaim = (
    await pool.query(
      "select claim_id from staytrack.hall_reservations where id=$1",
      [changeHall.id],
    )
  ).rows[0].claim_id;
  const moved = await hallCommand(
    pool,
    actor,
    "unified-staff-move-0001",
    "reschedule",
    {
      id: changeHall.id,
      expectedClaim: changeClaim,
      reason: "Approved synthetic request",
      ...hall(7),
    },
  );
  assert.equal(moved.status, "confirmed");
  changeClaim = moved.claim;
  const extension = {
    id: changeHall.id,
    expectedClaim: changeClaim,
    reason: "SYNTHETIC extension",
    hours: 1,
  };
  assert.match(
    (
      await hallCommand(
        pool,
        actor,
        "unified-unfunded-ext-01",
        "extend",
        extension,
      )
    ).issue,
    /payment/i,
  );
  await hallCommand(pool, actor, "unified-ext-halfpay-01", "receipt", {
    id: changeHall.id,
    method: "gcash",
    amount: 50000,
    reference: "SYNTHETIC-EXT-HALF",
    verified: true,
    evidence: "SYNTHETIC only",
    receivedAt: new Date().toISOString(),
  });
  assert.match(
    (
      await hallCommand(
        pool,
        actor,
        "unified-halfpay-ext-01",
        "extend",
        extension,
      )
    ).issue,
    /payment/i,
  );
  await hallCommand(pool, actor, "unified-ext-fullpay-01", "receipt", {
    id: changeHall.id,
    method: "gcash",
    amount: 50000,
    reference: "SYNTHETIC-EXT-FULL",
    verified: true,
    evidence: "SYNTHETIC only",
    receivedAt: new Date().toISOString(),
  });
  assert.equal(
    (
      await hallCommand(
        pool,
        actor,
        "unified-funded-ext-01",
        "extend",
        extension,
      )
    ).status,
    "confirmed",
  );
  const changeFinancials = (
    await guestReservations(guest, pool, { reservationId: changeHold.id })
  )[0].financials;
  assert.equal(changeFinancials.netChargeCentavos, 400000);
  assert.equal(changeFinancials.collectedCentavos, 400000);
  assert.equal(changeFinancials.balanceCentavos, 0);
  await guestHallAction(pool, guest, changeHall.id, "cancel", {
    requestKey: "unified-changed-cancel",
    reason: "SYNTHETIC fully funded changed-item cancellation",
  });
  assert.equal(
    (
      await pool.query(
        "select amount_centavos from staytrack.hall_refund_approvals where reservation_id=$1",
        [changeHall.id],
      )
    ).rows[0].amount_centavos,
    "400000",
  );
  const cancelledChange = (
    await guestReservations(guest, pool, { reservationId: changeHold.id })
  )[0].financials;
  assert.equal(cancelledChange.netChargeCentavos, 0);
  assert.equal(cancelledChange.refundDueCentavos, 400000);
  const cheaperHold = await make("unified-cheaper-hold01", [], {
    ...hall(9),
    start: day(9) + "T17:00",
  });
  const cheaperReceivedAt = new Date(Date.now() - 1000).toISOString();
  await submitPaymentProof(
    guest,
    cheaperHold.id,
    "SYNTHETIC-UB-CHEAPER",
    png,
    "image/png",
    pool,
    store,
  );
  const cheaperSubmission = (
    await pool.query(
      "select id from staytrack.payment_submissions where reservation_id=$1",
      [cheaperHold.id],
    )
  ).rows[0];
  await decidePaymentReview(
    actor,
    cheaperSubmission.id,
    {
      ...decision,
      requestKey: "unified-cheaper-review",
      verification: {
        ...decision.verification,
        reference: "SYNTHETIC-UB-CHEAPER",
        amountCentavos: 500000,
        receivedAt: cheaperReceivedAt,
      },
    },
    pool,
  );
  const cheaperHall = (
    await guestReservations(guest, pool, { reservationId: cheaperHold.id })
  )[0].hall;
  const cheaperClaim = (
    await pool.query(
      "select claim_id from staytrack.hall_reservations where id=$1",
      [cheaperHall.id],
    )
  ).rows[0].claim_id;
  assert.equal(
    (
      await hallCommand(pool, actor, "unified-cheaper-move01", "reschedule", {
        id: cheaperHall.id,
        expectedClaim: cheaperClaim,
        reason: "Approved lower-price move",
        ...hall(10),
      })
    ).status,
    "confirmed",
  );
  const cheaperBefore = (
    await guestReservations(guest, pool, { reservationId: cheaperHold.id })
  )[0].financials;
  assert.equal(cheaperBefore.netChargeCentavos, 300000);
  assert.equal(cheaperBefore.balanceCentavos, -200000);
  assert.equal(cheaperBefore.refundDueCentavos, 0);
  await assert.rejects(
    hallCommand(pool, actor, "unified-cheaper-over01", "approve_refund", {
      id: cheaperHall.id,
      amount: 200001,
      reason: "SYNTHETIC excessive refund must fail",
    }),
  );
  const surplus = await hallCommand(
    pool,
    actor,
    "unified-cheaper-credit",
    "approve_refund",
    {
      id: cheaperHall.id,
      amount: 200000,
      reason: "Verified item-only surplus after reduced-price move",
    },
  );
  await assert.rejects(
    hallCommand(pool, actor, "unified-cheaper-over02", "approve_refund", {
      id: cheaperHall.id,
      amount: 1,
      reason: "SYNTHETIC duplicate approval must fail",
    }),
  );
  await hallCommand(pool, actor, "unified-cheaper-return", "complete_refund", {
    id: cheaperHall.id,
    approval: surplus.id,
    method: "gcash",
    reference: "SYNTHETIC-CHEAPER-REFUND",
    verified: true,
    evidence: "SYNTHETIC manual transfer",
    transferredAt: new Date().toISOString(),
  });
  await guestHallAction(pool, guest, cheaperHall.id, "cancel", {
    requestKey: "unified-cheaper-cancel",
    reason: "SYNTHETIC reconciled current-item cancellation",
  });
  const cheaperCancelled = (
    await guestReservations(guest, pool, { reservationId: cheaperHold.id })
  )[0].financials;
  assert.equal(cheaperCancelled.netChargeCentavos, 0);
  assert.equal(cheaperCancelled.refundDueCentavos, 300000);
  assert.equal(cheaperCancelled.balanceCentavos, -300000);
  await pool.query(
    "update staytrack.operational_settings set cleaning_buffer_minutes=null",
  );
  const independentHall = await make("unified-independent01", [], hall(11));
  assert.ok(
    independentHall.id,
    "Hall-only hold must not depend on bedroom turnover settings",
  );
  await pool.query(
    "update staytrack.operational_settings set cleaning_buffer_minutes=15",
  );
  await assert.rejects(
    claimTransaction(
      (db) =>
        quoteUnified([], { ...hall(5), noticeReason: "guest override" }, db),
      pool,
    ),
  );
  const rights = await pool.query(
    "select relrowsecurity rls,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') a,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') b from pg_class where oid in ('staytrack.online_hall_items'::regclass,'staytrack.online_hall_requests'::regclass)",
  );
  assert.ok(rights.rows.every((r) => r.rls && !r.a && !r.b));
  console.log(
    "Verified mixed/Hall-only holds, rollback, exclusivity race, ownership, full payment, proof protection, atomic confirmation, one receipt, item cancellation/refund, expiry and private access.",
  );
}
