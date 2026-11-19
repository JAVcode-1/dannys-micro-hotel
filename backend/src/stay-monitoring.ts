import type { Express, RequestHandler } from "express";
import type { PoolClient } from "pg";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { BookingError } from "./booking-quote.js";

// Payments have reservation scope: do not invent a per-room payment allocation.
async function balance(db: PoolClient, reservationId: string) {
  const installed = (
    await db.query(
      "select to_regclass('staytrack.reservation_financials') is not null as installed",
    )
  ).rows[0].installed;
  if (installed) {
    const value = Number(
      (
        await db.query(
          "select coalesce((to_jsonb(f)->>'settlement_due_centavos')::bigint,balance_centavos) as balance_centavos from staytrack.reservation_financials f where reservation_id=$1",
          [reservationId],
        )
      ).rows[0]?.balance_centavos,
    );
    if (!Number.isSafeInteger(value)) throw new Error("Invalid balance");
    return Math.max(0, value);
  }
  const row = (
    await db.query<{ balance: string }>(
      `select greatest(0,r.total_centavos-
    case when r.channel='walk_in' then coalesce((select sum(amount_centavos)
      from staytrack.walkin_ledger where reservation_id=r.id and kind='payment'),0)
    else coalesce((select sum(v.amount_centavos) from staytrack.verified_online_payments v
      join staytrack.payment_submissions p on p.id=v.submission_id
      where p.reservation_id=r.id and p.status='confirmed'),0) end)::text as balance
    from staytrack.reservations r where r.id=$1`,
      [reservationId],
    )
  ).rows[0];
  const amount = Number(row?.balance);
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new Error("Invalid balance");
  return amount;
}

export async function monitoredStays(pool = databasePool()) {
  return claimTransaction(async (db) => {
    const settings = (
      await db.query(
        `select checkout_alert_minutes,checkout_warning_minutes from staytrack.operational_settings where id=true`,
      )
    ).rows[0];
    const x03 = (
      await db.query(
        "select to_regclass('staytrack.stay_item_terms') is not null as installed",
      )
    ).rows[0].installed;
    const items = (
      await db.query(`select b.id,b.reservation_id,r.channel,b.category_code,
      s.checked_in_at,${x03 ? "t.effective_checkout_at" : "s.checkout_at"} as checkout_at,s.checkout_at as original_checkout_at,rm.code as room_code,o.checked_out_at,o.exception_reason,
      rm.operational_state
      from staytrack.room_check_ins s join staytrack.room_bookings b on b.id=s.room_booking_id
      join staytrack.reservations r on r.id=b.reservation_id
      join staytrack.rooms rm on rm.id=s.room_id
      left join staytrack.room_checkouts o on o.room_booking_id=b.id
      ${x03 ? "join staytrack.stay_item_terms t on t.room_booking_id=b.id" : ""}
      order by (o.room_booking_id is not null),checkout_at,b.id limit 100`)
    ).rows;
    for (const item of items)
      item.balance_centavos = await balance(db, item.reservation_id);
    const now = (await db.query("select clock_timestamp() as now")).rows[0].now;
    return {
      items,
      serverNow: now,
      warningMinutes:
        settings?.checkout_warning_minutes ??
        (settings?.checkout_alert_minutes == null
          ? []
          : [settings.checkout_alert_minutes]),
    };
  }, pool);
}

