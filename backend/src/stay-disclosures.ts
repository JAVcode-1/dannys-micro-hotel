import { hasControlCharacters } from "./payment-media.js";
import type { PoolClient } from "pg";
import { BookingError } from "./booking-quote.js";
import { stayId, stayObject } from "./stay-change-policy.js";
export type ChargeDisclosure = {
  policyVersionId: string;
  acknowledgement: string;
};
export function parseChargeDisclosures(value: unknown): ChargeDisclosure[] {
  if (!Array.isArray(value) || value.length > 20)
    throw new BookingError("Invalid charge acknowledgement.");
  return value.map((x) => {
    const v = stayObject(x, ["policyVersionId", "acknowledgement"]);
    if (
      typeof v.acknowledgement !== "string" ||
      !v.acknowledgement.trim() ||
      v.acknowledgement.length > 1000 ||
      hasControlCharacters(v.acknowledgement)
    )
      throw new BookingError("Explicit charge acknowledgement required.");
    return {
      policyVersionId: stayId(v.policyVersionId),
      acknowledgement: v.acknowledgement.trim(),
    };
  });
}
export async function captureChargeDisclosures(
  db: PoolClient,
  reservation: string,
  disclosures: ChargeDisclosure[],
) {
  for (const d of disclosures)
    await db.query(
      "insert into staytrack.reservation_charge_disclosures(reservation_id,policy_version_id,acknowledgement) values($1,$2,$3)",
      [reservation, d.policyVersionId, d.acknowledgement],
    );
}
