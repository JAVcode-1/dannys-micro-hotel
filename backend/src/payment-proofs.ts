import {
  onlineHallState,
  onlineHallItems,
  unifiedInstalled,
} from "./unified-booking.js";
import { createHash, randomUUID } from "node:crypto";
import type { PaymentSession } from "@staytrack/shared";
import type { GuestIdentity } from "./guest-auth.js";
import { BookingError } from "./booking-quote.js";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { requireTransactionStaff } from "./transaction-staff.js";
import {
  paymentMediaStore,
  PROOF_BUCKET,
  QR_BUCKET,
  validatePaymentImage,
  type PaymentMediaStore,
  hasControlCharacters,
} from "./payment-media.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const confirmedRollback = (error: unknown) =>
  error instanceof BookingError ||
  ["23505", "23503", "23514", "P0001", "40001", "40P01"].includes(
    (error as { code?: string } | null)?.code ?? "",
  );
function checkId(id: string) {
  if (!uuid.test(id)) throw new BookingError("Reservation not found.", 404);
}

// Only remove positively unreferenced objects. An uncertain commit must never lose its proof.
async function removeUnreferenced(
  bucket: string,
  key: string,
  store: PaymentMediaStore,
  pool: ReturnType<typeof databasePool>,
) {
  try {
    const result = await pool.query<{ used: boolean }>(
      `select exists(select 1 from staytrack.payment_submissions where object_key = $1)
      or exists(select 1 from staytrack.payment_qr where object_key = $1) as used`,
      [key],
    );
    if (!result.rows[0].used) await store.remove(bucket, key);
  } catch {
    // shortcut: retain private orphans on uncertain DB/storage failure; reconcile before live activation.
  }
}

export async function configurePaymentQr(
  actorId: string,
  label: unknown,
  bytes: Buffer,
  mime: string,
  pool = databasePool(),
  store = paymentMediaStore(),
) {
  const extension = validatePaymentImage(bytes, mime);
  if (
    typeof label !== "string" ||
    !label.trim() ||
    label.trim().length > 120 ||
    hasControlCharacters(label)
  )
    throw new BookingError(
      "Enter the verified GCash payee label (up to 120 characters).",
    );
  const key = `qr/${randomUUID()}.${extension}`;
  await store.upload(QR_BUCKET, key, bytes, mime);
  try {
    await claimTransaction(async (client) => {
      await requireTransactionStaff(client, actorId);
      await client.query(
        `insert into staytrack.payment_qr(id, object_key, payee_label, updated_by)
        values (true, $1, $2, $3) on conflict (id) do update set object_key = excluded.object_key,
        payee_label = excluded.payee_label, updated_by = excluded.updated_by, updated_at = now()`,
        [key, label.trim(), actorId],
      );
      await client.query(
        "insert into staytrack.staff_audit(actor_auth_user_id, action) values ($1, 'payment.qr_configured')",
        [actorId],
      );
    }, pool);
  } catch (error) {
    if (confirmedRollback(error))
      await removeUnreferenced(QR_BUCKET, key, store, pool);
    throw error;
  }
  return { configured: true };
}

export async function paymentQr(
  pool = databasePool(),
  store = paymentMediaStore(),
) {
  const { rows } = await pool.query<{
    object_key: string;
    payee_label: string;
  }>(
    "select object_key, payee_label from staytrack.payment_qr where id = true",
  );
  if (!rows[0]) return { configured: false, payeeLabel: null, qrUrl: null };
  return {
    configured: true,
    payeeLabel: rows[0].payee_label,
    qrUrl: await store.signedUrl(QR_BUCKET, rows[0].object_key),
  };
}

async function ownedReservation(
  guest: GuestIdentity,
  reservationId: string,
  pool: ReturnType<typeof databasePool>,
) {
  checkId(reservationId);
  const { rows } = await pool.query<{
    total_centavos: string;
    confirmation_at?: string | null;
    review_installed: boolean;
  }>(
    `select total_centavos,
      to_jsonb(reservations)->>'online_confirmation_at' as confirmation_at,
      to_jsonb(reservations) ? 'online_confirmation_at' as review_installed
    from staytrack.reservations
    where id = $1 and owner_auth_user_id = $2 and verified_email = $3`,
    [reservationId, guest.id, guest.email.toLowerCase()],
  );
  if (!rows[0]) throw new BookingError("Reservation not found.", 404);
  return rows[0];
}

