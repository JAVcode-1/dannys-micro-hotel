import { createHash } from "node:crypto";
import type { Express } from "express";
import type { Pool, PoolClient } from "pg";
import type { GuestIdentity } from "./guest-auth.js";
import { BookingError } from "./booking-quote.js";
import { claimTransaction } from "./inventory-claims.js";
import { hasControlCharacters } from "./payment-media.js";
import { hallRefundTransferAmount } from "./hall-payments.js";
import {
  onlineHallCancellationEligible,
  parseOnlineHall,
  quoteUnified,
} from "./unified-booking.js";

export async function cancelOnlineHall(
  db: PoolClient,
  hallId: string,
  now: number,
) {
  const r = (
    await db.query<{
      state: string;
      original_centavos: string;
      online_confirmation_at: Date | null;
      actual_start: Date | null;
      status: string;
      claim_id: string;
      total_centavos: string;
      collected: string;
    }>(
      `select o.*,r.online_confirmation_at,h.actual_start,h.status,h.claim_id,q.total_centavos,
      (coalesce((select sum(amount_centavos) from staytrack.online_payment_allocations where hall_reservation_id=h.id),0)
      +coalesce((select sum(amount_centavos) from staytrack.hall_receipts where reservation_id=h.id),0)
      -coalesce((select sum(${hallRefundTransferAmount}) from staytrack.hall_refund_approvals a join staytrack.hall_refund_transfers t on t.approval_id=a.id where a.reservation_id=h.id),0))::text collected
    from staytrack.online_hall_items o join staytrack.reservations r on r.id=o.reservation_id
    join staytrack.hall_reservations h on h.id=o.hall_reservation_id
    join lateral(select total_centavos from staytrack.hall_revisions where reservation_id=h.id order by id desc limit 1) q on true
    where h.id=$1 for update of o,r,h`,
      [hallId],
    )
  ).rows[0];
  if (
    !r ||
    r.state !== "confirmed" ||
    r.status !== "confirmed" ||
    !onlineHallCancellationEligible(
      r.online_confirmation_at ? +r.online_confirmation_at : null,
      r.actual_start ? +r.actual_start : null,
      now,
    )
  )
    throw new BookingError(
      "Free cancellation is available for one hour after staff confirmation and before the event actually starts.",
      409,
    );
  if (r.collected !== r.total_centavos)
    throw new BookingError(
      "Overpayments or missing item funding require staff financial reconciliation before cancellation.",
      409,
    );
  const approved = (
    await db.query<{ amount: string }>(
      `select coalesce(sum(a.amount_centavos-coalesce((select sum(${hallRefundTransferAmount})
         from staytrack.hall_refund_transfers t where t.approval_id=a.id),0)),0)::text amount
       from staytrack.hall_refund_approvals a where a.reservation_id=$1`,
      [hallId],
    )
  ).rows[0];
  if (BigInt(approved.amount) > 0n)
    throw new BookingError(
      "An existing refund approval requires staff reconciliation.",
      409,
    );
  await db.query(
    "insert into staytrack.hall_refund_approvals(reservation_id,amount_centavos,reason) values($1,$2,'UB-05 eligible online item cancellation; manual GCash transfer required')",
    [hallId, r.total_centavos],
  );
  await db.query(
    "update staytrack.hall_claims set released_at=clock_timestamp() where id=$1 and released_at is null",
    [r.claim_id],
  );
  await db.query(
    "update staytrack.online_hall_items set state='released' where hall_reservation_id=$1",
    [hallId],
  );
  await db.query(
    "update staytrack.hall_reservations set status='cancelled',payment_resolution=true where id=$1",
    [hallId],
  );
}

export async function guestHallAction(
  pool: Pool,
  guest: GuestIdentity,
  hallId: string,
  action: "cancel" | "change",
  value: unknown,
) {
  const input = value as Record<string, unknown>;
  if (
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(hallId) ||
    !input ||
    typeof input.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(input.requestKey) ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 1000 ||
    hasControlCharacters(input.reason)
  )
    throw new BookingError("Enter a reason and a valid request key.");
  const reason = input.reason.trim();
  const hash = createHash("sha256")
    .update(JSON.stringify([hallId, action, input]))
    .digest("hex");
  return claimTransaction(async (db) => {
    await db.query(
      "select id from staytrack.hall_resource where id=1 for update",
    );
    const owns = await db.query(
      `select r.id from staytrack.reservations r join staytrack.online_hall_items o on o.reservation_id=r.id
      where o.hall_reservation_id=$1 and r.owner_auth_user_id=$2 and lower(r.verified_email)=$3 for update of r`,
      [hallId, guest.id, guest.email.toLowerCase()],
    );
    if (!owns.rowCount) throw new BookingError("Hall booking not found.", 404);
    const prior = (
      await db.query<{ request_hash: string; result: Record<string, unknown> }>(
        "select request_hash,result from staytrack.online_hall_requests where actor=$1 and request_key=$2",
        [guest.id, input.requestKey],
      )
    ).rows[0];
    if (prior) {
      if (prior.request_hash !== hash)
        throw new BookingError("Request key already used.", 409);
      return { ...prior.result, replayed: true };
    }
    const now = +(await db.query<{ now: Date }>("select clock_timestamp() now"))
      .rows[0].now;
    const kind =
      action === "cancel"
        ? "cancel"
        : input.kind === "extend"
          ? "extend"
          : "reschedule";
    if (action === "cancel") await cancelOnlineHall(db, hallId, now);
    else {
      const active = await db.query(
        "select 1 from staytrack.hall_reservations where id=$1 and status in ('confirmed','in_progress')",
        [hallId],
      );
      if (!active.rowCount)
        throw new BookingError(
          "Only an active confirmed event can request a change.",
          409,
        );
      if (kind === "extend") {
        if (
          !Number.isSafeInteger(input.hours) ||
          Number(input.hours) < 1 ||
          Number(input.hours) > 24
        )
          throw new BookingError("Choose additional whole hours.");
      } else
        await quoteUnified(
          [],
          parseOnlineHall({
            setup: input.setup,
            start: input.start,
            minutes: input.minutes,
            attendees: input.attendees,
          }),
          db,
        );
    }
    const result = {
      status: action === "cancel" ? "cancelled" : "requested",
      replayed: false,
    };
    await db.query(
      `insert into staytrack.online_hall_requests(hall_reservation_id,actor,request_key,request_hash,kind,reason,input,result)
      values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [hallId, guest.id, input.requestKey, hash, kind, reason, input, result],
    );
    return result;
  }, pool);
}
export function registerGuestHall(
  app: Express,
  verify: (token: string) => Promise<GuestIdentity | null>,
  pool?: Pool,
  enabled = false,
) {
  for (const action of ["cancel", "change"] as const)
    app.post(`/guest/hall/:id/${action}`, async (req, res) => {
      res.set("Cache-Control", "private, no-store");
      const token = /^Bearer ([^\s]+)$/.exec(
        req.header("authorization") ?? "",
      )?.[1];
      if (!token) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      try {
        const guest = await verify(token);
        if (!guest) throw new BookingError("Guest access denied", 403);
        if (!enabled || !pool)
          throw new BookingError("Online Hall changes are not open.", 503);
        res.json(
          await guestHallAction(
            pool,
            guest,
            String(req.params.id),
            action,
            req.body,
          ),
        );
      } catch (error) {
        res.status(error instanceof BookingError ? error.status : 503).json({
          error:
            error instanceof BookingError
              ? error.message
              : "Hall action unavailable.",
        });
      }
    });
}
