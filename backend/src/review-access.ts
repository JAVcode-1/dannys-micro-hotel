import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { PoolClient } from "pg";

export async function loadReviewEligibility(
  client: Pick<PoolClient, "query">,
  reservationId: string,
) {
  const { rows } = await client.query<{
    first_checkout: Date | null;
    public_open: boolean;
  }>(
    `select first_checkout,
      coalesce(clock_timestamp() < first_checkout + interval '720 hours', false) public_open
     from (
       select min(o.checked_out_at) first_checkout
       from staytrack.room_bookings b
       join staytrack.room_check_ins i on i.room_booking_id = b.id
       join staytrack.room_checkouts o on o.room_booking_id = i.room_booking_id
       where b.reservation_id = $1 and o.checked_out_at > i.checked_in_at
         and o.checked_out_at <= clock_timestamp()
     ) eligible`,
    [reservationId],
  );
  return rows[0];
}

export type ReviewAction = "review" | "feedback" | "withdrawal";

export function allowsReviewAction(grant: ReviewAction, action: ReviewAction) {
  return grant === action || (grant === "review" && action === "feedback");
}

export const reviewDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function createReviewGrant(
  client: Pick<PoolClient, "query">,
  reservationId: string,
  purpose: ReviewAction,
) {
  const token = randomBytes(32).toString("base64url");
  await client.query(
    `insert into staytrack.review_credentials(digest,reservation_id,purpose,expires_at)
     values($1,$2,$3,clock_timestamp()+interval '15 minutes')`,
    [reviewDigest(token), reservationId, purpose],
  );
  return token;
}

export async function verifiedReviewGrant(
  client: Pick<PoolClient, "query">,
  token: string,
  action: ReviewAction,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { rows } = await client.query<{
    reservation_id: string;
    purpose: ReviewAction;
  }>(
    `select reservation_id,purpose from staytrack.review_credentials
     where digest=$1 and purpose in ('review','withdrawal','feedback')
       and expires_at>clock_timestamp() and revoked_at is null and consumed_at is null`,
    [reviewDigest(token)],
  );
  const grant = rows[0];
  return grant && allowsReviewAction(grant.purpose, action)
    ? grant.reservation_id
    : null;
}

