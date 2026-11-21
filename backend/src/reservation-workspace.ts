import type { Express, RequestHandler } from "express";
import { BookingError } from "./booking-quote.js";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { readStayFinancials } from "./stay-finance.js";

export function parseReservationSearch(query: Record<string, unknown>) {
  const q = query.q ?? "";
  const page = query.page ?? "0";
  if (
    typeof q !== "string" ||
    q.length > 120 ||
    typeof page !== "string" ||
    !/^\d{1,6}$/.test(page)
  )
    throw new BookingError("Invalid reservation search.");
  return { q: q.trim(), page: Number(page) };
}

export function reservationState(item: {
  state: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}) {
  if (item.checkedOutAt) return "Checked out";
  if (item.checkedInAt) return "Checked in";
  return (
    (
      {
        proof_pending_review: "Awaiting staff payment review",
        held: "Payment hold",
        confirmed: "Confirmed",
        walkin_reserved: "Walk-in reserved",
        released: "Released",
        expired: "Expired",
      } as Record<string, string>
    )[item.state] ?? item.state
  );
}

export async function staffReservationIndex(
  query: Record<string, unknown>,
  pool = databasePool(),
) {
  const { q, page } = parseReservationSearch(query);
  const rows = (
    await pool.query(
      `select r.id,r.primary_name as "primaryName",r.channel,r.created_at as "createdAt",
    r.total_centavos::float8 as "totalCentavos",count(b.id)::int as "roomCount",
    array_agg(distinct i.state) as states
    from staytrack.reservations r join staytrack.room_bookings b on b.reservation_id=r.id
    join staytrack.inventory_claims i on i.id=b.claim_id
    where ($1='' or position(lower($1) in lower(r.primary_name))>0 or position(lower($1) in r.id::text)>0
      or position(lower($1) in lower(coalesce(r.verified_email,'')))>0)
    group by r.id order by r.created_at desc,r.id limit 51 offset $2`,
      [q, page * 50],
    )
  ).rows;
  return { reservations: rows.slice(0, 50), hasMore: rows.length > 50, page };
}

