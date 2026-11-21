import { assertNoCancellation } from "./cancellations.js";
import { BookingError } from "./booking-quote.js";
import { claimTransaction } from "./inventory-claims.js";
import { databasePool } from "./database.js";
import type { Express, RequestHandler } from "express";

export async function checkInItems(pool = databasePool()) {
  const corrections = (
    await pool.query(
      "select to_regclass('staytrack.early_check_in_approvals') is not null as installed",
    )
  ).rows[0].installed;
  const x03 = (
    await pool.query(
      "select to_regclass('staytrack.stay_item_terms') is not null as installed",
    )
  ).rows[0].installed;
  const result = await pool.query(`
        select b.id, r.channel, b.category_code as category, b.start_at, b.end_at,
          ${corrections ? "(select json_build_object('decision',n.decision,'note',n.note,'occurredAt',n.occurred_at) from staytrack.accommodation_no_show_reviews n where n.room_booking_id=b.id order by n.occurred_at desc,n.id desc limit 1)" : "null"} as no_show_review,
          coalesce(r.channel='online' and s.room_booking_id is null
            and clock_timestamp() >= b.start_at + interval '1 hour',false) as late,
          s.checked_in_at, ${x03 ? "coalesce(t.effective_checkout_at,s.checkout_at)" : "s.checkout_at"} as checkout_at, s.checkout_at as original_checkout_at, assigned.code as assigned_room,
          coalesce((select json_agg(json_build_object('id',rm.id::text,'code',rm.code) order by rm.code)
            from staytrack.rooms rm where rm.category_id=i.category_id and rm.active
            and rm.operational_state='ready' ${corrections ? "and staytrack.room_is_physically_ready(rm.id)" : ""}),'[]'::json) as rooms
        from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
        join staytrack.inventory_claims i on i.id=b.claim_id
        left join staytrack.room_check_ins s on s.room_booking_id=b.id
        ${x03 ? "left join staytrack.stay_item_terms t on t.room_booking_id=b.id" : ""}
        left join staytrack.rooms assigned on assigned.id=s.room_id
        where (r.channel='walk_in' and i.state='walkin_reserved')
           or (r.channel='online' and b.status='confirmed' and i.state='confirmed')
        order by (s.room_booking_id is not null), (b.end_at<=clock_timestamp()), b.start_at,b.id limit 100`);
  return result.rows;
}

export function registerCheckIn(
  app: Express,
  staff: RequestHandler,
  enabled = false,
  pool?: ReturnType<typeof databasePool>,
) {
  app.get("/staff/check-ins", staff, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json({ items: await checkInItems(pool), enabled });
    } catch {
      res.status(503).json({ error: "Check-in desk unavailable." });
    }
  });
  app.post("/staff/check-ins/:id", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live check-in is closed pending acceptance." });
      return;
    }
    try {
      res.json(
        await checkIn(
          res.locals.actorId as string,
          String(req.params.id),
          req.body?.roomId,
          req.body?.requestKey,
          pool,
          req.body?.earlyApproval,
        ),
      );
    } catch (error) {
      res.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Check-in unavailable. Retry or reconcile with staff.",
      });
    }
  });
  app.post("/staff/check-ins/:id/no-show", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live no-show review is closed pending acceptance." });
      return;
    }
    try {
      res.json(
        await recordNoShow(
          res.locals.actorId,
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
            : "No-show review unavailable.",
      });
    }
  });
}

export function stayTimes(
  channel: string,
  start: Date,
  end: Date,
  now: Date,
  earlyApproved = false,
) {
  if (channel === "walk_in")
    return { start: now, end: new Date(+now + (+end - +start)) };
  if (now >= end)
    throw new BookingError(
      "Scheduled stay has ended. Reconcile with staff.",
      409,
    );
  if (now < start) {
    if (!earlyApproved)
      throw new BookingError(
        "Explicit early check-in approval is required.",
        409,
      );
    return { start: now, end: new Date(+now + (+end - +start)) };
  }
  return { start, end };
}

