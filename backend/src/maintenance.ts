import type { Express, RequestHandler } from "express";
import type { RoomMaintenance } from "@staytrack/shared";
import { BookingError } from "./booking-quote.js";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";

export async function maintenanceBoard(pool = databasePool(), enabled = false) {
  const installed = (
    await pool.query(
      "select to_regclass('staytrack.maintenance_events') is not null as installed",
    )
  ).rows[0].installed;
  if (!installed) return {} as Record<string, RoomMaintenance>;
  const { rows } = await pool.query<RoomMaintenance & { room_id: string }>(
    `
    select r.id::text as room_id, $1::boolean as enabled,
      active.id::text as "activeBlockId",
      coalesce(history.events,'[]'::json) as events,
      coalesce(impact.items,'[]'::json) as affected
    from staytrack.rooms r
    left join lateral (
      select b.id,b.start_at from staytrack.room_blocks b
      join staytrack.maintenance_events e on e.block_id=b.id and e.action='open'
      where b.room_id=r.id and b.end_at is null order by b.id desc limit 1
    ) active on true
    left join lateral (
      select json_agg(json_build_object('id',e.id::text,'blockId',e.block_id::text,
        'action',e.action,'note',e.note,'actorId',e.actor_auth_user_id,'occurredAt',e.occurred_at)
        order by e.id desc) as events
      from staytrack.maintenance_events e join staytrack.room_blocks b on b.id=e.block_id
      where b.room_id=r.id
    ) history on true
    left join lateral (
      select json_agg(json_build_object('itemId',b.id,'startAt',i.start_at,'endAt',i.end_at,
        'state',i.state,'paid',
          exists(select 1 from staytrack.payment_submissions s
            join staytrack.verified_online_payments v on v.submission_id=s.id
            where s.reservation_id=b.reservation_id and v.amount_centavos>0)
          or exists(select 1 from staytrack.walkin_ledger l where l.reservation_id=b.reservation_id
            and l.kind='payment')) order by i.start_at,b.id) as items
      from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id
      where active.id is not null and i.room_id=r.id and i.state not in ('released','expired')
        and i.buffered_end_at>greatest(active.start_at,statement_timestamp())
    ) impact on true`,
    [enabled],
  );
  return Object.fromEntries(
    rows.map(({ room_id, ...maintenance }) => [room_id, maintenance]),
  );
}

export async function recordMaintenance(
  actor: string,
  roomId: string,
  input: unknown,
  pool?: ReturnType<typeof databasePool>,
) {
  const body = input as {
    action?: unknown;
    blockId?: unknown;
    note?: unknown;
    requestKey?: unknown;
    restoreReady?: unknown;
  } | null;
  const id = /^[1-9]\d{0,14}$/;
  if (
    !id.test(roomId) ||
    !body ||
    typeof body.action !== "string" ||
    !["open", "progress", "clear"].includes(body.action) ||
    (body.action === "open"
      ? body.blockId != null
      : typeof body.blockId !== "string" || !id.test(body.blockId)) ||
    typeof body.note !== "string" ||
    !body.note.trim() ||
    body.note.length > 1000 ||
    typeof body.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestKey) ||
    (body.restoreReady !== undefined &&
      (typeof body.restoreReady !== "boolean" || body.action !== "clear"))
  )
    throw new BookingError(
      "Valid maintenance action, room, note and retry key required.",
      400,
    );
  try {
    return await claimTransaction(
      async (db) =>
        (
          await db.query(
            "select * from staytrack.record_maintenance($1,$2,$3,$4,$5,$6,$7)",
            [
              actor,
              roomId,
              body.action,
              body.blockId ?? null,
              (body.note as string).trim(),
              body.requestKey,
              body.restoreReady ?? false,
            ],
          )
        ).rows[0],
      pool ?? databasePool(),
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42501")
      throw new BookingError("Active staff access required.", 403);
    if (code === "P0002") throw new BookingError("Room not found.", 404);
    if (code === "22023")
      throw new BookingError("Invalid maintenance request.", 400);
    if (code === "P0001" || code === "23505")
      throw new BookingError(
        "Maintenance conflicts with the current room, booking or readiness state. Refresh and review.",
        409,
      );
    throw error;
  }
}

export function registerMaintenance(
  app: Express,
  staff: RequestHandler,
  enabled = false,
  pool?: ReturnType<typeof databasePool>,
) {
  app.post("/staff/rooms/:id/reassign", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live reassignment is closed pending acceptance." });
      return;
    }
    try {
      res.json(
        await reassignMaintenanceBooking(
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
            : "Reassignment unavailable.",
      });
    }
  });
  app.post("/staff/rooms/:id/maintenance", staff, async (req, res) => {
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live maintenance is closed pending acceptance." });
      return;
    }
    try {
      res.json(
        await recordMaintenance(
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
            : "Maintenance update unavailable.",
      });
    }
  });
}

