import type { PoolClient } from "pg";
import { BookingError } from "./booking-quote.js";

const clock = (expression: string) =>
  `to_char(${expression} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

const receipts = `
  select 'online:'||v.submission_id id, p.reservation_id,
    null::uuid item, v.received_at at, v.verified_at recorded,
    v.amount_centavos amount, v.normalized_reference reference,
    g.online_submission_id=v.submission_id registry_ok
  from staytrack.verified_online_payments v
  join staytrack.payment_submissions p on p.id=v.submission_id
  left join staytrack.gcash_reference_registry g using(normalized_reference)
  union all
  select 'walkin:'||w.id,w.reservation_id,null,
    coalesce(w.received_at,w.recorded_at),w.recorded_at,w.amount_centavos,
    w.normalized_reference,w.method='cash' or g.walkin_entry_id=w.id
  from staytrack.walkin_ledger w
  left join staytrack.gcash_reference_registry g using(normalized_reference)
  where w.kind='payment'
  union all
  select 'stay:'||s.id,s.reservation_id,s.room_booking_id,s.received_at,
    s.recorded_at,s.amount_centavos,s.normalized_reference,
    s.method='cash' or g.stay_receipt_id=s.id
  from staytrack.stay_receipts s
  left join staytrack.gcash_reference_registry g using(normalized_reference)
