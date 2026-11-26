import { maintenanceBoard } from "./maintenance.js";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { BookingError } from "./booking-quote.js";
import { hasControlCharacters } from "./payment-media.js";
import type { Express, RequestHandler } from "express";
import { registerPhysicalRoom } from "./room-registration.js";

export async function roomInspectionsInstalled(
  pool: ReturnType<typeof databasePool>,
) {
  return Boolean(
    (
      await pool.query(
        "select to_regclass('staytrack.room_inspections') is not null as installed",
      )
    ).rows[0].installed,
  );
}

// The Rooms board and its badge use the same predicate. A current checkout
// takes the normal housekeeping path instead of the imported-room inspection.
export const roomInspectionNeeded = `(
  (r.operational_state='unverified'
    or (r.operational_state='ready' and r.active and not staytrack.room_is_physically_ready(r.id))
    or (r.operational_state='cleaning' and not exists(
      select 1 from staytrack.room_checkouts co join staytrack.room_check_ins ci on ci.room_booking_id=co.room_booking_id where ci.room_id=r.id)))
  and not exists(select 1 from staytrack.room_check_ins s where s.room_id=r.id and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=s.room_booking_id))
  and not exists(select 1 from staytrack.room_blocks b where b.room_id=r.id and tstzrange(b.start_at,b.end_at,'[)') @> statement_timestamp())
)`;

export async function staffRooms(pool = databasePool(), enabled = false) {
  const corrections = await roomInspectionsInstalled(pool);
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
      and i.state in ('held','proof_pending_review') and i.start_at<=statement_timestamp()
      and i.buffered_end_at>statement_timestamp()) as held_now,
    (select count(*)::int from staytrack.inventory_claims i where i.room_id=r.id
      and i.state in ('confirmed','walkin_reserved') and i.start_at<=statement_timestamp()
      and i.buffered_end_at>statement_timestamp()) as reserved_now,
    (r.active and c.active and r.operational_state='ready' ${corrections ? "and staytrack.room_is_physically_ready(r.id)" : ""}
      and not exists(select 1 from staytrack.room_blocks b where b.room_id=r.id and tstzrange(b.start_at,b.end_at,'[)') @> statement_timestamp())
      and not exists(select 1 from staytrack.inventory_claims i where i.room_id=r.id and i.state not in ('released','expired')
        and i.start_at<=statement_timestamp() and i.buffered_end_at>statement_timestamp())) as available_now,`
        : "null as checkout_id,'[]'::json as housekeeping,null as turnover_until,false as maintenance_now,0 as held_now,0 as reserved_now,false as available_now,"
    }
    ${corrections ? "staytrack.room_is_physically_ready(r.id)" : "false"} as physically_ready,
    ${corrections ? roomInspectionNeeded : "false"} as legacy_inspection_eligible,
    ${enabled ? "true" : "false"} as housekeeping_enabled
    from staytrack.rooms r join staytrack.room_categories c on c.id = r.category_id
    ${
      installed
        ? `left join lateral (select x.room_booking_id from staytrack.room_checkouts x
      join staytrack.room_check_ins s on s.room_booking_id=x.room_booking_id where s.room_id=r.id
      order by x.checked_out_at desc,x.room_booking_id desc limit 1) o on true`
        : ""
    }
    order by c.id, r.code`);
  const maintenance = await maintenanceBoard(pool, enabled);
  return rows.map((row) => ({
    ...row,
    housekeeping: row.housekeeping ?? [],
    maintenance: maintenance[row.id],
  }));
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
      await db.query(
        body.action === "ready"
          ? "lock table staytrack.room_blocks in share row exclusive mode"
          : "lock table staytrack.room_blocks in share mode",
      );
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
  app.post("/staff/rooms", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res.status(503).json({ error: "Room registration is not enabled." });
      return;
    }
    try {
      res.json(await registerPhysicalRoom(res.locals.actorId, req.body, pool));
    } catch (error) {
      res.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Room registration unavailable. Refresh before retrying.",
      });
    }
  });
  app.patch("/staff/rooms/:id/admin", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res.status(503).json({
        error: "Live room administration is closed pending acceptance.",
      });
      return;
    }
    try {
      res.json(
        await administerRoom(
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
            : "Room administration unavailable.",
      });
    }
  });
  app.post("/staff/rooms/:id/inspection", staff, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live inspections are closed pending acceptance." });
      return;
    }
    try {
      res.json(
        await inspectLegacyRoom(
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
            : "Inspection unavailable.",
      });
    }
  });
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

