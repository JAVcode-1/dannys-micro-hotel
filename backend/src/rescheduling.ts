import type { Express, RequestHandler, Response } from "express";
import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import type {
  RescheduleRecord,
  RescheduleDecisionInput,
} from "@staytrack/shared";
import type { GuestIdentity } from "./guest-auth.js";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import {
  allocateRooms,
  type Room,
  type Occupancy,
  type RoomBlock,
} from "./availability.js";
import { BookingError } from "./booking-quote.js";
import {
  parseRescheduleInput,
  classifyReschedule,
  rescheduleKey,
  rescheduleReason,
} from "./rescheduling-policy.js";

type Actor = GuestIdentity | { staffId: string };
const uuid = (v: string) =>
  /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(v);
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const conflict = () =>
  new BookingError(
    "Schedule, policy, capacity or retry conflicts with current state. Refresh and review again.",
    409,
  );
function known(error: unknown): never {
  if (
    ["23505", "23514", "23503", "23P01", "P0001", "40001", "40P01"].includes(
      (error as { code?: string }).code ?? "",
    )
  )
    throw conflict();
  throw error;
}
export function chooseRescheduleRoom(
  rooms: Room[],
  claims: Occupancy[],
  blocks: RoomBlock[],
  target: Occupancy,
  now = Date.now(),
): number | null {
  const ids = new Set(rooms.map((r) => r.id));
  const fixed: RoomBlock[] = [
    ...blocks,
    ...claims.map((c) => ({
      roomId: c.roomId!,
      start: c.start,
      end: c.end + c.bufferMinutes * 60000,
    })),
  ].filter(
    (b) =>
      ids.has(b.roomId) &&
      b.start < target.end + target.bufferMinutes * 60000 &&
      (b.end === null || b.end > target.start),
  );
  // Existing allocations are fixed blocked ranges, not a second allocation problem.
  return allocateRooms(rooms, [], fixed, [target], now)?.[0] ?? null;
}
async function staff(db: PoolClient, id: string) {
  if (
    !(
      await db.query(
        "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
        [id],
      )
    ).rowCount
  )
    throw new BookingError("Staff access denied.", 403);
}
async function lockItem(db: PoolClient, id: string, actor: Actor) {
  if ("staffId" in actor) await staff(db, actor.staffId);
  const item = (
    await db.query(
      `select b.*,r.channel,r.owner_auth_user_id,r.verified_email,r.online_confirmation_at,
   i.category_id,i.state as claim_state,i.buffer_minutes from staytrack.room_bookings b
   join staytrack.reservations r on r.id=b.reservation_id join staytrack.inventory_claims i on i.id=b.claim_id
   where b.id=$1 for update of r,b`,
      [id],
    )
  ).rows[0];
  if (
    !item ||
    ("id" in actor &&
      (item.channel !== "online" ||
        item.owner_auth_user_id !== actor.id ||
        item.verified_email.toLowerCase() !== actor.email.toLowerCase()))
  )
    throw new BookingError("Room item not found.", 404);
  return item;
}
const blockerSql = `case
 when d.request_id is not null then null
 when q.eligibility<>'eligible' then replace(q.eligibility,'_',' ')
 when exists(select 1 from staytrack.room_check_ins s where s.room_booking_id=b.id) then 'Room has checked in'
 when exists(select 1 from staytrack.cancellation_requests c left join staytrack.cancellation_decisions cd using(room_booking_id) where c.room_booking_id=b.id and ((c.eligibility='eligible' and cd.room_booking_id is null) or cd.approved)) then 'Cancellation prevents rescheduling'
 when b.pending_reschedule_id is distinct from q.id or b.schedule_revision<>q.expected_revision or b.claim_id<>q.source_claim_id or b.start_at<>q.original_start_at or b.end_at<>q.original_end_at or i.room_id<>q.original_room_id or i.buffer_minutes<>q.original_buffer_minutes or i.start_at<>b.start_at or i.end_at<>b.end_at then 'Schedule changed; reject this stale request'
 when q.requested_start_at<=clock_timestamp() then 'Requested arrival has passed'
 when r.channel<>'online' or i.state<>'confirmed' or b.status<>'confirmed' or b.extra_bed_centavos<>0 or q.blocks<>q.original_blocks or r.online_confirmation_at is distinct from q.confirmation_at or (q.guest_auth_user_id is not null and (r.owner_auth_user_id is distinct from q.guest_auth_user_id or lower(r.verified_email) is distinct from lower(q.guest_email))) then 'Booking or ownership requires reconciliation'
 when exists(select 1 from staytrack.refund_claims f where f.room_booking_id=b.id) then 'Refund reconciliation required'
 when (select coalesce(sum(v.amount_centavos),0) from staytrack.verified_online_payments v join staytrack.payment_submissions ps on ps.id=v.submission_id where ps.reservation_id=r.id and ps.status='confirmed')<r.total_centavos then 'Verified payment required'
 else null end`;
