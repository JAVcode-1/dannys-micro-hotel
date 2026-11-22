import type { Pool } from "pg";
import { BookingError } from "./booking-quote.js";

export async function hallReport(
  pool: Pick<Pool, "query">,
  from: unknown,
  to: unknown,
) {
  function day(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value))
      throw new BookingError("Enter Manila dates.");
    const instant = Date.parse(value + "T00:00:00Z");
    if (
      !Number.isFinite(instant) ||
      new Date(instant).toISOString().slice(0, 10) !== value
    )
      throw new BookingError("Enter Manila dates.");
    return instant;
  }
  const first = day(from);
  const last = day(to);
  if (last < first || last - first >= 366 * 86400000)
    throw new BookingError("Choose up to 366 days.");
  const unified =
    (
      await pool.query(
        "select to_regclass('staytrack.online_payment_allocations') is not null as installed",
      )
    ).rows[0]?.installed === true;
  const { rows } = await pool.query(
    `
    with bounds as (
      select $1::date::timestamp at time zone 'Asia/Manila' lo,
      ($2::date+1)::timestamp at time zone 'Asia/Manila' hi
    ), flows as (
      select received_at at,amount_centavos gross,0::bigint refund
      from staytrack.hall_receipts,bounds where received_at>=lo and received_at<hi
      ${
        unified
          ? `union all select received_at,amount_centavos,0::bigint
      from staytrack.online_payment_allocations,bounds
      where hall_reservation_id is not null and received_at>=lo and received_at<hi`
          : ""
      }
      union all select t.transferred_at,0,a.amount_centavos
      from staytrack.hall_refund_transfers t join staytrack.hall_refund_approvals a on a.id=t.approval_id
      cross join bounds where t.transferred_at>=lo and t.transferred_at<hi
    ), days as (
      select (at at time zone 'Asia/Manila')::date::text as "day",sum(gross)::text gross,
      sum(refund)::text refunds,(sum(gross)-sum(refund))::text net from flows group by 1
    ), occupied as (
      select coalesce(sum(extract(epoch from least(coalesce(actual_end,statement_timestamp()),hi)
        - greatest(actual_start,lo)))/60,0)::int actual_minutes
      from staytrack.hall_reservations,bounds
      where actual_start<hi and coalesce(actual_end,statement_timestamp())>lo
    ), usage as (
      select count(*) filter(where c.event_start<hi and c.event_end>lo)::int bookings,
      coalesce(sum(greatest(0,extract(epoch from least(c.event_end,hi)-greatest(c.event_start,lo))))/60,0)::int scheduled_minutes,
      coalesce(sum(greatest(0,extract(epoch from least(c.event_start,hi)-greatest(c.preparation_start,lo))))/60,0)::int preparation_minutes,
      coalesce(sum(greatest(0,extract(epoch from least(c.cleanup_end,hi)-greatest(c.event_end,lo))))/60,0)::int cleanup_minutes
      from staytrack.hall_reservations r join staytrack.hall_claims c on c.id=r.claim_id
      cross join bounds where c.released_at is null and r.status in ('confirmed','in_progress','completed','no_show') and c.preparation_start<hi and c.cleanup_end>lo
    )
    select coalesce(sum(gross),0)::text gross,coalesce(sum(refund),0)::text refunds,
      (coalesce(sum(gross),0)-coalesce(sum(refund),0))::text net,
      (select coalesce(json_agg(days order by "day"),'[]') from days) days,
      (select to_jsonb(usage)||to_jsonb(occupied) from usage cross join occupied) utilization from flows`,
    [from, to],
  );
  return rows[0];
}