`;

export async function loadAnalyticsRows(
  client: PoolClient,
  from: string,
  end: string,
) {
  const deadline = performance.now() + 5000;
  let remaining = 50000;
  async function read<T extends Record<string, unknown>>(
    sql: string,
    args: unknown[],
    cap = remaining,
  ) {
    const ms = Math.floor(deadline - performance.now());
    if (ms <= 0) throw new BookingError("Analytics query timed out.", 503);
    await client.query("select set_config('statement_timeout',$1,true)", [
      String(ms),
    ]);
    const result = await client.query<T>(
      `select * from (${sql}) bounded limit $${args.length + 1}`,
      [...args, Math.min(cap, remaining) + 1],
    );
    if (result.rows.length > Math.min(cap, remaining)) {
      throw new BookingError(
        "Analytics query exceeded its input limit. Select a shorter date range.",
        422,
      );
    }
    remaining -= result.rows.length;
    return result.rows;
  }
  const candidates = await read<{ reservation_id: string }>(
    `
    select reservation_id from (${receipts}) receipts where at >= $1 and at < $2
    union select b.reservation_id from staytrack.refund_transfers t
      join staytrack.room_bookings b on b.id=t.room_booking_id
      where t.transferred_at >= $1 and t.transferred_at < $2
    union select id from staytrack.reservations
      where online_confirmation_at >= $1 and online_confirmation_at < $2
    union select b.reservation_id from staytrack.room_check_ins c
      join staytrack.room_bookings b on b.id=c.room_booking_id
      join staytrack.reservations r on r.id=b.reservation_id
      where r.channel='walk_in' and (
        (r.total_centavos=0 and c.checked_in_at >= $1 and c.checked_in_at < $2)
        or exists (select 1 from staytrack.walkin_ledger w where w.reservation_id=b.reservation_id
          and w.kind='payment' and w.recorded_at >= $1 and w.recorded_at < $2))
    union select b.reservation_id from staytrack.stay_extension_decisions d
      join staytrack.room_bookings b on b.id=d.room_booking_id
      where d.approved and d.recorded_at >= $1 and d.recorded_at < $2
  `,
    [from, end],
    10000,
  );
  const ids = candidates.map((row) => row.reservation_id);
  const payments = await read<{
    id: string;
    reservation_id: string;
    item: string | null;
    at: string;
    recorded: string;
    amount: string;
    reference: string | null;
    registry_ok: boolean | null;
  }>(
    `select id,reservation_id,item,${clock("at")} at,${clock("recorded")} recorded,
    amount::text,reference,registry_ok from (${receipts}) receipts
    where reservation_id=any($1::uuid[]) and at < $2`,
    [ids, end],
  );
  const registry = new Map<string, string>();
  for (const payment of payments) {
    if (
      payment.registry_ok !== true ||
      (payment.reference &&
        registry.has(payment.reference) &&
        registry.get(payment.reference) !== payment.id)
    ) {
      throw new Error("Conflicting GCash registry ownership");
    }
    if (payment.reference) registry.set(payment.reference, payment.id);
  }

  const items = await read<{
    id: string;
    reservation: string;
    category: string;
    at: string;
    confirmation: string | null;
    check_in: string | null;
    cancellation: string | null;
    snapshot: unknown;
    base: string;
    extra: string;
    total: string;
    channel: string;
  }>(
    `select b.id,b.reservation_id reservation,b.category_code category,
    ${clock("coalesce(w.recorded_at,r.created_at)")} at,
    ${clock("r.online_confirmation_at")} confirmation,
    ${clock("i.checked_in_at")} check_in,${clock("c.decided_at")} cancellation,
    b.pricing_snapshot snapshot,b.base_centavos::text base,b.extra_bed_centavos::text extra,
    r.total_centavos::text total,r.channel
    from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
    left join staytrack.walkin_ledger w on w.room_booking_id=b.id and w.kind='charge'
    left join staytrack.room_check_ins i on i.room_booking_id=b.id
    left join staytrack.cancellation_decisions c on c.room_booking_id=b.id and c.approved
    where r.id=any($1::uuid[])`,
    [ids],
  );
  const refunds = await read<{
    id: string;
    item: string;
    receipt: string;
    at: string;
    amount: string;
  }>(
    `select 'refund:'||t.room_booking_id id,t.room_booking_id item,
    'online:'||c.original_payment_id receipt,${clock("t.transferred_at")} at,t.amount_centavos::text amount
    from staytrack.refund_transfers t join staytrack.refund_claims c using(room_booking_id)
    join staytrack.room_bookings b on b.id=t.room_booking_id
    where b.reservation_id=any($1::uuid[]) and t.transferred_at >= $2 and t.transferred_at < $3`,
    [ids, from, end],
  );
  const extensions = await read<{
    id: string;
    item: string;
    snapshot: unknown;
    amount: string;
    approval: string | null;
  }>(
    `select q.id,q.room_booking_id item,q.package_snapshot snapshot,
    q.amount_centavos::text amount,${clock("d.recorded_at")} approval
    from staytrack.stay_extension_requests q
    join staytrack.room_bookings b on b.id=q.room_booking_id
    left join staytrack.stay_extension_decisions d on d.request_id=q.id and d.approved
    where b.reservation_id=any($1::uuid[]) and q.recorded_at < $2`,
    [ids, end],
  );
  const extras = await read<{
    id: string;
    item: string;
    at: string;
    amount: string;
    kind: string;
    credit_of: string | null;
  }>(
    `select e.id,e.room_booking_id item,${clock("e.recorded_at")} at,
    e.amount_centavos::text amount,e.kind,e.credit_of
    from staytrack.stay_charge_entries e join staytrack.room_bookings b on b.id=e.room_booking_id
    where b.reservation_id=any($1::uuid[]) and e.recorded_at < $2
      and e.kind in ('overtime_debit','smoking_debit','charge_credit')`,
    [ids, end],
  );
  const allocations = await read<{
    receipt: string;
    item: string;
    at: string;
    amount: string;
    extension: string | null;
    charge: string | null;
    released: string | null;
  }>(
    `select 'stay:'||a.receipt_id receipt,a.room_booking_id item,
    ${clock("a.recorded_at")} at,a.amount_centavos::text amount,
    a.extension_request_id extension,a.charge_id charge,${clock("r.recorded_at")} released
    from staytrack.stay_receipt_allocations a join staytrack.room_bookings b on b.id=a.room_booking_id
    left join staytrack.stay_receipt_allocations r on r.release_of=a.id
    where b.reservation_id=any($1::uuid[]) and a.kind='allocate' and a.recorded_at < $2`,
    [ids, end],
  );
  if (performance.now() >= deadline)
    throw new BookingError("Analytics query timed out.", 503);
  return {
    items,
    payments,
    registry,
    refunds,
    extensions,
    extras,
    allocations,
  };
}
