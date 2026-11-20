import type { Express, Request, RequestHandler } from "express";
import type { Pool } from "pg";
import type { GuestIdentity } from "./guest-auth.js";
import { BookingError } from "./booking-quote.js";
import {
  finishReviewOtp,
  issueReviewInvitation,
  redeemReviewInvitation,
  startReviewOtp,
  startReviewPairing,
  withReviewTransaction,
  type ReviewDelivery,
} from "./review-access.js";
import {
  publishedReviews,
  submitGuestReview,
  submitPrivateFeedback,
  withdrawGuestReview,
} from "./reviews.js";
import { staffReviewAction } from "./review-staff.js";

type Options = { pool: Pick<Pool, "connect">; delivery: ReviewDelivery };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function value(input: unknown, max: number) {
  if (
    typeof input !== "string" ||
    input.trim().length > max ||
    input.includes("\u0000")
  )
    throw new BookingError("Invalid review input.");
  return input.trim();
}
function recordId(input: unknown) {
  if (typeof input !== "string" || !uuid.test(input))
    throw new BookingError("Invalid review request.");
  return input;
}
function email(input: unknown) {
  const normalized = value(input, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new BookingError("Enter a valid email.");
  return normalized;
}
function key(req: Request) {
  const result = req.header("Idempotency-Key") ?? "";
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(result))
    throw new BookingError("Invalid request key.");
  return result;
}