export async function withReviewTransaction<T>(
  pool: Pick<import("pg").Pool, "connect">,
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function lockReviewReservation(client: PoolClient, id: string) {
  await client.query(
    "select id from staytrack.reservations where id=$1 for update",
    [id],
  );
}

export async function redeemReviewInvitation(
  client: PoolClient,
  token: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const digest = reviewDigest(token);
  const { rows } = await client.query<{ reservation_id: string }>(
    "select reservation_id from staytrack.review_credentials where digest=$1 and purpose='invitation'",
    [digest],
  );
  const reservation = rows[0]?.reservation_id;
  if (!reservation) return null;
  await lockReviewReservation(client, reservation);
  const consumed = await client.query(
    `update staytrack.review_credentials set consumed_at=clock_timestamp()
      where digest=$1 and purpose='invitation' and delivery_state in ('pending','sent')
      and consumed_at is null and revoked_at is null and expires_at>clock_timestamp()`,
    [digest],
  );
  if (consumed.rowCount !== 1) return null;
  return createReviewGrant(client, reservation, "review");
}

export type ReviewDelivery = {
  queueInvitation?(
    db: PoolClient,
    email: string,
    token: string,
    reservationId: string,
  ): Promise<void>;
  queueOtp?(
    db: PoolClient,
    email: string,
    code: string,
    challengeDigest: string,
    reservationId: string,
  ): Promise<void>;
  invitation(email: string, token: string): Promise<void>;
  generateOtp(email: string): Promise<string>;
  sendOtp(email: string, code: string): Promise<void>;
  verifyOtp(
    email: string,
    code: string,
  ): Promise<{ id: string; email: string } | null>;
};

type ReviewPool = Pick<import("pg").Pool, "connect">;
type ChallengePurpose = "feedback_otp" | "withdrawal_otp" | "enrollment";
type CredentialPurpose = ChallengePurpose | "invitation" | "enrollment_pair";

async function reviewContact(client: PoolClient, reservation: string) {
  const { rows } = await client.query<{
    email: string;
    invitation_allowed: boolean;
  }>(
    `select coalesce(r.verified_email,c.email) email,
       c.invitation_consent_at is not null invitation_allowed
     from staytrack.reservations r left join staytrack.review_contacts c on c.reservation_id=r.id
     where r.id=$1 and coalesce(r.verified_email,c.email) is not null`,
    [reservation],
  );
  return rows[0] ?? null;
}

async function issueCredential(
  client: PoolClient,
  reservation: string,
  email: string,
  purpose: CredentialPurpose,
  token: string,
) {
  const quota = await client.query(
    `select 1 from staytrack.review_credentials
      where reservation_id=$1 and purpose=$2 and created_at>clock_timestamp()-interval '1 hour'
      offset 2 limit 1`,
    [reservation, purpose],
  );
  if (quota.rowCount) return false;
  await client.query(
    `update staytrack.review_credentials set revoked_at=clock_timestamp()
      where reservation_id=$1 and purpose=$2 and consumed_at is null and revoked_at is null`,
    [reservation, purpose],
  );
  await client.query(
    `insert into staytrack.review_credentials(digest,reservation_id,purpose,email,expires_at,delivery_state)
      values($1,$2,$3,$4,clock_timestamp()+
        case when $3='invitation' then interval '24 hours' else interval '10 minutes' end,'pending')`,
    [reviewDigest(token), reservation, purpose, email],
  );
  return true;
}

export async function issueReviewInvitation(
  pool: ReviewPool,
  delivery: ReviewDelivery,
  reservation: string,
) {
  if (delivery.queueInvitation)
    return withReviewTransaction(pool, (client) =>
      queueReviewInvitation(client, delivery, reservation),
    );
  const token = randomBytes(32).toString("base64url");
  const email = await withReviewTransaction(pool, async (client) => {
    await lockReviewReservation(client, reservation);
    if (!(await loadReviewEligibility(client, reservation)).public_open)
      return null;
    const contact = await reviewContact(client, reservation);
    if (!contact?.invitation_allowed) return null;
    return (await issueCredential(
      client,
      reservation,
      contact.email,
      "invitation",
      token,
    ))
      ? contact.email
      : null;
  });
  if (email)
    await sendCredential(pool, token, () => delivery.invitation(email, token));
}

async function queueReviewInvitation(
  client: PoolClient,
  delivery: ReviewDelivery,
  reservation: string,
) {
  if (!delivery.queueInvitation) return false;
  await lockReviewReservation(client, reservation);
  if (!(await loadReviewEligibility(client, reservation)).public_open)
    return false;
  const contact = await reviewContact(client, reservation);
  if (!contact?.invitation_allowed) return false;
  const token = randomBytes(32).toString("base64url");
  if (
    !(await issueCredential(
      client,
      reservation,
      contact.email,
      "invitation",
      token,
    ))
  )
    return false;
  await delivery.queueInvitation(client, contact.email, token, reservation);
  return true;
}

// One automatic invitation per consented completed reservation; explicit reissues keep their quota.
export async function processReviewInvitations(
  pool: ReviewPool,
  delivery: ReviewDelivery,
  limit = 20,
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid invitation batch.");
  if (!delivery.queueInvitation) return 0;
  return withReviewTransaction(pool, async (client) => {
    const candidates = await client.query<{ id: string }>(
      `select r.id from staytrack.reservations r
       join staytrack.review_contacts c on c.reservation_id=r.id
       where c.invitation_consent_at is not null
       and not exists(select 1 from staytrack.review_invitation_jobs j where j.reservation_id=r.id)
       and not exists(select 1 from staytrack.guest_reviews gr where gr.reservation_id=r.id)
       and not exists(select 1 from staytrack.review_credentials rc where rc.reservation_id=r.id and rc.purpose='invitation')
       and (select min(o.checked_out_at) from staytrack.room_bookings b
         join staytrack.room_check_ins ci on ci.room_booking_id=b.id
         join staytrack.room_checkouts o on o.room_booking_id=b.id
         where b.reservation_id=r.id and o.checked_out_at>ci.checked_in_at and o.checked_out_at<=clock_timestamp()) > clock_timestamp()-interval '720 hours'
       order by r.created_at,r.id limit $1 for update of r skip locked`,
      [limit],
    );
    let queued = 0;
    for (const row of candidates.rows) {
      const claimed = await client.query(
        "insert into staytrack.review_invitation_jobs(reservation_id) values($1) on conflict do nothing returning reservation_id",
        [row.id],
      );
      if (!claimed.rowCount) continue;
      if (await queueReviewInvitation(client, delivery, row.id)) {
        queued++;
      }
    }
    return queued;
  });
}

async function sendCredential(
  pool: ReviewPool,
  token: string,
  send: () => Promise<void>,
) {
  let state = "sent";
  try {
    await send();
  } catch {
    state = "failed";
  }
  await withReviewTransaction(pool, async (client) => {
    await client.query(
      "update staytrack.review_credentials set delivery_state=$2 where digest=$1",
      [reviewDigest(token), state],
    );
  });
}

export async function startReviewPairing(
  pool: ReviewPool,
  reservation: string,
  actor: string,
) {
  const token = randomBytes(32).toString("base64url");
  return withReviewTransaction(pool, async (client) => {
    await lockReviewReservation(client, reservation);
    const allowed = await client.query(
      `select 1 from staytrack.reservations r join staytrack.staff_accounts s
        on s.auth_user_id=$2 and s.active where r.id=$1 and r.channel='walk_in'
        and not exists (select 1 from staytrack.review_contacts c where c.reservation_id=r.id)`,
      [reservation, actor],
    );
    return allowed.rowCount &&
      (await issueCredential(client, reservation, "", "enrollment_pair", token))
      ? token
      : null;
  });
}

export async function startReviewOtp(
  pool: ReviewPool,
  delivery: ReviewDelivery,
  reservation: string,
  email: string,
  purpose: ChallengePurpose,
  pairing?: string,
  background = true,
) {
  const token = randomBytes(32).toString("base64url");
  const issued = await withReviewTransaction(pool, async (client) => {
    if (purpose === "enrollment") {
      const binding = await client.query<{ reservation_id: string }>(
        "select reservation_id from staytrack.review_credentials where digest=$1 and purpose='enrollment_pair'",
        [reviewDigest(pairing ?? "")],
      );
      if (!binding.rows[0]) return false;
      reservation = binding.rows[0].reservation_id;
    }
    await lockReviewReservation(client, reservation);
    if (purpose === "enrollment") {
      const allowed = await client.query(
        `update staytrack.review_credentials set consumed_at=clock_timestamp() where digest=$1
          and purpose='enrollment_pair' and revoked_at is null and consumed_at is null
          and expires_at>clock_timestamp()`,
        [reviewDigest(pairing ?? "")],
      );
      if (!allowed.rowCount) return false;
    } else {
      const contact = await reviewContact(client, reservation);
      if (
        contact?.email !== email ||
        !(await loadReviewEligibility(client, reservation)).first_checkout
      )
        return false;
    }
    const created = await issueCredential(
      client,
      reservation,
      email,
      purpose,
      token,
    );
    if (created && delivery.queueOtp) {
      const code = await delivery.generateOtp(email);
      await client.query(
        "update staytrack.review_credentials set otp_digest=$2 where digest=$1",
        [reviewDigest(token), reviewDigest(token + ":" + code)],
      );
      await delivery.queueOtp(
        client,
        email,
        code,
        reviewDigest(token),
        reservation,
      );
    }
    return created;
  });
  if (issued && !delivery.queueOtp) {
    const send = () =>
      sendCredential(pool, token, async () => {
        const code = await delivery.generateOtp(email);
        const saved = await withReviewTransaction(pool, (client) =>
          client.query(
            "update staytrack.review_credentials set otp_digest=$2 where digest=$1 and revoked_at is null",
            [reviewDigest(token), reviewDigest(token + ":" + code)],
          ),
        );
        if (saved.rowCount) await delivery.sendOtp(email, code);
      });
    if (background)
      setImmediate(() => {
        void send().catch(() => {});
      });
    else await send();
  }
  return token;
}

export async function finishReviewOtp(
  pool: ReviewPool,
  delivery: ReviewDelivery,
  token: string,
  code: string,
  consent: boolean,
) {
  const digest = reviewDigest(token);
  const challenge = await withReviewTransaction(pool, async (client) => {
    const { rows } = await client.query<{
      reservation_id: string;
      email: string;
      purpose: ChallengePurpose;
      otp_digest: string;
    }>(
      `update staytrack.review_credentials set attempts=attempts+1 where digest=$1
        and purpose in ('enrollment','feedback_otp','withdrawal_otp')
        and consumed_at is null and revoked_at is null and expires_at>clock_timestamp()
        and delivery_state in ('pending','sent') and attempts<5 returning reservation_id,email,purpose,otp_digest`,
      [digest],
    );
    return rows[0];
  });
  if (!challenge || challenge.otp_digest !== reviewDigest(token + ":" + code))
    return null;
  const identity = await delivery.verifyOtp(challenge.email, code);
  if (!identity || identity.email.toLowerCase() !== challenge.email)
    return null;
  return withReviewTransaction(pool, async (client) => {
    await lockReviewReservation(client, challenge.reservation_id);
    const result = await client.query(
      `update staytrack.review_credentials set consumed_at=clock_timestamp() where digest=$1
        and consumed_at is null and revoked_at is null and expires_at>clock_timestamp()`,
      [digest],
    );
    if (result.rowCount !== 1) return null;
    if (challenge.purpose === "enrollment") {
      const staff = await client.query(
        "select 1 from staytrack.staff_accounts where auth_user_id=$1",
        [identity.id],
      );
      if (staff.rowCount) return null;
      const inserted = await client.query(
        `insert into staytrack.review_contacts(reservation_id,email,verified_auth_user_id,invitation_consent_at)
          values($1,$2,$3,case when $4 then clock_timestamp() end)
          on conflict(reservation_id) do nothing`,
        [challenge.reservation_id, challenge.email, identity.id, consent],
      );
      return inserted.rowCount ? { enrolled: true } : null;
    }
    if (
      (await reviewContact(client, challenge.reservation_id))?.email !==
      challenge.email
    )
      return null;
    return {
      token: await createReviewGrant(
        client,
        challenge.reservation_id,
        challenge.purpose === "feedback_otp" ? "feedback" : "withdrawal",
      ),
    };
  });
}

export function reviewDeliveryWithSupabaseOtp(
  invitation: ReviewDelivery["invitation"],
  sendOtp: ReviewDelivery["sendOtp"],
): ReviewDelivery {
  function auth() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Guest authentication unavailable");
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).auth;
  }
  return {
    invitation,
    sendOtp,
    async generateOtp(email) {
      const url = process.env.SUPABASE_URL;
      const secret = process.env.SUPABASE_SECRET_KEY;
      if (!url || !secret) throw new Error("Verification delivery unavailable");
      const { data, error } = await createClient(url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).auth.admin.generateLink({ type: "magiclink", email });
      if (error || !data.properties?.email_otp)
        throw new Error("Verification delivery unavailable");
      return data.properties.email_otp;
    },
    async verifyOtp(email, token) {
      const { data, error } = await auth().verifyOtp({
        email,
        token,
        type: "email",
      });
      const user = data.user;
      if (error || !user?.email_confirmed_at || !user.email || !data.session)
        return null;
      return { id: user.id, email: user.email.toLowerCase() };
    },
  };
}