const columns = `q.id,q.room_booking_id as "roomBookingId",q.expected_revision::float8 as "expectedRevision",
 q.original_start_at as "originalStartAt",q.original_end_at as "originalEndAt",
 q.requested_start_at as "requestedStartAt",q.requested_end_at as "requestedEndAt",q.eligibility,d.approved,
 q.original_centavos::float8 as "originalCentavos",p.delta_centavos::float8 as "proposalDeltaCentavos",
 p.status as "proposalStatus",q.confirmation_at as "confirmationAt",q.confirmation_at+interval '1 hour' as "cancellationDeadlineAt",
 b.start_at as "currentStartAt",b.end_at as "currentEndAt",b.schedule_revision::float8 as "currentRevision",
 q.blocks,q.original_blocks as "originalBlocks",q.reason,(${blockerSql}) as blocker,
 (d.request_id is null and (${blockerSql}) is null) as "canApprove"`;
const joins = `from staytrack.reschedule_requests q left join staytrack.reschedule_decisions d on d.request_id=q.id
 left join staytrack.reschedule_adjustment_proposals p on p.request_id=q.id
 join staytrack.room_bookings b on b.id=q.room_booking_id join staytrack.reservations r on r.id=b.reservation_id
 join staytrack.inventory_claims i on i.id=b.claim_id`;
