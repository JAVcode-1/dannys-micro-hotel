import assert from "node:assert/strict";
import console from "node:console";
import { loadAnalyticsRows } from "../dist/analytics-data.js";
import { calculateAnalytics } from "../dist/analytics-report.js";
import { hallReport } from "../dist/hall-reports.js";
import { readStayFinancials } from "../dist/stay-finance.js";
import { staffReservationDetail } from "../dist/reservation-workspace.js";

// Called on a freshly verified mixed fixture, before item changes/refunds.
export async function assertUnifiedFinance(pool, reservationId) {
  const {
    rows: [original],
  } = await pool.query(
    `select r.total_centavos::text total,
    o.original_centavos::text hall,
    (select sum(b.total_centavos)::text from staytrack.room_bookings b where b.reservation_id=r.id) rooms,
    (select sum(a.amount_centavos)::text from staytrack.online_payment_allocations a where a.reservation_id=r.id) allocated
    from staytrack.reservations r join staytrack.online_hall_items o on o.reservation_id=r.id where r.id=$1`,
    [reservationId],
  );
  assert.ok(original);
  assert.equal(
    BigInt(original.rooms) + BigInt(original.hall),
    BigInt(original.total),
  );
  assert.equal(original.allocated, original.total);
  const financials = await readStayFinancials(pool, reservationId);
  assert.equal(financials.originalCentavos, Number(original.total));
  assert.equal(financials.collectedCentavos, Number(original.total));
  assert.equal(financials.balanceCentavos, 0);
  assert.equal(financials.settlementDueCentavos, 0);
  const detail = await staffReservationDetail(reservationId, pool);
  assert.equal(
    detail.payments.reduce((sum, p) => sum + p.amountCentavos, 0),
    Number(original.total),
  );
  assert.equal(detail.hallItems.length, 1);
  const from = "2000-01-01T00:00:00.000000Z",
    end = "2100-01-01T00:00:00.000000Z";
  const client = await pool.connect();
  let roomGross;
  try {
    await client.query("begin isolation level repeatable read read only");
    const rows = await loadAnalyticsRows(client, from, end);
    const payment = rows.payments.find(
      (row) =>
        row.reservation_id === reservationId && row.id.startsWith("online:"),
    );
    assert.ok(payment);
    assert.equal(
      payment.amount,
      original.rooms,
      "room analytics must exclude the Hall allocation",
    );
    const selected = {
      ...rows,
      payments: rows.payments.filter(
        (row) => row.reservation_id === reservationId,
      ),
      items: rows.items.filter((row) => row.reservation === reservationId),
      refunds: [],
      extensions: [],
      extras: [],
      allocations: [],
    };
    roomGross = calculateAnalytics(selected, from, end, "day").overall.gross;
    assert.equal(roomGross, original.rooms);
  } finally {
    await client.query("rollback");
    client.release();
  }
  const {
    rows: [clock],
  } = await pool.query(
    "select (clock_timestamp() at time zone 'Asia/Manila')::date::text as \"day\"",
  );
  const hall = await hallReport(pool, clock.day, clock.day);
  const expected = (
    await pool.query(
      `select
    coalesce((select sum(amount_centavos) from staytrack.hall_receipts where (received_at at time zone 'Asia/Manila')::date=$1::date),0)
    +coalesce((select sum(amount_centavos) from staytrack.online_payment_allocations where hall_reservation_id is not null and (received_at at time zone 'Asia/Manila')::date=$1::date),0) total`,
      [clock.day],
    )
  ).rows[0].total;
  assert.equal(hall.gross, expected);
  assert.ok(BigInt(hall.gross) >= BigInt(original.hall));
  const bookings = (
    await pool.query(
      `select count(*)::int amount
    from staytrack.hall_reservations r join staytrack.hall_claims c on c.id=r.claim_id
    where c.released_at is null and r.status in ('confirmed','in_progress','completed','no_show')
      and c.event_start<($1::date+1)::timestamp at time zone 'Asia/Manila'
      and c.event_end>$1::date::timestamp at time zone 'Asia/Manila'`,
      [clock.day],
    )
  ).rows[0].amount;
  assert.equal(
    hall.utilization.bookings,
    bookings,
    "unpaid Hall holds must not count as confirmed bookings",
  );
  console.log(
    "Verified one shared payment, exact room/Hall allocations, separated revenue and parent statement.",
  );
}

export async function assertHallCancellationFinance(
  pool,
  reservationId,
  paidOut = false,
) {
  const {
    rows: [item],
  } = await pool.query(
    `select q.total_centavos::text hall,
    (r.total_centavos+q.total_centavos-o.original_centavos)::text total from staytrack.online_hall_items o
    join staytrack.reservations r on r.id=o.reservation_id
    join lateral(select total_centavos from staytrack.hall_revisions where reservation_id=o.hall_reservation_id order by id desc limit 1) q on true where r.id=$1`,
    [reservationId],
  );
  const financials = await readStayFinancials(pool, reservationId);
  assert.equal(
    financials.netChargeCentavos,
    Number(item.total) - Number(item.hall),
  );
  assert.equal(financials.refundDueCentavos, paidOut ? 0 : Number(item.hall));
  assert.equal(financials.balanceCentavos, paidOut ? 0 : -Number(item.hall));
  assert.equal(financials.settlementDueCentavos, 0);
  const detail = await staffReservationDetail(reservationId, pool);
  const refund = detail.refunds.find((r) => r.hallReservationId);
  assert.ok(refund);
  assert.equal(refund.amountCentavos, Number(item.hall));
  assert.equal(refund.status, paidOut ? "recorded" : "due");
  assert.equal(
    detail.hallItems[0].refundDueCentavos,
    paidOut ? 0 : Number(item.hall),
  );
  assert.equal(
    detail.hallItems[0].refundedCentavos,
    paidOut ? Number(item.hall) : 0,
  );
}