export async function inspectLegacyRoom(
  actor: string,
  roomId: string,
  value: unknown,
  pool = databasePool(),
) {
  const body = value as {
    note?: unknown;
    requestKey?: unknown;
    checksConfirmed?: unknown;
  } | null;
  if (
    !/^[1-9]\d{0,14}$/.test(roomId) ||
    body?.checksConfirmed !== true ||
    typeof body.note !== "string" ||
    !body.note.trim() ||
    body.note.length > 1000 ||
    typeof body.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestKey)
  )
    throw new BookingError(
      "Confirm current physical checks with a note and retry key.",
    );
  try {
    return await claimTransaction(
      async (db) =>
        (
          await db.query(
            "select * from staytrack.inspect_legacy_room($1,$2,$3,$4)",
            [actor, roomId, body.requestKey, String(body.note).trim()],
          )
        ).rows[0],
      pool,
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42501") throw new BookingError("Staff access denied.", 403);
    if (["P0001", "23505"].includes(code ?? ""))
      throw new BookingError(
        "Legacy inspection conflicts with stay history, maintenance or retry data. Use normal housekeeping for checked-out rooms.",
        409,
      );
    throw error;
  }
}

export async function administerRoom(
  actor: string,
  roomId: string,
  value: unknown,
  pool = databasePool(),
) {
  const body = value as {
    code?: unknown;
    category?: unknown;
    active?: unknown;
    note?: unknown;
    requestKey?: unknown;
  } | null;
  const activationOnly =
    body?.active === true &&
    body.code === undefined &&
    body.category === undefined;
  if (
    !/^[1-9]\d{0,14}$/.test(roomId) ||
    !body ||
    (!activationOnly &&
      (typeof body.code !== "string" ||
        !body.code.trim() ||
        body.code.length > 80 ||
        hasControlCharacters(body.code))) ||
    (body.category !== undefined &&
      !["double_standard", "family_executive"].includes(
        String(body.category),
      )) ||
    typeof body.active !== "boolean" ||
    typeof body.note !== "string" ||
    !body.note.trim() ||
    body.note.length > 1000 ||
    typeof body.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestKey)
  )
    throw new BookingError(
      "Confirmed room identifier, active state, reason and retry key required.",
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
      await db.query("select pg_advisory_xact_lock(741501)");
      await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        actor + ":" + body.requestKey,
      ]);
      const category = (
        await db.query("select category_id from staytrack.rooms where id=$1", [
          roomId,
        ])
      ).rows[0];
      if (!category) throw new BookingError("Room not found.", 404);
      const target =
        body.category === undefined
          ? category.category_id
          : (
              await db.query(
                "select id from staytrack.room_categories where code=$1 and active",
                [body.category],
              )
            ).rows[0]?.id;
      if (!target) throw new BookingError("Choose an active room category.");
      for (const id of [
        ...new Set([String(category.category_id), String(target)]),
      ].sort((a, b) => Number(a) - Number(b)))
        await db.query("select pg_advisory_xact_lock($1::bigint)", [id]);
      const room = (
        await db.query("select * from staytrack.rooms where id=$1 for update", [
          roomId,
        ])
      ).rows[0];
      const code = activationOnly
        ? String(room.code)
        : String(body.code).trim();
      const prior = (
        await db.query(
          "select * from staytrack.room_administration_events where actor_auth_user_id=$1 and request_key=$2",
          [actor, body.requestKey],
        )
      ).rows[0];
      if (prior) {
        if (
          String(prior.room_id) !== roomId ||
          (activationOnly
            ? prior.old_code !== prior.new_code
            : prior.new_code !== code) ||
          prior.new_active !== body.active ||
          String(room.category_id) !== String(target) ||
          prior.note !== String(body.note).trim()
        )
          throw new BookingError("Retry key conflict.", 409);
        return prior;
      }
      if (
        (
          await db.query(
            "select 1 from staytrack.rooms where id<>$1 and lower(btrim(code))=lower($2)",
            [roomId, code],
          )
        ).rowCount
      )
        throw new BookingError("Room identifier is already registered.", 409);
      if (String(room.category_id) !== String(target)) {
        if (
          (
            await db.query(
              "select 1 from staytrack.inventory_claims where room_id=$1 union all select 1 from staytrack.room_blocks where room_id=$1",
              [roomId],
            )
          ).rowCount ||
          room.active ||
          !["unverified", "ready"].includes(room.operational_state)
        )
          throw new BookingError(
            "Deactivate an unused room before correcting its category. Booking or maintenance history requires reconciliation.",
            409,
          );
        const count = Number(
          (
            await db.query(
              "select count(*) n from staytrack.rooms where category_id=$1",
              [target],
            )
          ).rows[0].n,
        );
        if (count >= (body.category === "double_standard" ? 10 : 5))
          throw new BookingError(
            "The selected category already has its full physical room inventory.",
            409,
          );
        await db.query(
          "insert into staytrack.staff_audit(actor_auth_user_id,action) values($1,$2)",
          [
            actor,
            `room.category_corrected:${roomId}:${room.category_id}:${target}`,
          ],
        );
      }
      if (
        !(body.active as boolean) &&
        (
          await db.query(
            "select 1 from staytrack.inventory_claims where room_id=$1 and state not in ('released','expired') and buffered_end_at>clock_timestamp() union all select 1 from staytrack.room_check_ins s where room_id=$1 and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=s.room_booking_id)",
            [roomId],
          )
        ).rowCount
      )
        throw new BookingError(
          "Resolve active bookings and stays before deactivating a room.",
          409,
        );
      if (
        body.active &&
        !room.active &&
        !(
          await db.query(
            "select 1 from staytrack.rooms r where r.id=$1 and r.operational_state='ready' and exists(select 1 from staytrack.room_inspections e where e.room_id=r.id and not exists(select 1 from staytrack.room_checkouts o join staytrack.room_check_ins ci on ci.room_booking_id=o.room_booking_id where ci.room_id=r.id and o.checked_out_at>=e.occurred_at)) and not exists(select 1 from staytrack.room_check_ins s where s.room_id=r.id and not exists(select 1 from staytrack.room_checkouts o where o.room_booking_id=s.room_booking_id)) and not exists(select 1 from staytrack.room_blocks b where b.room_id=r.id and tstzrange(b.start_at,b.end_at,'[)') @> clock_timestamp())",
            [roomId],
          )
        ).rowCount
      )
        throw new BookingError(
          "Inspect and mark the room Ready before activation.",
          409,
        );
      await db.query(
        "update staytrack.rooms set code=$2,active=$3,category_id=$4 where id=$1",
        [roomId, code, body.active, target],
      );
      const event = (
        await db.query(
          "insert into staytrack.room_administration_events(room_id,actor_auth_user_id,request_key,old_code,new_code,old_active,new_active,note) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
          [
            roomId,
            actor,
            body.requestKey,
            room.code,
            code,
            room.active,
            body.active,
            String(body.note).trim(),
          ],
        )
      ).rows[0];
      await db.query(
        "insert into staytrack.staff_audit(actor_auth_user_id,action) values($1,'room.admin_updated')",
        [actor],
      );
      return event;
    }, pool);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new BookingError(
        "Room identifier or retry key already exists.",
        409,
      );
    throw error;
  }
}