export async function staffReservationDetail(
  id: string,
  pool = databasePool(),
) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id))
    throw new BookingError("Invalid reservation.");
  return claimTransaction(async (db) => {
    await db.query("set transaction isolation level repeatable read read only");
    const reservation = (
      await db.query(
        `select id,primary_name as "primaryName",verified_email as email,channel,created_at as "createdAt",total_centavos::float8 as "totalCentavos" from staytrack.reservations where id=$1`,
        [id],
      )
    ).rows[0];
    if (!reservation) throw new BookingError("Reservation not found.", 404);
    const contactTable =
      reservation.channel === "walk_in"
        ? "walkin_guest_contacts"
        : "reservation_booking_contacts";
    const installed = (
      await db.query(
        "select to_regclass('staytrack.'||$1) is not null as installed",
        [contactTable],
      )
    ).rows[0].installed;
    const contact = installed
      ? ((
          await db.query(
            `select phone,${reservation.channel === "walk_in" ? "email,minor_id_status,minor_id_checked_by,minor_id_checked_at," : ""}policy_version,acknowledged_by,acknowledged_at from staytrack.${contactTable} where reservation_id=$1`,
            [id],
          )
        ).rows[0] ?? null)
      : null;
    const items = (
      await db.query(
        `select b.id,b.category_code as category,b.start_at as "startAt",b.end_at as "endAt",
      b.adult_count as adults,b.child_count as children,b.total_centavos::float8 as "totalCentavos",i.state,
      (select json_agg((p->>'durationMinutes')::integer) from jsonb_array_elements(b.pricing_snapshot) p) as blocks,
      coalesce((to_jsonb(b)->>'schedule_revision')::bigint,0)::float8 as "scheduleRevision",
      (to_jsonb(b)->>'pending_reschedule_id') is not null as "pendingReschedule",
      r.online_confirmation_at as "confirmationAt",
      ci.checked_in_at as "checkedInAt",co.checked_out_at as "checkedOutAt",coalesce(t.effective_checkout_at,ci.checkout_at) as "checkoutAt",rm.code as "roomCode"
      from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id join staytrack.inventory_claims i on i.id=b.claim_id
      left join staytrack.room_check_ins ci on ci.room_booking_id=b.id left join staytrack.room_checkouts co on co.room_booking_id=b.id
      left join staytrack.stay_item_terms t on t.room_booking_id=b.id
      left join staytrack.rooms rm on rm.id=ci.room_id where b.reservation_id=$1 order by b.item_index`,
        [id],
      )
    ).rows.map((item) => ({ ...item, status: reservationState(item) }));
    const financials = await readStayFinancials(db, id);
    const payments = (
      await db.query(
        `select 'walk_in' as source,l.id::text,l.method,l.amount_centavos::float8 as "amountCentavos",l.recorded_at as "recordedAt" from staytrack.walkin_ledger l where l.reservation_id=$1 and l.kind='payment'
      union all select 'online',v.submission_id::text,'gcash',v.amount_centavos::float8,v.verified_at from staytrack.verified_online_payments v join staytrack.payment_submissions p on p.id=v.submission_id where p.reservation_id=$1
      union all select 'stay',s.id::text,s.method,s.amount_centavos::float8,s.recorded_at from staytrack.stay_receipts s join staytrack.room_bookings b on b.id=s.room_booking_id where b.reservation_id=$1 order by "recordedAt"`,
        [id],
      )
    ).rows;
    const refunds = (
      await db.query(
        `select b.id as "roomBookingId",d.refund_centavos::float8 as "amountCentavos",case when t.room_booking_id is not null then 'recorded' when c.room_booking_id is not null then 'processing' else 'due' end as status,t.transferred_at as "transferredAt" from staytrack.room_bookings b join staytrack.cancellation_decisions d on d.room_booking_id=b.id left join staytrack.refund_claims c on c.room_booking_id=b.id left join staytrack.refund_transfers t on t.room_booking_id=b.id where b.reservation_id=$1 and d.approved and d.refund_centavos>0`,
        [id],
      )
    ).rows;
    return { reservation, contact, items, financials, payments, refunds };
  }, pool);
}

export function registerReservationWorkspace(
  app: Express,
  staff: RequestHandler,
  pool?: ReturnType<typeof databasePool>,
  enabled = false,
) {
  app.get("/staff/dashboard", staff, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const result = await (pool ?? databasePool()).query(`select
        (select count(*)::int from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id
          where i.state in ('confirmed','walkin_reserved') and (b.start_at at time zone 'Asia/Manila')::date=(clock_timestamp() at time zone 'Asia/Manila')::date
          and not exists(select 1 from staytrack.room_check_ins ci where ci.room_booking_id=b.id)) as arrivals,
        (select count(*)::int from staytrack.payment_submissions where status='pending_review') as "paymentReviews",
        (select count(*)::int from staytrack.room_check_ins ci where not exists(select 1 from staytrack.room_checkouts co where co.room_booking_id=ci.room_booking_id)) as occupied,
        (select count(*)::int from staytrack.room_check_ins ci left join staytrack.stay_item_terms t on t.room_booking_id=ci.room_booking_id where coalesce(t.effective_checkout_at,ci.checkout_at)<=clock_timestamp() and not exists(select 1 from staytrack.room_checkouts co where co.room_booking_id=ci.room_booking_id)) as overdue,
        (select count(*)::int from staytrack.rooms where active and operational_state='cleaning') as "needsCleaning",
        (select count(*)::int from staytrack.rooms where active and operational_state='maintenance') as maintenance`);
      res.json(result.rows[0]);
    } catch {
      res.status(503).json({
        error:
          "Operational dashboard unavailable. Use the individual queues and reconcile.",
      });
    }
  });
  app.get("/staff/reservations", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json(await staffReservationIndex(req.query, pool));
    } catch (error) {
      res.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Reservation index unavailable.",
      });
    }
  });
  app.get("/staff/reservations/:id", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json({
        ...(await staffReservationDetail(String(req.params.id), pool)),
        rescheduleEnabled: enabled,
      });
    } catch (error) {
      res.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Reservation workspace unavailable.",
      });
    }
  });
}
