import { BookingError } from "./booking-quote.js";
import { normalizePaymentReference } from "./payment-review.js";

// Historical Hall transfers used the approval as their full transfer amount.
export const hallRefundTransferAmount =
  "coalesce((to_jsonb(t)->>'amount_centavos')::bigint,a.amount_centavos)";

export function hallDepositMet(total: bigint, net: bigint) {
  return net >= (total + 1n) / 2n;
}

export function hallStartPaymentIssue(
  walkIn: boolean,
  total: bigint,
  netPaid: bigint,
  netAfterApprovedRefunds: bigint,
) {
  const coversStart = (amount: bigint) =>
    walkIn ? hallDepositMet(total, amount) : amount >= total;
  if (!coversStart(netPaid))
    return walkIn
      ? "Verified payment must cover at least half the booking price before starting."
      : "Full verified net payment is required.";
  if (!coversStart(netAfterApprovedRefunds))
    return "Resolve the outstanding refund approval before starting.";
}

export function normalizeHallReceipt(input: {
  method?: unknown;
  amount?: unknown;
  reference?: unknown;
  verified?: unknown;
}) {
  if (
    (input.method !== "cash" && input.method !== "gcash") ||
    typeof input.amount !== "number" ||
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.verified !== true
  ) {
    throw new BookingError("Record only a verified payment actually received.");
  }
  const reference =
    input.method === "gcash"
      ? normalizePaymentReference(input.reference)
      : null;
  return { method: input.method, amount: input.amount, reference };
}
