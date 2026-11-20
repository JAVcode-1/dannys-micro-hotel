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
) {
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
