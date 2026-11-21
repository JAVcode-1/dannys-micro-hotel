import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { ReviewDelivery } from "./review-access.js";
import { processReviewInvitations } from "./review-access.js";
import type { Pool, PoolClient } from "pg";
import { expireClaims } from "./claim-holds.js";

export type MailMessage = {
  id: string;
  to: string;
  kind: string;
  payload: Record<string, unknown>;
};
// Delivery adapters must honor message.id as a durable provider idempotency key.
export interface MailAdapter {
  deliver(message: MailMessage): Promise<void>;
}
export class FakeMailAdapter implements MailAdapter {
  readonly messages: MailMessage[] = [];
  async deliver(message: MailMessage) {
    const prior = this.messages.find((x) => x.id === message.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(message))
      throw new Error("Mail idempotency conflict");
    if (!prior) this.messages.push(structuredClone(message));
  }
}
export function retryDelay(attempt: number) {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 5)
    throw new Error("Invalid delivery attempt");
  return 60000 * 2 ** (attempt - 1);
}

export async function enqueueMail(
  db: Pick<PoolClient, "query">,
  key: string,
  to: string,
  kind: string,
  payload: Record<string, unknown>,
) {
  if (
    !key ||
    key.length > 200 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
    to.length > 254
  )
    throw new Error("Invalid notification");
  await db.query(
    `insert into staytrack.notification_outbox(dedupe_key,recipient,kind,payload) values($1,$2,$3,$4) on conflict(dedupe_key) do nothing`,
    [key, to, kind, payload],
  );
}

export async function processOutbox(
  pool: Pool,
  adapter: MailAdapter,
  limit = 20,
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid notification batch");
  let sent = 0,
    failed = 0;
  for (let index = 0; index < limit; index++) {
    const lease = randomUUID();
    const row = (
      await pool.query(
        `with next as (select id from staytrack.notification_outbox where state='pending' and attempts<5 and due_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp()) order by due_at,id for update skip locked limit 1)
      update staytrack.notification_outbox o set attempts=o.attempts+1,lease_token=$1,lease_until=clock_timestamp()+interval '5 minutes' from next where o.id=next.id returning o.*`,
        [lease],
      )
    ).rows[0];
    if (!row) break;
    if (
      typeof row.payload.expiresAt === "string" &&
      Date.parse(row.payload.expiresAt) <= Date.now()
    ) {
      await pool.query(
        "update staytrack.notification_outbox set state='cancelled',lease_token=null,lease_until=null,payload='{}'::jsonb where id=$1 and lease_token=$2",
        [row.id, lease],
      );
      continue;
    }
    if (typeof row.payload.credentialDigest === "string") {
      const valid = await pool.query(
        "select 1 from staytrack.review_credentials where digest=$1 and revoked_at is null and consumed_at is null and expires_at>clock_timestamp()",
        [row.payload.credentialDigest],
      );
      if (!valid.rowCount) {
        await pool.query(
          "update staytrack.notification_outbox set state='cancelled',lease_token=null,lease_until=null,payload='{}'::jsonb where id=$1 and lease_token=$2",
          [row.id, lease],
        );
        continue;
      }
    }
    if (row.kind === "payment_reminder") {
      const held = await pool.query(
        "select 1 from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.reservation_id=$1 and i.state='held' and i.proof_deadline_at>clock_timestamp()",
        [row.reservation_id],
      );
      if (!held.rowCount) {
        await pool.query(
          "update staytrack.notification_outbox set state='cancelled',lease_token=null,lease_until=null where id=$1 and lease_token=$2",
          [row.id, lease],
        );
        continue;
      }
    }
    try {
      await adapter.deliver({
        id: row.id,
        to: row.recipient,
        kind: row.kind,
        payload: row.payload,
      });
      await pool.query(
        "update staytrack.notification_outbox set state='sent',sent_at=clock_timestamp(),lease_token=null,lease_until=null,payload='{}'::jsonb where id=$1 and lease_token=$2",
        [row.id, lease],
      );
      sent++;
    } catch {
      await pool.query(
        `update staytrack.notification_outbox set state=case when attempts>=5 then 'failed' else 'pending' end,due_at=clock_timestamp()+$3*interval '1 millisecond',lease_token=null,lease_until=null where id=$1 and lease_token=$2`,
        [row.id, lease, retryDelay(row.attempts)],
      );
      failed++;
    }
  }
  // A process dying on its final attempt must not leave an indefinitely pending row.
  await pool.query(
    "update staytrack.notification_outbox set state='failed',lease_token=null,lease_until=null where state='pending' and attempts>=5 and lease_until<=clock_timestamp()",
  );
  return { sent, failed };
}

export async function runScheduledJobs(
  pool: Pool,
  adapter: MailAdapter,
  delivery?: ReviewDelivery,
) {
  await pool.query(
    "delete from staytrack.request_limits where window_start<clock_timestamp()-interval '1 day'",
  );
  const expired = await expireClaims(Date.now(), pool);
  await pool.query(`insert into staytrack.notification_outbox(dedupe_key,recipient,kind,reservation_id,payload)
    select 'payment_reminder:'||p.reservation_id||':'||p.minute_offset,r.verified_email,'payment_reminder',r.id,jsonb_build_object('reservationId',r.id,'minuteOffset',p.minute_offset)
    from staytrack.payment_reminders p join staytrack.reservations r on r.id=p.reservation_id
    where p.state='scheduled' and p.due_at<=clock_timestamp() and r.verified_email is not null
    and exists(select 1 from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.reservation_id=r.id and i.state='held' and i.proof_deadline_at>clock_timestamp())
    on conflict(dedupe_key) do nothing`);
  if (delivery?.queueInvitation) await processReviewInvitations(pool, delivery);
  return { expired, ...(await processOutbox(pool, adapter)) };
}

export function outboxReviewDelivery(
  pool: Pool,
  identity: Pick<ReviewDelivery, "generateOtp" | "verifyOtp">,
): ReviewDelivery {
  const digest = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  return {
    ...identity,
    invitation: async (to, token) =>
      enqueueMail(
        pool,
        "review_invitation:" + createHash("sha256").update(token).digest("hex"),
        to,
        "review_invitation",
        { token, expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() },
      ),
    sendOtp: async (to, code) =>
      enqueueMail(
        pool,
        "review_otp:" +
          createHash("sha256")
            .update(to + ":" + code)
            .digest("hex"),
        to,
        "review_otp",
        { code, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() },
      ),
    queueInvitation: async (db, to, token, reservationId) =>
      enqueueMail(
        db,
        "review_invitation:" + digest(token),
        to,
        "review_invitation",
        {
          token,
          reservationId,
          credentialDigest: digest(token),
          expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        },
      ),
    queueOtp: async (db, to, code, challengeDigest, reservationId) =>
      enqueueMail(db, "review_otp:" + challengeDigest, to, "review_otp", {
        code,
        reservationId,
        credentialDigest: challengeDigest,
        expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
      }),
  };
}
