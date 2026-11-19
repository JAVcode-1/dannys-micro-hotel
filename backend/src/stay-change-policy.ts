import type { ExtensionInput } from "@staytrack/shared";
import {
  BookingError,
  priceBooking,
  type QuotePackage,
} from "./booking-quote.js";
import { hasControlCharacters } from "./payment-media.js";
export function stayObject(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new BookingError("Invalid stay-change fields.");
  return value as Record<string, unknown>;
}
export function stayMoney(value: unknown, positive = false): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0)
  )
    throw new BookingError("A safe whole-centavo amount is required.");
  return value;
}
export function stayId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\b[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)
  )
    throw new BookingError("Valid item or event required.");
  return value;
}
export function stayBase(v: Record<string, unknown>) {
  if (
    typeof v.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(v.requestKey) ||
    typeof v.reason !== "string" ||
    !v.reason.trim() ||
    v.reason.length > 1000 ||
    hasControlCharacters(v.reason)
  )
    throw new BookingError("A reason and valid retry key are required.");
  return { requestKey: v.requestKey, reason: v.reason.trim() };
}
export function stayInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|\+08:00)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new BookingError("Use an explicit valid zoned time.");
  const local = new Date(
    Date.parse(value) + (value.endsWith("+08:00") ? 28800000 : 0),
  ).toISOString();
  if (local.slice(0, 19) !== value.slice(0, 19))
    throw new BookingError("Invalid calendar date.");
  return new Date(value).toISOString();
}
export function minimumExtensionPayment(value: number) {
  stayMoney(value);
  return Math.floor(value / 2) + (value % 2);
}
export function nextExtensionCheckout(
  baselineAt: string,
  approvedMinutes: number,
  requestedMinutes: number,
) {
  stayMoney(approvedMinutes);
  stayMoney(requestedMinutes, true);
  const end =
    Date.parse(stayInstant(baselineAt)) +
    (approvedMinutes + requestedMinutes) * 60000;
  if (!Number.isSafeInteger(end) || !Number.isFinite(new Date(end).getTime()))
    throw new BookingError("Extension exceeds the supported time range.");
  return new Date(end).toISOString();
}
export function settlementDue(
  baseDue: number,
  extras: {
    amountCentavos: number;
    creditCentavos: number;
    allocatedCentavos: number;
  }[],
) {
  let due = stayMoney(baseDue);
  for (const e of extras) {
    const c = stayMoney(e.amountCentavos),
      credit = stayMoney(e.creditCentavos),
      paid = stayMoney(e.allocatedCentavos);
    if (credit + paid > c)
      throw new BookingError("Financial records require reconciliation.", 409);
    due = stayMoney(due + c - credit - paid);
  }
  return due;
}
export function parseExtensionInput(value: unknown): ExtensionInput {
  const v = stayObject(value, [
    "requestKey",
    "expectedRevision",
    "blocks",
    "reason",
  ]);
  const base = stayBase(v);
  const revision = stayMoney(v.expectedRevision);
  if (
    !Array.isArray(v.blocks) ||
    !v.blocks.length ||
    v.blocks.length > 30 ||
    v.blocks.some((b) => ![180, 360, 720, 1440].includes(b))
  )
    throw new BookingError("Choose supported additional packages.");
  return {
    ...base,
    expectedRevision: revision,
    blocks: [...v.blocks] as number[],
  };
}
export function quoteAdditionalPackages(
  category: "double_standard" | "family_executive",
  oldEnd: string,
  blocks: number[],
  catalog: QuotePackage[],
  adults: number,
  children: number,
) {
  if (
    !blocks.length ||
    blocks.length > 30 ||
    blocks.some(
      (x) =>
        ![180, 360, 720, 1440].includes(x) ||
        (category === "family_executive" && x === 180),
    )
  )
    throw new BookingError("Supported additional package required.");
  for (const minutes of blocks) {
    const p = catalog.find(
      (x) => x.category === category && x.duration_minutes === minutes,
    );
    if (
      !p ||
      !Number.isSafeInteger(Number(p.price_centavos)) ||
      Number(p.price_centavos) < 0
    )
      throw new BookingError(
        "Approved additional package price required.",
        409,
      );
  }
  return priceBooking(
    [{ category, startAt: oldEnd, blocks, adults, children, extraBed: false }],
    catalog,
  ).items[0];
}