export function registerReviews(
  app: Express,
  staff: RequestHandler,
  verifyGuest: (token: string) => Promise<GuestIdentity | null>,
  options?: Options,
) {
  if (!options) return;
  const { pool, delivery } = options;
  const counters = new Map<string, { count: number; expires: number }>();
  function rate(req: Request) {
    const now = Date.now();
    const source = req.ip ?? "unknown";
    if (counters.size >= 10000) {
      for (const [id, row] of counters)
        if (row.expires <= now) counters.delete(id);
      if (counters.size >= 10000 && !counters.has(source))
        throw new BookingError("Try again later.", 429);
    }
    const row = counters.get(source);
    if (!row || row.expires <= now)
      counters.set(source, { count: 1, expires: now + 600000 });
    else if (++row.count > 20) throw new BookingError("Try again later.", 429);
  }
  const handle =
    (fn: import("express").RequestHandler): import("express").RequestHandler =>
    async (req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      try {
        await fn(req, res, next);
      } catch (error) {
        res.status(error instanceof BookingError ? error.status : 503).json({
          error:
            error instanceof BookingError
              ? error.message
              : "Reviews are unavailable.",
        });
      }
    };
  async function guest(req: Request) {
    const bearer = /^Bearer ([^\s]+)$/.exec(
      req.header("authorization") ?? "",
    )?.[1];
    const identity = bearer ? await verifyGuest(bearer) : null;
    if (!identity) throw new BookingError("Review access denied.", 403);
    return identity;
  }
  async function access(req: Request) {
    if (req.body?.grant !== undefined)
      return { token: value(req.body.grant, 43) };
    return {
      guest: await guest(req),
      reservation: recordId(req.body?.reservation),
    };
  }
  function page(req: Request) {
    const current = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(current) || current < 1 || current > 500)
      throw new BookingError("Invalid page.");
    return current;
  }
  app.get(
    "/reviews",
    handle(async (req, res) => {
      res.json(
        await withReviewTransaction(pool, (client) =>
          publishedReviews(client, page(req)),
        ),
      );
    }),
  );
  app.post(
    "/review-invitations/request",
    handle(async (req, res) => {
      rate(req);
      const identity = await guest(req);
      const reservation = recordId(req.body?.reservation);
      await withReviewTransaction(pool, async (client) => {
        if (req.body?.consent === true)
          await client.query(
            `insert into staytrack.review_contacts(reservation_id,email,verified_auth_user_id,invitation_consent_at)
         select id,verified_email,owner_auth_user_id,clock_timestamp() from staytrack.reservations
         where id=$1 and owner_auth_user_id=$2 and verified_email=$3
         on conflict(reservation_id) do nothing`,
            [reservation, identity.id, identity.email],
          );
      });
      const owns = await withReviewTransaction(pool, (client) =>
        client.query(
          "select 1 from staytrack.reservations where id=$1 and owner_auth_user_id=$2 and verified_email=$3",
          [reservation, identity.id, identity.email],
        ),
      );
      if (owns.rowCount)
        await issueReviewInvitation(pool, delivery, reservation);
      res.status(202).json({ accepted: true });
    }),
  );
  app.post(
    "/staff/review-invitations/request",
    staff,
    handle(async (req, res) => {
      rate(req);
      await issueReviewInvitation(
        pool,
        delivery,
        recordId(req.body?.reservation),
      );
      res.status(202).json({ accepted: true });
    }),
  );
  app.post(
    "/review-invitations/verify",
    handle(async (req, res) => {
      rate(req);
      const credential = value(req.body?.token, 43);
      const token = await withReviewTransaction(pool, (client) =>
        redeemReviewInvitation(client, credential),
      );
      if (!token)
        throw new BookingError("Review link is invalid or expired.", 403);
      res.json({ token });
    }),
  );
  app.post(
    "/review-access/otp",
    handle(async (req, res) => {
      rate(req);
      const purpose = req.body?.purpose;
      if (purpose !== "feedback" && purpose !== "withdrawal")
        throw new BookingError("Invalid review access purpose.");
      res.status(202).json({
        challenge: await startReviewOtp(
          pool,
          delivery,
          recordId(req.body?.reservation),
          email(req.body?.email),
          purpose === "feedback" ? "feedback_otp" : "withdrawal_otp",
        ),
      });
    }),
  );
  app.post(
    "/staff/review-enrollment",
    staff,
    handle(async (req, res) => {
      rate(req);
      const pairing = await startReviewPairing(
        pool,
        recordId(req.body?.reservation),
        res.locals.actorId,
      );
      if (!pairing)
        throw new BookingError("Review enrollment unavailable.", 409);
      res.status(201).json({ pairing });
    }),
  );
  app.post(
    "/review-access/enroll",
    handle(async (req, res) => {
      rate(req);
      res.status(202).json({
        challenge: await startReviewOtp(
          pool,
          delivery,
          "",
          email(req.body?.email),
          "enrollment",
          value(req.body?.pairing, 43),
        ),
      });
    }),
  );
  app.post(
    "/review-access/verify",
    handle(async (req, res) => {
      rate(req);
      const result = await finishReviewOtp(
        pool,
        delivery,
        value(req.body?.challenge, 43),
        value(req.body?.code, 12),
        req.body?.consent === true,
      );
      if (!result)
        throw new BookingError("Verification is invalid or expired.", 403);
      res.json(result);
    }),
  );
  app.post(
    "/reviews",
    handle(async (req, res) => {
      rate(req);
      const verified = await access(req);
      const result = await withReviewTransaction(pool, (client) =>
        submitGuestReview(client, verified, {
          key: key(req),
          stars: req.body?.stars,
          comment: value(req.body?.comment ?? "", 2000) || null,
          consent: req.body?.consent === true,
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    }),
  );
  app.post(
    "/reviews/withdrawal",
    handle(async (req, res) => {
      rate(req);
      const verified = await access(req);
      await withReviewTransaction(pool, (client) =>
        withdrawGuestReview(client, verified, key(req)),
      );
      res.status(204).end();
    }),
  );
  app.post(
    "/private-feedback",
    handle(async (req, res) => {
      rate(req);
      const verified = await access(req);
      const message = value(req.body?.message, 4000);
      if (!message) throw new BookingError("Enter feedback.");
      const result = await withReviewTransaction(pool, (client) =>
        submitPrivateFeedback(client, verified, {
          key: key(req),
          message,
          followUp: req.body?.followUp === true,
        }),
      );
      res.status(result.replayed ? 200 : 201).json(result);
    }),
  );
  app.get(
    "/staff/reviews",
    staff,
    handle(async (req, res) => {
      const { rows } = await withReviewTransaction(pool, (client) =>
        client.query(
          `select r.id,r.alias,r.stars,r.comment,r.status,r.submitted_at,p.message reply
       from staytrack.guest_reviews r left join staytrack.review_replies p on p.review_id=r.id
       order by r.submitted_at desc,r.id desc offset $1 limit 20`,
          [(page(req) - 1) * 20],
        ),
      );
      res.json({ entries: rows });
    }),
  );
  app.get(
    "/staff/private-feedback",
    staff,
    handle(async (req, res) => {
      const { rows } = await withReviewTransaction(pool, (client) =>
        client.query(
          `select id,message,status,submitted_at,follow_up_email is not null as can_follow_up
        from staytrack.private_feedback order by submitted_at desc,id desc offset $1 limit 20`,
          [(page(req) - 1) * 20],
        ),
      );
      res.json({ entries: rows });
    }),
  );
  for (const action of [
    "hold",
    "hide",
    "restore",
    "reply",
    "in_progress",
    "resolved",
    "contact_access",
  ] as const) {
    const path =
      action === "hold" ||
      action === "hide" ||
      action === "restore" ||
      action === "reply"
        ? "/staff/reviews/:id/"
        : "/staff/private-feedback/:id/";
    app.post(
      path + action,
      staff,
      handle(async (req, res) => {
        const result = await withReviewTransaction(pool, (client) =>
          staffReviewAction(
            client,
            res.locals.actorId,
            recordId(req.params.id),
            key(req),
            action,
            value(req.body?.reasonCode ?? "", 40),
            value(req.body?.reason ?? "", action === "reply" ? 2000 : 1000),
          ),
        );
        if (result) res.json(result);
        else res.status(204).end();
      }),
    );
  }
}
