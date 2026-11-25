import type { Express, RequestHandler } from "express";
import type { Pool, PoolClient } from "pg";
import { BookingError } from "./booking-quote.js";
import type { GuestIdentity } from "./guest-auth.js";
import { claimTransaction } from "./inventory-claims.js";
import { hasControlCharacters } from "./payment-media.js";

type Kind = "room" | "hall";
type Issue = {
  receivedCentavos: number;
  details: string;
  status: "open" | "resolved";
  resolution: string | null;
};
type StoredIssue = Issue & { resolvedBy: string | null };
type Db = Pick<PoolClient, "query">;

const issueColumns = `received_centavos::float8 as "receivedCentavos", details,
  case when resolved_at is null then 'open' else 'resolved' end as status,
  resolution`;

const guestItem = {
  room: `select r.id from staytrack.reservations r
    join staytrack.room_bookings b on b.reservation_id=r.id
    where b.id=$1 and r.owner_auth_user_id=$2 and lower(r.verified_email)=$3`,
  hall: `select r.id from staytrack.reservations r
    join staytrack.online_hall_items h on h.reservation_id=r.id
    where h.hall_reservation_id=$1 and r.owner_auth_user_id=$2 and lower(r.verified_email)=$3`,
};
const approvedAmounts = {
  room: `select coalesce(sum(refund_centavos),0)::text as amount
    from staytrack.cancellation_decisions where room_booking_id=$1 and approved`,
  hall: `select coalesce(sum(amount_centavos),0)::text as amount
    from staytrack.hall_refund_approvals where reservation_id=$1`,
};

async function assertOwnership(
  db: Db,
  kind: Kind,
  itemId: string,
  guest: GuestIdentity,
  lock = false,
) {
  const result = await db.query(
    guestItem[kind] + (lock ? " for update of r" : ""),
    [itemId, guest.id, guest.email.toLowerCase()],
  );
  if (!result.rowCount) throw new BookingError("Booking item not found.", 404);
}

function issueText(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 1000 ||
    hasControlCharacters(value.replace(/[\r\n\t]/g, ""))
  ) {
    throw new BookingError(`Enter up to 1,000 characters for the ${field}.`);
  }
  return value.trim();
}

export async function reportRefundIssue(
  pool: Pool,
  kind: Kind,
  itemId: string,
  guest: GuestIdentity,
  value: unknown,
) {
  const body = value as { receivedCentavos?: number; details?: unknown } | null;
  const amount = body?.receivedCentavos;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0)
    throw new BookingError(
      "Enter the total refund amount you actually received.",
    );
  const details = issueText(body?.details, "refund problem");
  return claimTransaction(async (db) => {
    await assertOwnership(db, kind, itemId, guest, true);
    const prior = await db.query<Issue & { reportedBy: string }>(
      `select ${issueColumns}, reported_by as "reportedBy" from staytrack.refund_issues
       where kind=$1 and item_id=$2`,
      [kind, itemId],
    );
    if (prior.rows[0]) {
      const { reportedBy, ...issue } = prior.rows[0];
      if (
        reportedBy === guest.id &&
        issue.receivedCentavos === amount &&
        issue.details === details
      )
        return issue;
      throw new BookingError(
        "A refund problem has already been reported for this item.",
        409,
      );
    }
    const approved = await db.query<{ amount: string }>(approvedAmounts[kind], [
      itemId,
    ]);
    if (BigInt(amount) >= BigInt(approved.rows[0].amount))
      throw new BookingError(
        "Report an amount below the approved refund for this item.",
        409,
      );
    const {
      rows: [issue],
    } = await db.query<Issue>(
      `insert into staytrack.refund_issues(kind,item_id,received_centavos,details,reported_by)
       values($1,$2,$3,$4,$5) returning ${issueColumns}`,
      [kind, itemId, amount, details, guest.id],
    );
    return issue;
  }, pool);
}

