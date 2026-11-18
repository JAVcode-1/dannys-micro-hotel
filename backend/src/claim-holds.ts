import { databasePool } from "./database.js";

const validTime = (value: number) =>
  Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime());

export function reviewAge(
  submittedAt: number,
  now: number,
): "on_time" | "overdue" | "urgent" | "critical" {
  if (!validTime(submittedAt) || !validTime(now) || now < submittedAt)
    throw new Error("Invalid review time");
  const minutes = (now - submittedAt) / 60000;
  return minutes >= 60
    ? "critical"
    : minutes >= 30
      ? "urgent"
      : minutes >= 15
        ? "overdue"
        : "on_time";
}

// Run from an operator-controlled scheduler; repeated runs only touch still-held claims.
export async function expireClaims(
  now: number,
  pool = databasePool(),
): Promise<number> {
  if (!validTime(now)) throw new Error("Invalid cleanup time");
  const result = await pool.query(
    `update staytrack.inventory_claims set state = 'expired'
     where state = 'held' and proof_deadline_at <= $1`,
    [new Date(now)],
  );
  return result.rowCount ?? 0;
}

// Single-claim internal helper. Multi-room O02 submission protects every item in one transaction.
export async function submitClaimProof(
  id: number,
  submittedAt: number,
  pool = databasePool(),
): Promise<"protected" | "replayed" | "late_reconciliation" | "unavailable"> {
  if (!Number.isSafeInteger(id) || id < 1 || !validTime(submittedAt))
    return "unavailable";
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{
      state: string;
      proof_deadline_at: Date;
      proof_submitted_at: Date | null;
    }>(
      `select state, proof_deadline_at, proof_submitted_at
       from staytrack.inventory_claims where id = $1 for update`,
      [id],
    );
    const claim = result.rows[0];
    if (!claim) {
      await client.query("rollback");
      return "unavailable";
    }
    if (claim.state === "proof_pending_review") {
      await client.query("commit");
      return "replayed";
    }
    if (
      claim.state === "expired" ||
      (claim.state === "held" &&
        submittedAt > claim.proof_deadline_at.getTime())
    ) {
      await client.query("rollback");
      return "late_reconciliation";
    }
    if (claim.state !== "held") {
      await client.query("rollback");
      return "unavailable";
    }
    await client.query(
      `update staytrack.inventory_claims
       set state = 'proof_pending_review', proof_submitted_at = $2 where id = $1`,
      [id, new Date(submittedAt)],
    );
    await client.query("commit");
    return "protected";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
