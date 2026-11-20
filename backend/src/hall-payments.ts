import { BookingError } from "./booking-quote.js";
import { normalizePaymentReference } from "./payment-review.js";

export function hallDepositMet(total: bigint, net: bigint) {
  return net >= (total + 1n) / 2n;
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