export async function resolveRefundIssue(
  pool: Pool,
  kind: Kind,
  itemId: string,
  actor: string,
  value: unknown,
) {
  const resolution = issueText(
    (value as { resolution?: unknown } | null)?.resolution,
    "resolution",
  );
  return claimTransaction(async (db) => {
    const active = await db.query(
      "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
      [actor],
    );
    if (!active.rowCount) throw new BookingError("Staff access denied.", 403);
    const {
      rows: [stored],
    } = await db.query<StoredIssue>(
      `select ${issueColumns}, resolved_by as "resolvedBy" from staytrack.refund_issues
       where kind=$1 and item_id=$2 for update`,
      [kind, itemId],
    );
    if (!stored) throw new BookingError("Refund problem not found.", 404);
    const { resolvedBy, ...prior } = stored;
    if (prior.status === "resolved") {
      if (resolvedBy === actor && prior.resolution === resolution) return prior;
      throw new BookingError(
        "This refund problem has already been resolved.",
        409,
      );
    }
    const {
      rows: [issue],
    } = await db.query<Issue>(
      `update staytrack.refund_issues set resolution=$3,resolved_by=$4,resolved_at=clock_timestamp()
       where kind=$1 and item_id=$2 returning ${issueColumns}`,
      [kind, itemId, resolution, actor],
    );
    await db.query(
      "insert into staytrack.staff_audit(actor_auth_user_id,action) values($1,'refund.issue_resolved')",
      [actor],
    );
    return issue;
  }, pool);
}

export function registerRefundIssues(
  app: Express,
  staff: RequestHandler,
  verifyGuest: (token: string) => Promise<GuestIdentity | null>,
  enabled = false,
  pool?: Pool,
) {
  const guest: RequestHandler = async (req, res, next) => {
    const token = /^Bearer ([^\s]+)$/.exec(
      req.header("authorization") ?? "",
    )?.[1];
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const identity = await verifyGuest(token);
      if (!identity) {
        res.status(403).json({ error: "Verified guest access required" });
        return;
      }
      res.locals.guest = identity;
      next();
    } catch {
      res.status(503).json({ error: "Guest access unavailable" });
    }
  };

  app.get("/staff/refund-issues", staff, async (_req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      if (!enabled || !pool) throw new Error();
      const { rows } = await pool.query(`select i.kind,i.item_id as "itemId",
        coalesce(b.reservation_id,h.reservation_id) as "reservationId", i.reported_at as "reportedAt"
        from staytrack.refund_issues i
        left join staytrack.room_bookings b on b.id=i.room_item_id
        left join staytrack.online_hall_items h on h.hall_reservation_id=i.hall_item_id
        where i.resolved_at is null order by i.reported_at,i.item_id limit 100`);
      res.json({ items: rows });
    } catch {
      res.status(503).json({ error: "Refund reports are unavailable." });
    }
  });

  for (const audience of ["guest", "staff"] as const) {
    const path = `/${audience}/refund-issues/:kind/:itemId`;
    const authenticate = audience === "guest" ? guest : staff;
    const cache: RequestHandler = (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
    };
    const handle: RequestHandler = async (req, res) => {
      try {
        if (!enabled || !pool)
          throw new BookingError("Refund reporting is unavailable.", 503);
        const kind = req.params.kind;
        const itemId = String(req.params.itemId);
        if (
          (kind !== "room" && kind !== "hall") ||
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(itemId)
        )
          throw new BookingError("Choose a valid booking item.");
        const identity =
          audience === "guest"
            ? (res.locals.guest as GuestIdentity)
            : undefined;
        if (req.method === "POST") {
          const issue = identity
            ? await reportRefundIssue(pool, kind, itemId, identity, req.body)
            : await resolveRefundIssue(
                pool,
                kind,
                itemId,
                res.locals.actorId,
                req.body,
              );
          res.json({ issue });
          return;
        }
        if (identity) await assertOwnership(pool, kind, itemId, identity);
        const records = await pool.query<Issue>(
          `select ${issueColumns} from staytrack.refund_issues where kind=$1 and item_id=$2
           ${identity ? "and reported_by=$3" : ""}`,
          identity ? [kind, itemId, identity.id] : [kind, itemId],
        );
        res.json({ issue: records.rows[0] ?? null });
      } catch (error) {
        res.status(error instanceof BookingError ? error.status : 503).json({
          error:
            error instanceof BookingError
              ? error.message
              : "Refund reporting is unavailable.",
        });
      }
    };
    app.get(path, cache, authenticate, handle);
    app.post(path, cache, authenticate, handle);
  }
}