export async function checkout(
  actor: string,
  bookingId: string,
  input: unknown,
  pool = databasePool(),
) {
  const body = input as {
    requestKey?: unknown;
    exceptionReason?: unknown;
  } | null;
  const key = body?.requestKey;
  const reason =
    body?.exceptionReason === undefined || body.exceptionReason === null
      ? null
      : body.exceptionReason;
  if (
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(bookingId) ||
    typeof key !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(key) ||
    (reason !== null &&
      (typeof reason !== "string" || !reason.trim() || reason.length > 1000))
  )
    throw new BookingError(
      "Valid room item, retry key and exception reason are required.",
    );
  const normalizedReason = typeof reason === "string" ? reason.trim() : null;
  try {
    return await claimTransaction(async (db) => {
      const staff = await db.query(
        "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
        [actor],
      );
      if (!staff.rowCount) throw new BookingError("Staff access denied.", 403);
      const item = (
        await db.query(
          `select b.reservation_id,b.claim_id,i.category_id
        from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
        join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1 for update of r,b`,
          [bookingId],
        )
      ).rows[0];
      if (!item) throw new BookingError("Booking item not found.", 404);
      const prior = (
        await db.query(
          "select * from staytrack.room_checkouts where room_booking_id=$1",
          [bookingId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.actor_auth_user_id === actor &&
          prior.request_key === key &&
          prior.exception_reason === normalizedReason
        )
          return prior;
        throw new BookingError(
          "Checkout already recorded with a different request.",
          409,
        );
      }
      await db.query("select pg_advisory_xact_lock($1::bigint)", [
        item.category_id,
      ]);
      const stay = (
        await db.query(
          `select s.*,i.buffer_minutes,i.buffered_end_at,i.state from staytrack.room_check_ins s
        join staytrack.inventory_claims i on i.id=$2 where s.room_booking_id=$1 for update of i`,
          [bookingId, item.claim_id],
        )
      ).rows[0];
      if (!stay || stay.state === "released")
        throw new BookingError("An active checked-in stay is required.", 409);
      const amount = await balance(db, item.reservation_id);
      if (amount > 0 && !normalizedReason)
        throw new BookingError(
          "Settle the reservation balance or document an unpaid-departure exception.",
          409,
        );
      // Match W02 lock order. Departure must remain possible even when late cleaning overlaps a future claim.
      await db.query(
        "lock table staytrack.room_blocks in share row exclusive mode",
      );
      const room = await db.query(
        "select 1 from staytrack.rooms where id=$1 and operational_state='occupied' for update",
        [stay.room_id],
      );
      if (!room.rowCount)
        throw new BookingError("Occupied room requires reconciliation.", 409);
      const now = (await db.query("select clock_timestamp() as now")).rows[0]
        .now;
      const protectionEnd = new Date(
        Math.max(
          +stay.buffered_end_at,
          +now + stay.buffer_minutes * 60000,
          +now + 1,
        ),
      );
      const block = (
        await db.query(
          `insert into staytrack.room_blocks(room_id,start_at,end_at,reason)
        values ($1,$2,greatest($3,(select buffered_end_at from staytrack.inventory_claims where id=$4)),'Checkout cleaning buffer') returning id`,
          [stay.room_id, now, protectionEnd, item.claim_id],
        )
      ).rows[0];
      const result = (
        await db.query(
          `insert into staytrack.room_checkouts
        (room_booking_id,actor_auth_user_id,request_key,checked_out_at,balance_centavos,exception_reason,cleaning_block_id)
        values ($1,$2,$3,$4,$5,$6,$7) returning *`,
          [bookingId, actor, key, now, amount, normalizedReason, block.id],
        )
      ).rows[0];
      await db.query(
        "update staytrack.inventory_claims set state='released' where id=$1",
        [item.claim_id],
      );
      await db.query(
        "update staytrack.rooms set operational_state='cleaning' where id=$1",
        [stay.room_id],
      );
      await db.query(
        "insert into staytrack.staff_audit(actor_auth_user_id,action) values ($1,$2)",
        [
          actor,
          amount > 0 ? "room.checked_out_unpaid_exception" : "room.checked_out",
        ],
      );
      return result;
    }, pool);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new BookingError(
        "Checkout retry key conflicts with another request.",
        409,
      );
    throw error;
  }
}

export function registerStayMonitoring(
  app: Express,
  staff: RequestHandler,
  enabled = false,
  pool?: ReturnType<typeof databasePool>,
) {
  app.get("/staff/stays", staff, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json({ ...(await monitoredStays(pool)), enabled });
    } catch {
      res.status(503).json({
        error:
          "Stay monitor unavailable. Approved checkout migration is required.",
      });
    }
  });
  app.post("/staff/stays/:id/checkout", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live checkout is closed pending acceptance." });
      return;
    }
    try {
      res.json(
        await checkout(
          res.locals.actorId as string,
          String(req.params.id),
          req.body,
          pool,
        ),
      );
    } catch (error) {
      res.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Checkout unavailable. Retry or reconcile with staff.",
      });
    }
  });
}
