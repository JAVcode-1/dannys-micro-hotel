import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { BookingError } from "./booking-quote.js";
import type { Express, RequestHandler } from "express";

export async function staffRooms(pool = databasePool()) {
  const installed = (
    await pool.query(
      "select to_regclass('staytrack.housekeeping_events') is not null as installed",
    )
  ).rows[0].installed;
  const { rows } =
    await pool.query(`select r.id::text, r.code, c.code as category_code,
    c.name as category_name, r.operational_state, r.active,
    ${
      installed
        ? `o.room_booking_id as checkout_id,
    (select json_agg(json_build_object('action',e.action,'actorId',e.actor_auth_user_id,'occurredAt',e.occurred_at) order by case e.action when 'start' then 1 when 'finish' then 2 else 3 end)
      from staytrack.housekeeping_events e where e.checkout_id=o.room_booking_id) as housekeeping,
    (select max(b.end_at) from staytrack.room_blocks b join staytrack.room_checkouts x on x.cleaning_block_id=b.id
      where b.room_id=r.id and b.end_at>statement_timestamp()) as turnover_until,
    exists(select 1 from staytrack.room_blocks b where b.room_id=r.id
      and tstzrange(b.start_at,b.end_at,'[)') @> statement_timestamp()
      and not exists(select 1 from staytrack.room_checkouts x where x.cleaning_block_id=b.id)) as maintenance_now,
    (select count(*)::int from staytrack.inventory_claims i where i.room_id=r.id
      and i.state in ('held','pending_review') and i.start_at<=statement_timestamp()
      and i.buffered_end_at>statement_timestamp()) as held_now,
    (select count(*)::int from staytrack.inventory_claims i where i.room_id=r.id
      and i.state in ('confirmed','walkin_reserved') and i.start_at<=statement_timestamp()
      and i.buffered_end_at>statement_timestamp()) as reserved_now,
    (r.active and c.active and r.operational_state='ready'
      and not exists(select 1 from staytrack.room_blocks b where b.room_id=r.id and tstzrange(b.start_at,b.end_at,'[)') @> statement_timestamp())
      and not exists(select 1 from staytrack.inventory_claims i where i.room_id=r.id and i.state not in ('released','expired')
        and i.start_at<=statement_timestamp() and i.buffered_end_at>statement_timestamp())) as available_now,`
        : "null as checkout_id,'[]'::json as housekeeping,null as turnover_until,false as maintenance_now,0 as held_now,0 as reserved_now,false as available_now,"
    }
    false as housekeeping_enabled
    from staytrack.rooms r join staytrack.room_categories c on c.id = r.category_id
    ${
      installed
        ? `left join lateral (select x.room_booking_id from staytrack.room_checkouts x
      join staytrack.room_check_ins s on s.room_booking_id=x.room_booking_id where s.room_id=r.id
      order by x.checked_out_at desc,x.room_booking_id desc limit 1) o on true`
        : ""
    }
    order by c.id, r.code`);
  return rows.map((row) => ({ ...row, housekeeping: row.housekeeping ?? [] }));
}

export async function recordHousekeeping(
  actor: string,
  roomId: string,
  input: unknown,
  pool?: ReturnType<typeof databasePool>,
) {
  const body = input as {
    checkoutId?: unknown;
    action?: unknown;
    requestKey?: unknown;
    checksConfirmed?: unknown;
  } | null;
  if (
    !/^[1-9]\d{0,14}$/.test(roomId) ||
    typeof body?.checkoutId !== "string" ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.checkoutId) ||
    typeof body.action !== "string" ||
    !["start", "finish", "ready"].includes(body.action) ||
    typeof body.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestKey) ||
    (body.action === "ready"
      ? body.checksConfirmed !== true
      : body.checksConfirmed !== undefined && body.checksConfirmed !== false)
  )
    throw new BookingError(
      "Valid room, checkout, action, retry key and Ready checks are required.",
    );
  try {
    return await claimTransaction(async (db) => {
      const staff = await db.query(
        "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
        [actor],
      );
      if (!staff.rowCount) throw new BookingError("Staff access denied.", 403);
      const room = (
        await db.query("select category_id from staytrack.rooms where id=$1", [
          roomId,
        ])
      ).rows[0];
      if (!room) throw new BookingError("Room not found.", 404);
      await db.query("select pg_advisory_xact_lock($1::bigint)", [
        room.category_id,
      ]);
      await db.query("lock table staytrack.room_blocks in share mode");
      await db.query("select 1 from staytrack.rooms where id=$1 for update", [
        roomId,
      ]);
      const prior = (
        await db.query(
          "select * from staytrack.housekeeping_events where actor_auth_user_id=$1 and request_key=$2",
          [actor, body.requestKey],
        )
      ).rows[0];
      if (prior) {
        if (
          String(prior.room_id) === roomId &&
          prior.checkout_id === String(body.checkoutId).toLowerCase() &&
          prior.action === body.action &&
          prior.checks_confirmed === (body.action === "ready")
        )
          return prior;
        throw new BookingError(
          "Retry key conflicts with another housekeeping action.",
          409,
        );
      }
      return (
        await db.query(
          `insert into staytrack.housekeeping_events(checkout_id,room_id,action,actor_auth_user_id,request_key,checks_confirmed)
        values($1,$2,$3,$4,$5,$6) returning *`,
          [
            body.checkoutId,
            roomId,
            body.action,
            actor,
            body.requestKey,
            body.action === "ready",
          ],
        )
      ).rows[0];
    }, pool ?? databasePool());
  } catch (error) {
    if (
      ["P0001", "23505", "23503", "23514"].includes(
        (error as { code?: string }).code ?? "",
      )
    )
      throw new BookingError(
        "Housekeeping changed or conflicts with room readiness or maintenance. Refresh before retrying.",
        409,
      );
    throw error;
  }
}

export function registerHousekeeping(
  app: Express,
  staff: RequestHandler,
  enabled = false,
  pool?: ReturnType<typeof databasePool>,
) {
  app.post("/staff/rooms/:id/housekeeping", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live housekeeping is closed pending acceptance." });
      return;
    }
    try {
      res.json(
        await recordHousekeeping(
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
            : "Housekeeping unavailable. Retry or reconcile with staff.",
      });
    }
  });
}