export async function guestPaymentSession(
  guest: GuestIdentity,
  reservationId: string,
  pool = databasePool(),
  store = paymentMediaStore(),
): Promise<PaymentSession> {
  const reservation = await ownedReservation(guest, reservationId, pool);
  const { rows } = await pool.query<{
    state: string;
    proof_deadline_at: Date;
    now: Date;
  }>(
    `select i.state, i.proof_deadline_at, clock_timestamp() as now from staytrack.inventory_claims i
     join staytrack.room_bookings b on b.claim_id = i.id where b.reservation_id = $1 order by i.id`,
    [reservationId],
  );
  rows.push(...(await onlineHallState(pool, reservationId)));
  if (!rows.length) throw new BookingError("Payment hold unavailable.", 409);
  const deadline = Math.min(
    ...rows.map((row) => row.proof_deadline_at.getTime()),
  );
  const now = rows[0].now.getTime();
  const receivedAmountCentavos = reservation.confirmation_at
    ? (
        await pool.query<{ amount: number }>(
          `select v.amount_centavos::float8 as amount from staytrack.verified_online_payments v
          join staytrack.payment_submissions p on p.id=v.submission_id
          where p.reservation_id=$1 and p.status='confirmed'`,
          [reservationId],
        )
      ).rows[0]?.amount ?? null
    : reservation.review_installed
      ? (
          await pool.query<{ amount: number | null }>(
            `select (review.evidence->>'amountCentavos')::float8 as amount
            from staytrack.payment_submissions p
            join staytrack.payment_reviews review on review.submission_id=p.id and review.version=p.review_version
            where p.reservation_id=$1 and p.status='mismatched'`,
            [reservationId],
          )
        ).rows[0]?.amount ?? null
      : null;
  const verified =
    Boolean(reservation.confirmation_at) && receivedAmountCentavos !== null;
  // Payment history survives room-item checkout, cancellation and capacity release.
  const status = verified
    ? "confirmed"
    : rows.every((row) => row.state === "proof_pending_review")
      ? "pending_review"
      : rows.some(
            (row) =>
              row.state === "expired" ||
              (row.state === "held" && row.proof_deadline_at.getTime() <= now),
          )
        ? "expired"
        : rows.every((row) => row.state === "held")
          ? "awaiting_proof"
          : "unavailable";
  const qr = status === "awaiting_proof" ? await paymentQr(pool, store) : null;
  return {
    reservationId,
    allocations: [
      ...(
        await pool.query(
          `select category_code label,total_centavos::float8 as "amountCentavos" from staytrack.room_bookings where reservation_id=$1 order by item_index`,
          [reservationId],
        )
      ).rows,
      ...(await onlineHallItems(pool, reservationId)).map((h) => ({
        label: `Function Hall (${h.setup})`,
        amountCentavos: h.originalCentavos ?? h.totalCentavos,
      })),
    ],
    amountDueCentavos: Number(reservation.total_centavos),
    receivedAmountCentavos,
    serverNow: new Date(now).toISOString(),
    proofDeadlineAt: new Date(deadline).toISOString(),
    status,
    payeeLabel: qr?.payeeLabel ?? null,
    qrUrl: qr?.qrUrl ?? null,
    emailReminderAt: [15, 25].map((minute) =>
      new Date(deadline - (30 - minute) * 60000).toISOString(),
    ),
    emailDeliveryEnabled: false,
  };
}