export async function checkIn(
  actor: string,
  bookingId: string,
  roomId: unknown,
  key: unknown,
  pool = databasePool(),
  earlyApproval?: unknown,
) {
  if (
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(bookingId) ||
    typeof roomId !== "string" ||
    !/^[1-9]\d{0,14}$/.test(roomId) ||
    typeof key !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(key)
  )
    throw new BookingError(
      "Select a booking item and room with a valid retry key.",
    );
  const conflict = (message: string) => new BookingError(message, 409);
  try {
    return await claimTransaction(async (db) => {
      const staff = await db.query(
        "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
        [actor],
      );
      if (!staff.rowCount) throw new BookingError("Staff access denied.", 403);
      const item = (
        await db.query<{
          claim_id: string;
          category_id: string;
          reservation_id: string;
          start_at: Date;
          end_at: Date;
          channel: string;
          status: string;
          online_confirmation_at: Date | null;
        }>(
          `select b.claim_id,i.category_id,b.reservation_id,b.start_at,b.end_at,b.status,
          r.channel,r.online_confirmation_at
        from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id
        join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1 for update of r,b`,
          [bookingId],
        )
      ).rows[0];
      if (!item) throw new BookingError("Booking item not found.", 404);
      const prior = (
        await db.query(
          "select * from staytrack.room_check_ins where room_booking_id=$1",
          [bookingId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.actor_auth_user_id === actor &&
          prior.request_key === key &&
          prior.room_id === roomId
        )
          return prior;
        throw conflict("This booking item is already checked in.");
      }
      await assertNoCancellation(db, bookingId);
      await db.query("select pg_advisory_xact_lock($1::bigint)", [
        item.category_id,
      ]);
      const claim = (
        await db.query<{ state: string; buffer_minutes: number }>(
          "select state,buffer_minutes from staytrack.inventory_claims where id=$1 for update",
          [item.claim_id],
        )
      ).rows[0];
      if (item.channel === "walk_in") {
        const eligible = await db.query(
          `select 1 from staytrack.reservations r
          join staytrack.walkin_ledger l on l.reservation_id=r.id where r.id=$1
          group by r.id having sum(l.amount_centavos) filter (where l.kind='charge')=r.total_centavos
          and coalesce(sum(l.amount_centavos) filter (where l.kind='payment'),0)>=ceil(r.total_centavos::numeric/2)`,
          [item.reservation_id],
        );
        if (claim.state !== "walkin_reserved" || !eligible.rowCount)
          throw conflict(
            "Walk-in capacity and the 50% payment minimum are required.",
          );
      } else {
        const verified = await db.query(
          `select 1 from staytrack.payment_submissions p
          join staytrack.verified_online_payments v on v.submission_id=p.id
          where p.reservation_id=$1 and p.status='confirmed'`,
          [item.reservation_id],
        );
        if (
          !verified.rowCount ||
          !item.online_confirmation_at ||
          item.status !== "confirmed" ||
          claim.state !== "confirmed"
        )
          throw conflict("Confirmed online payment and capacity are required.");
      }
      await db.query("lock table staytrack.room_blocks in share mode");
      const room = await db.query(
        `select 1 from staytrack.rooms
        where id=$1 and category_id=$2 and active and operational_state='ready' for update`,
        [roomId, item.category_id],
      );
      if (!room.rowCount)
        throw conflict("Select a Ready room in the booked category.");
      const now = (
        await db.query<{ now: Date }>("select clock_timestamp() as now")
      ).rows[0].now;
      const early = item.channel === "online" && now < item.start_at;
      if (
        early &&
        (typeof earlyApproval !== "string" ||
          !earlyApproval.trim() ||
          earlyApproval.length > 1000)
      )
        throw conflict(
          "Explicit early check-in approval with a reason is required.",
        );
      const times = stayTimes(
        item.channel,
        item.start_at,
        item.end_at,
        now,
        early,
      );
      const bufferedEnd = new Date(+times.end + claim.buffer_minutes * 60000);
      const block = await db.query(
        `select 1 from staytrack.room_blocks where room_id=$1
        and tstzrange(start_at,end_at,'[)') && tstzrange($2,$3,'[)')`,
        [roomId, times.start, bufferedEnd],
      );
      if (block.rowCount)
        throw conflict("Maintenance overlaps the stay or cleaning buffer.");
      const schema = (
        await db.query(
          "select to_regclass('staytrack.early_check_in_approvals') is not null as installed",
        )
      ).rows[0].installed;
      if (schema) {
        const readiness = (
          await db.query(
            "select staytrack.room_is_physically_ready($1) as ready",
            [roomId],
          )
        ).rows[0].ready;
        if (!readiness)
          throw conflict(
            "Current physical inspection or latest housekeeping Ready is required; reconcile room readiness.",
          );
        const noShow = (
          await db.query(
            "select decision from staytrack.accommodation_no_show_reviews where room_booking_id=$1 order by occurred_at desc,id desc limit 1",
            [bookingId],
          )
        ).rows[0];
        if (noShow?.decision === "no_show")
          throw conflict(
            "Reopen the no-show review as expected before check-in.",
          );
      }
      if (early) {
        if (!schema) throw conflict("Early check-in migration is required.");
        await db.query(
          `insert into staytrack.early_check_in_approvals(room_booking_id,actor_auth_user_id,request_key,reason,original_start_at,original_end_at,start_at,end_at)
          values($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            bookingId,
            actor,
            key,
            (earlyApproval as string).trim(),
            item.start_at,
            item.end_at,
            times.start,
            times.end,
          ],
        );
      }
      // The shared exclusion constraint arbitrates overlaps with every active claim.
      await db.query(
        `update staytrack.inventory_claims set room_id=$2,start_at=$3,end_at=$4,
        buffered_end_at=$5 where id=$1`,
        [item.claim_id, roomId, times.start, times.end, bufferedEnd],
      );
      await db.query(
        "update staytrack.rooms set operational_state='occupied' where id=$1",
        [roomId],
      );
      const result = await db.query(
        `insert into staytrack.room_check_ins
        (room_booking_id,room_id,actor_auth_user_id,request_key,checked_in_at,checkout_at)
        values ($1,$2,$3,$4,$5,$6) returning *`,
        [bookingId, roomId, actor, key, now, times.end],
      );
      await db.query(
        "insert into staytrack.staff_audit(actor_auth_user_id,action) values ($1,'room.checked_in')",
        [actor],
      );
      return result.rows[0];
    }, pool);
  } catch (error) {
    if (["23P01", "23505"].includes((error as { code?: string }).code ?? ""))
      throw conflict(
        "Room capacity or retry key conflicts with another booking.",
      );
    throw error;
  }
}

export async function recordNoShow(
  actor: string,
  bookingId: string,
  value: unknown,
  pool = databasePool(),
) {
  const body = value as {
    decision?: unknown;
    note?: unknown;
    requestKey?: unknown;
  } | null;
  if (
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(bookingId) ||
    !body ||
    !["no_show", "expected"].includes(String(body.decision)) ||
    typeof body.note !== "string" ||
    !body.note.trim() ||
    body.note.length > 1000 ||
    typeof body.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestKey)
  )
    throw new BookingError("Decision, review note and retry key required.");
  try {
    return await claimTransaction(async (db) => {
      if (
        !(
          await db.query(
            "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
            [actor],
          )
        ).rowCount
      )
        throw new BookingError("Staff access denied.", 403);
      await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        actor + ":" + body.requestKey,
      ]);
      const booking = await db.query(
        "select b.id from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id where b.id=$1 for update of r,b",
        [bookingId],
      );
      if (!booking.rowCount)
        throw new BookingError("Booking item not found.", 404);
      const prior = (
        await db.query(
          "select * from staytrack.accommodation_no_show_reviews where actor_auth_user_id=$1 and request_key=$2",
          [actor, body.requestKey],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.room_booking_id !== bookingId ||
          prior.decision !== body.decision ||
          prior.note !== String(body.note).trim()
        )
          throw new BookingError("Retry key conflict.", 409);
        return prior;
      }
      return (
        await db.query(
          "insert into staytrack.accommodation_no_show_reviews(room_booking_id,actor_auth_user_id,request_key,decision,note) values($1,$2,$3,$4,$5) returning *",
          [
            bookingId,
            actor,
            body.requestKey,
            body.decision,
            String(body.note).trim(),
          ],
        )
      ).rows[0];
    }, pool);
  } catch (error) {
    if ((error as { code?: string }).code === "P0001")
      throw new BookingError(
        "Only unarrived confirmed online stays after the grace period can be reviewed.",
        409,
      );
    throw error;
  }
}
