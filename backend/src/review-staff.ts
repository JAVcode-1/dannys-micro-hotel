import type { PoolClient } from "pg";
import { BookingError } from "./booking-quote.js";
import { reviewDigest } from "./review-access.js";

const reasons = new Set([
  "spam_fraud",
  "abuse",
  "private_information",
  "prohibited_content",
]);
type Action =
  | "hold"
  | "hide"
  | "restore"
  | "reply"
  | "in_progress"
  | "resolved"
  | "contact_access";

export async function staffReviewAction(
  client: PoolClient,
  actor: string,
  id: string,
  key: string,
  action: Action,
  reasonCode: string,
  reason: string,
) {
  const enabled = await client.query(
    "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
    [actor],
  );
  if (!enabled.rowCount) throw new BookingError("Staff access denied.", 403);
  const feedback =
    action === "in_progress" ||
    action === "resolved" ||
    action === "contact_access";
  const table = feedback ? "private_feedback" : "guest_reviews";
  const subject = feedback ? "feedback_id" : "review_id";
  const { rows } = await client.query<{ status: string }>(
    `select status from staytrack.${table} where id=$1 for update`,
    [id],
  );
  if (!rows[0]) throw new BookingError("Record unavailable.", 404);
  const prior = rows[0].status;
  const hash = reviewDigest(
    JSON.stringify([actor, action, reasonCode, reason]),
  );
  const retry = await client.query<{ request_hash: string }>(
    `select request_hash from staytrack.review_events where ${subject}=$1 and request_key=$2`,
    [id, key],
  );
  if (retry.rows[0] && retry.rows[0].request_hash !== hash)
    throw new BookingError("Request differs from the original.", 409);
  if (action === "contact_access") {
    const contact = await client.query<{ follow_up_email: string | null }>(
      "select follow_up_email from staytrack.private_feedback where id=$1",
      [id],
    );
    if (!contact.rows[0]?.follow_up_email)
      throw new BookingError("No consented follow-up contact.", 404);
    if (!retry.rows[0])
      await client.query(
        "insert into staytrack.review_events(feedback_id,actor_auth_user_id,action,request_key,request_hash) values($1,$2,$3,$4,$5)",
        [id, actor, action, key, hash],
      );
    return { email: contact.rows[0].follow_up_email };
  }
  if (retry.rows[0]) return;
  let next = prior;
  if (action === "reply") {
    if (prior !== "published" || !reason)
      throw new BookingError("A published review and reply text are required.");
    const reply = await client.query(
      "insert into staytrack.review_replies(review_id,actor_auth_user_id,message) values($1,$2,$3) on conflict do nothing",
      [id, actor, reason],
    );
    if (!reply.rowCount)
      throw new BookingError("A reply has already been recorded.", 409);
  } else if (feedback) {
    if (
      !(prior === "new" && action === "in_progress") &&
      !(prior === "in_progress" && action === "resolved")
    )
      throw new BookingError("Feedback status changed.", 409);
    next = action;
  } else {
    if (!reason || !reasons.has(reasonCode))
      throw new BookingError("A content policy reason is required.");
    if (
      prior === "withdrawn" ||
      (action === "hold" && prior !== "published") ||
      (action === "hide" && prior !== "published" && prior !== "held") ||
      (action === "restore" && prior !== "held" && prior !== "hidden")
    )
      throw new BookingError("Review status changed.", 409);
    next =
      action === "hold" ? "held" : action === "hide" ? "hidden" : "published";
  }
  if (next !== prior)
    await client.query(`update staytrack.${table} set status=$2 where id=$1`, [
      id,
      next,
    ]);
  await client.query(
    `insert into staytrack.review_events(${subject},actor_auth_user_id,action,reason_code,reason,previous_status,next_status,request_key,request_hash)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      actor,
      action,
      reasonCode || null,
      action === "reply" ? null : reason || null,
      prior,
      next,
      key,
      hash,
    ],
  );
}