export async function reassignMaintenanceBooking(
  actor: string,
  source: string,
  value: unknown,
  pool = databasePool(),
) {
  const body = value as {
    itemId?: unknown;
    targetRoomId?: unknown;
    note?: unknown;
    requestKey?: unknown;
  } | null;
  if (
    !/^[1-9]\d{0,14}$/.test(source) ||
    !body ||
    typeof body.itemId !== "string" ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.itemId) ||
    typeof body.targetRoomId !== "string" ||
    !/^[1-9]\d{0,14}$/.test(body.targetRoomId) ||
    body.targetRoomId === source ||
    typeof body.note !== "string" ||
    !body.note.trim() ||
    body.note.length > 1000 ||
    typeof body.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestKey)
  )
    throw new BookingError(
      "Select affected item, different target room, reason and retry key.",
    );
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
      const prior = (
        await db.query(
          "select * from staytrack.room_reassignments where actor_auth_user_id=$1 and request_key=$2",
          [actor, body.requestKey],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.room_booking_id !== body.itemId ||
          String(prior.old_room_id) !== source ||
          String(prior.new_room_id) !== body.targetRoomId ||
          prior.note !== String(body.note).trim()
        )
          throw new BookingError("Retry key conflict.", 409);
        return prior;
      }
      const item = (
        await db.query(
          `select b.id,b.claim_id,i.category_id from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1 for update of r,b`,
          [body.itemId],
        )
      ).rows[0];
      if (!item) throw new BookingError("Booking item not found.", 404);
      await db.query("select pg_advisory_xact_lock($1::bigint)", [
        item.category_id,
      ]);
      await db.query("lock table staytrack.room_blocks in share mode");
      const claim = (
        await db.query(
          "select * from staytrack.inventory_claims where id=$1 for update",
          [item.claim_id],
        )
      ).rows[0];
      await db.query(
        "select 1 from staytrack.rooms where id=any($1::bigint[]) order by id for update",
        [[source, body.targetRoomId]],
      );
      if (
        String(claim.room_id) !== source ||
        ![
          "held",
          "proof_pending_review",
          "confirmed",
          "walkin_reserved",
        ].includes(claim.state) ||
        (
          await db.query(
            "select 1 from staytrack.room_check_ins where room_booking_id=$1",
            [body.itemId],
          )
        ).rowCount
      )
        throw new BookingError(
          "Only active unarrived affected bookings can be reassigned.",
          409,
        );
      const target = (
        await db.query(
          "select 1 from staytrack.rooms where id=$1 and category_id=$2 and staytrack.room_is_physically_ready(id)",
          [body.targetRoomId, item.category_id],
        )
      ).rowCount;
      const affected = (
        await db.query(
          "select 1 from staytrack.room_blocks where room_id=$1 and tstzrange(start_at,end_at,'[)') && tstzrange($2,$3,'[)') and exists(select 1 from staytrack.maintenance_events where block_id=room_blocks.id and action='open')",
          [source, claim.start_at, claim.buffered_end_at],
        )
      ).rowCount;
      const blocked = (
        await db.query(
          "select 1 from staytrack.room_blocks where room_id=$1 and tstzrange(start_at,end_at,'[)') && tstzrange($2,$3,'[)')",
          [body.targetRoomId, claim.start_at, claim.buffered_end_at],
        )
      ).rowCount;
      if (!target || !affected || blocked)
        throw new BookingError(
          "Reassignment requires an affected maintenance booking and a feasible inspected Ready room in the same category.",
          409,
        );
      const result = (
        await db.query(
          "insert into staytrack.room_reassignments(room_booking_id,old_room_id,new_room_id,actor_auth_user_id,request_key,note,start_at,end_at) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
          [
            body.itemId,
            source,
            body.targetRoomId,
            actor,
            body.requestKey,
            String(body.note).trim(),
            claim.start_at,
            claim.end_at,
          ],
        )
      ).rows[0];
      await db.query(
        "update staytrack.inventory_claims set room_id=$2 where id=$1",
        [claim.id, body.targetRoomId],
      );
      await db.query(
        "insert into staytrack.staff_audit(actor_auth_user_id,action) values($1,'room.maintenance_reassigned')",
        [actor],
      );
      return result;
    }, pool);
  } catch (error) {
    if (
      ["23505", "23P01", "P0001"].includes(
        (error as { code?: string }).code ?? "",
      )
    )
      throw new BookingError(
        "Target capacity or retry conflicts. Refresh before retrying.",
        409,
      );
    throw error;
  }
}