export async function submitPaymentProof(
  guest: GuestIdentity,
  reservationId: string,
  reference: unknown,
  bytes: Buffer,
  mime: string,
  pool = databasePool(),
  store = paymentMediaStore(),
): Promise<{ status: "pending_review"; replayed: boolean }> {
  const extension = validatePaymentImage(bytes, mime);
  if (typeof reference !== "string" || !/^[0-9]{10,13}$/.test(reference))
    throw new BookingError(
      "Enter a GCash transaction reference with 10 to 13 digits.",
    );
  const ref = reference;
  await ownedReservation(guest, reservationId, pool);
  const hash = createHash("sha256")
    .update(ref)
    .update("\0")
    .update(bytes)
    .digest("hex");
  const key = `${reservationId}/${randomUUID()}.${extension}`;
  // Upload before taking row locks; the server clock is checked again after the upload.
  await store.upload(PROOF_BUCKET, key, bytes, mime);
  let cleanupSafe = false;
  try {
    const result = await claimTransaction(async (client) => {
      if (await unifiedInstalled(client))
        await client.query(
          "select id from staytrack.hall_resource where id=1 for update",
        );
      const reservation = await client.query<{ total_centavos: string }>(
        "select total_centavos from staytrack.reservations where id = $1 and owner_auth_user_id = $2 and verified_email = $3 for update",
        [reservationId, guest.id, guest.email.toLowerCase()],
      );
      if (!reservation.rowCount)
        throw new BookingError("Reservation not found.", 404);
      const prior = await client.query<{ request_hash: string }>(
        "select request_hash from staytrack.payment_submissions where reservation_id = $1",
        [reservationId],
      );
      if (prior.rowCount) {
        if (prior.rows[0].request_hash !== hash)
          throw new BookingError(
            "Proof already submitted. Contact staff for corrections.",
            409,
          );
        return { status: "pending_review" as const, replayed: true };
      }
      const claims = await client.query<{
        id: string;
        state: string;
        proof_deadline_at: Date;
      }>(
        `select i.id, i.state, i.proof_deadline_at from staytrack.inventory_claims i
         join staytrack.room_bookings b on b.claim_id = i.id where b.reservation_id = $1 order by i.id for update of i`,
        [reservationId],
      );
      const hallClaims = await onlineHallState(client, reservationId, true);
      const clock = await client.query<{ now: Date }>(
        "select clock_timestamp() as now",
      );
      const now = clock.rows[0].now;
      if (
        !(claims.rowCount || hallClaims.length) ||
        [...claims.rows, ...hallClaims].some(
          (row) =>
            row.state !== "held" ||
            row.proof_deadline_at.getTime() <= now.getTime(),
        )
      )
        throw new BookingError(
          "The proof deadline has passed or the hold is unavailable. If you paid, contact staff for reconciliation; do not pay again.",
          409,
        );
      await client.query(
        `insert into staytrack.payment_submissions
        (reservation_id, submitted_by, transaction_reference, object_key, content_type, byte_length, request_hash, amount_due_centavos, submitted_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          reservationId,
          guest.id,
          ref,
          key,
          mime,
          bytes.length,
          hash,
          reservation.rows[0].total_centavos,
          now,
        ],
      );
      await client.query(
        `update staytrack.inventory_claims set state = 'proof_pending_review', proof_submitted_at = $2
        where id = any($1::bigint[])`,
        [claims.rows.map((row) => row.id), now],
      );
      if (hallClaims.length)
        await client.query(
          "update staytrack.online_hall_items set state='proof_pending_review',proof_submitted_at=$2 where reservation_id=$1",
          [reservationId, now],
        );
      await client.query(
        "update staytrack.payment_reminders set state = 'cancelled' where reservation_id = $1 and state = 'scheduled'",
        [reservationId],
      );
      return { status: "pending_review" as const, replayed: false };
    }, pool);
    cleanupSafe = result.replayed;
    return result;
  } catch (error) {
    // Transport/COMMIT uncertainty retains the private image for reconciliation.
    cleanupSafe = confirmedRollback(error);
    throw error;
  } finally {
    if (cleanupSafe) await removeUnreferenced(PROOF_BUCKET, key, store, pool);
  }
}

// Schedule only: provider delivery, retry and deployed scheduler remain disabled.
export async function duePaymentReminders(pool = databasePool()) {
  const { rows } =
    await pool.query(`select m.reservation_id, m.minute_offset, m.due_at
    from staytrack.payment_reminders m where m.state = 'scheduled' and m.due_at <= clock_timestamp()
    and exists (select 1 from staytrack.room_bookings b join staytrack.inventory_claims i on i.id = b.claim_id
      where b.reservation_id = m.reservation_id and i.state = 'held' and i.proof_deadline_at > clock_timestamp())
    and not exists (select 1 from staytrack.payment_submissions p where p.reservation_id = m.reservation_id)
    order by m.due_at limit 100`);
  return rows;
}