async function record(
  db: PoolClient,
  id: string,
  requestResponse = false,
): Promise<RescheduleRecord> {
  const row = (await db.query(`select ${columns} ${joins} where q.id=$1`, [id]))
    .rows[0];
  // Match HTTP wire values for direct action callers and retries too.
  const result = JSON.parse(JSON.stringify(row)) as RescheduleRecord;
  return requestResponse
    ? {
        ...result,
        approved: null,
        currentStartAt: result.originalStartAt,
        currentEndAt: result.originalEndAt,
        currentRevision: result.expectedRevision,
        canApprove: false,
        blocker:
          result.eligibility === "eligible"
            ? null
            : result.eligibility.replaceAll("_", " "),
      }
    : result;
}
export async function requestReschedule(
  actor: Actor,
  id: string,
  value: unknown,
  pool = databasePool(),
): Promise<RescheduleRecord> {
  if (!uuid(id)) throw new BookingError("Invalid room item.");
  // Retry parsing uses the same immutable body even if the arrival is now in the past.
  const input = parseRescheduleInput(value, 0);
  const requestHash = hash({ id, ...input });
  try {
    return await claimTransaction(async (db) => {
      const item = await lockItem(db, id, actor);
      const prior = (
        await db.query(
          `select id,request_hash from staytrack.reschedule_requests where ${"staffId" in actor ? "staff_auth_user_id" : "guest_auth_user_id"}=$1 and request_key=$2`,
          ["staffId" in actor ? actor.staffId : actor.id, input.requestKey],
        )
      ).rows[0];
      if (prior) {
        if (prior.request_hash !== requestHash) throw conflict();
        return record(db, prior.id, true);
      }
      const source = {
        channel: item.channel,
        startAt: item.start_at.toISOString(),
        endAt: item.end_at.toISOString(),
        blocks: item.pricing_snapshot.map(
          (p: { durationMinutes: number }) => p.durationMinutes,
        ),
        totalCentavos: Number(item.total_centavos),
        extraBedCentavos: Number(item.extra_bed_centavos),
      };
      if (
        item.category_code === "family_executive" &&
        input.blocks.includes(180)
      )
        throw new BookingError("Family Executive has no 3-hour package.");
      // The database computes and locks the authoritative comparison quote and policy.
      const inserted = (
        await db.query(
          `insert into staytrack.reschedule_requests(room_booking_id,guest_auth_user_id,guest_email,staff_auth_user_id,request_key,request_hash,reason,expected_revision,requested_start_at,requested_end_at,blocks)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id,comparison_centavos`,
          [
            id,
            "id" in actor ? actor.id : null,
            "id" in actor ? actor.email.toLowerCase() : null,
            "staffId" in actor ? actor.staffId : null,
            input.requestKey,
            requestHash,
            input.reason,
            input.expectedRevision,
            input.startAt,
            input.endAt,
            input.blocks,
          ],
        )
      ).rows[0];
      classifyReschedule(
        source,
        input,
        inserted.comparison_centavos === null
          ? null
          : Number(inserted.comparison_centavos),
      );
      return record(db, inserted.id, true);
    }, pool);
  } catch (error) {
    known(error);
  }
}
export async function decideReschedule(
  actor: string,
  id: string,
  value: unknown,
  pool = databasePool(),
): Promise<RescheduleRecord> {
  const v = value as RescheduleDecisionInput | null;
  if (
    !uuid(id) ||
    !v ||
    Object.keys(v).some(
      (k) =>
        !["requestKey", "expectedRevision", "approved", "reason"].includes(k),
    ) ||
    !rescheduleKey(v.requestKey) ||
    !rescheduleReason(v.reason) ||
    typeof v.approved !== "boolean" ||
    !Number.isSafeInteger(v.expectedRevision) ||
    v.expectedRevision < 0
  )
    throw new BookingError(
      "Valid decision, revision, reason and retry key required.",
    );
  const input = {
    requestKey: v.requestKey,
    expectedRevision: v.expectedRevision,
    approved: v.approved,
    reason: v.reason.trim(),
  };
  const requestHash = hash({ id, ...input });
  try {
    return await claimTransaction(async (db) => {
      await staff(db, actor);
      const q = (
        await db.query(
          "select * from staytrack.reschedule_requests where id=$1",
          [id],
        )
      ).rows[0];
      if (!q) throw new BookingError("Request not found.", 404);
      const item = await lockItem(db, q.room_booking_id, { staffId: actor });
      const prior = (
        await db.query(
          "select actor_auth_user_id,request_key,request_hash from staytrack.reschedule_decisions where request_id=$1",
          [id],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.actor_auth_user_id !== actor ||
          prior.request_key !== input.requestKey ||
          prior.request_hash !== requestHash
        )
          throw conflict();
        return record(db, id);
      }
      let roomId: number | null = null;
      if (input.approved) {
        if (
          q.eligibility !== "eligible" ||
          Number(q.expected_revision) !== input.expectedRevision ||
          Number(item.schedule_revision) !== input.expectedRevision ||
          item.pending_reschedule_id !== id
        )
          throw conflict();
        await db.query("select pg_advisory_xact_lock($1::bigint)", [
          item.category_id,
        ]);
        await db.query(
          "select id from staytrack.inventory_claims where id=$1 for update",
          [item.claim_id],
        );
        await db.query("lock table staytrack.room_blocks in share mode");
        const rooms = (
          await db.query(
            `select rm.id,rm.operational_state,c.code from staytrack.rooms rm join staytrack.room_categories c on c.id=rm.category_id where rm.active and c.active and c.id=$1 order by rm.id`,
            [item.category_id],
          )
        ).rows;
        const claims = (
          await db.query(
            `select id,room_id,start_at,end_at,buffer_minutes from staytrack.inventory_claims where category_id=$1 and id<>$2 and state not in ('released','expired') and tstzrange(start_at,buffered_end_at,'[)') && tstzrange($3,$4,'[)')`,
            [
              item.category_id,
              item.claim_id,
              q.requested_start_at,
              new Date(+q.requested_end_at + item.buffer_minutes * 60000),
            ],
          )
        ).rows;
        const blocks = (
          await db.query(
            `select b.room_id,b.start_at,b.end_at from staytrack.room_blocks b join staytrack.rooms rm on rm.id=b.room_id where rm.active and rm.category_id=$1 and tstzrange(b.start_at,b.end_at,'[)') && tstzrange($2,$3,'[)')`,
            [
              item.category_id,
              q.requested_start_at,
              new Date(+q.requested_end_at + item.buffer_minutes * 60000),
            ],
          )
        ).rows;
        const assignment = chooseRescheduleRoom(
          rooms.map((r) => ({
            id: Number(r.id),
            category: r.code,
            ready: r.operational_state === "ready",
          })) as Room[],
          claims.map((c) => ({
            id: String(c.id),
            category: item.category_code,
            roomId: Number(c.room_id),
            start: +c.start_at,
            end: +c.end_at,
            bufferMinutes: c.buffer_minutes,
          })) as Occupancy[],
          blocks.map((b) => ({
            roomId: Number(b.room_id),
            start: +b.start_at,
            end: b.end_at === null ? null : +b.end_at,
          })) as RoomBlock[],
          {
            id: item.id,
            category: item.category_code,
            roomId: null,
            start: +q.requested_start_at,
            end: +q.requested_end_at,
            bufferMinutes: item.buffer_minutes,
          },
        );
        if (!assignment) throw conflict();
        roomId = assignment;
      }
      await db.query(
        `insert into staytrack.reschedule_decisions(request_id,actor_auth_user_id,request_key,request_hash,expected_revision,approved,reason,new_room_id)
       values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          actor,
          input.requestKey,
          requestHash,
          input.expectedRevision,
          input.approved,
          input.reason,
          roomId,
        ],
      );
      return record(db, id);
    }, pool);
  } catch (error) {
    known(error);
  }
}
export async function rescheduleRows(
  actor: Actor,
  pool = databasePool(),
  page = 0,
): Promise<RescheduleRecord[]> {
  if (!Number.isSafeInteger(page) || page < 0 || page > 1000000)
    throw new BookingError("Invalid page.");
  return claimTransaction(async (db) => {
    if ("staffId" in actor) await staff(db, actor.staffId);
    const values =
      "staffId" in actor
        ? [page * 100]
        : [actor.id, actor.email.toLowerCase(), page * 100];
    const result = await db.query(
      `select ${columns} ${joins}
     ${"staffId" in actor ? "" : "where r.channel='online' and r.owner_auth_user_id=$1 and lower(r.verified_email)=$2"}
     order by (d.request_id is not null),q.requested_at desc,q.id limit 100 offset $${values.length}`,
      values,
    );
    return JSON.parse(JSON.stringify(result.rows)) as RescheduleRecord[];
  }, pool);
}
export function registerReschedules(
  app: Express,
  staffMiddleware: RequestHandler,
  verifyGuest: (token: string) => Promise<GuestIdentity | null>,
  enabled = false,
  pool?: ReturnType<typeof databasePool>,
) {
  const fail = (res: Response, error: unknown) =>
    res.status(error instanceof BookingError ? error.status : 503).json({
      error:
        error instanceof BookingError
          ? error.message
          : "Rescheduling unavailable. Approved migration and acceptance required.",
    });
  const guest: RequestHandler = async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.header("authorization") ?? "");
    if (!match) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const identity = await verifyGuest(match[1]);
      if (!identity) {
        res.status(403).json({ error: "Verified guest required" });
        return;
      }
      res.locals.guest = identity;
      next();
    } catch {
      res.status(503).json({ error: "Guest access unavailable" });
    }
  };
  const closed: RequestHandler = (_req, res, next) => {
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live rescheduling is closed pending acceptance." });
      return;
    }
    next();
  };
  app.use(["/guest/reschedules", "/staff/reschedules"], (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/guest/reschedules", guest, async (req, res) => {
    try {
      res.json({
        items: await rescheduleRows(
          res.locals.guest,
          pool,
          Number(req.query.page ?? 0),
        ),
        enabled,
      });
    } catch (e) {
      fail(res, e);
    }
  });
  app.get("/staff/reschedules", staffMiddleware, async (req, res) => {
    try {
      res.json({
        items: await rescheduleRows(
          { staffId: res.locals.actorId },
          pool,
          Number(req.query.page ?? 0),
        ),
        enabled,
      });
    } catch (e) {
      fail(res, e);
    }
  });
  app.post("/guest/reschedules/:id", guest, closed, async (req, res) => {
    try {
      res.json(
        await requestReschedule(
          res.locals.guest,
          String(req.params.id),
          req.body,
          pool,
        ),
      );
    } catch (e) {
      fail(res, e);
    }
  });
  app.post(
    "/staff/reschedules/:id/request",
    staffMiddleware,
    closed,
    async (req, res) => {
      try {
        res.json(
          await requestReschedule(
            { staffId: res.locals.actorId },
            String(req.params.id),
            req.body,
            pool,
          ),
        );
      } catch (e) {
        fail(res, e);
      }
    },
  );
  app.post(
    "/staff/reschedules/:id/decision",
    staffMiddleware,
    closed,
    async (req, res) => {
      try {
        res.json(
          await decideReschedule(
            res.locals.actorId,
            String(req.params.id),
            req.body,
            pool,
          ),
        );
      } catch (e) {
        fail(res, e);
      }
    },
  );
}
