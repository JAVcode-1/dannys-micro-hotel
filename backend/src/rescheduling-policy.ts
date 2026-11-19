import type {
  RescheduleInput,
  RescheduleSnapshot,
  RescheduleEligibility,
} from "@staytrack/shared";
import { BookingError, parseBookingItems } from "./booking-quote.js";
import { hasControlCharacters } from "./payment-media.js";

export const rescheduleKey = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(v);
export const rescheduleReason = (v: unknown): v is string =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  v.length <= 1000 &&
  !hasControlCharacters(v);
export function parseRescheduleInput(
  value: unknown,
  now: number,
): RescheduleInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BookingError("Invalid schedule request.");
  const v = value as RescheduleInput;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          "requestKey",
          "expectedRevision",
          "startAt",
          "endAt",
          "blocks",
          "reason",
        ].includes(k),
    ) ||
    !rescheduleKey(v.requestKey) ||
    !rescheduleReason(v.reason) ||
    !Number.isSafeInteger(v.expectedRevision) ||
    v.expectedRevision < 0
  )
    throw new BookingError(
      "Valid reason, retry key and schedule revision required.",
    );
  const item = parseBookingItems(
    [
      {
        category: "double_standard",
        startAt: v.startAt,
        blocks: v.blocks,
        adults: 1,
        children: 0,
        extraBed: false,
      },
    ],
    now,
  )[0];
  // Parse both endpoints so calendar normalization and ambiguous local times never slip through.
  const end = parseBookingItems([{ ...item, startAt: v.endAt }], now)[0]
    .startAt;
  if (
    Date.parse(end) - Date.parse(item.startAt) !==
    item.blocks.reduce((a, b) => a + b, 0) * 60000
  )
    throw new BookingError("End time must match the selected packages.");
  return {
    requestKey: v.requestKey,
    expectedRevision: v.expectedRevision,
    startAt: item.startAt,
    endAt: end,
    blocks: item.blocks,
    reason: v.reason.trim(),
  };
}
export function classifyReschedule(
  source: RescheduleSnapshot,
  input: RescheduleInput,
  comparisonCentavos: number | null,
): { eligibility: RescheduleEligibility; deltaCentavos: number | null } {
  if (
    Date.parse(source.startAt) === Date.parse(input.startAt) &&
    Date.parse(source.endAt) === Date.parse(input.endAt) &&
    JSON.stringify(source.blocks) === JSON.stringify(input.blocks)
  )
    throw new BookingError("Choose a different schedule.");
  const changed =
    JSON.stringify(source.blocks) !== JSON.stringify(input.blocks);
  if (
    changed &&
    (!Number.isSafeInteger(comparisonCentavos) ||
      comparisonCentavos! < 0 ||
      !Number.isSafeInteger(comparisonCentavos! - source.totalCentavos))
  )
    throw new BookingError("Comparison quote unavailable.", 409);
  return {
    eligibility:
      source.channel === "walk_in"
        ? "walk_in_policy_pending"
        : source.extraBedCentavos > 0
          ? "extra_bed_policy_pending"
          : changed
            ? "financial_policy_pending"
            : "eligible",
    deltaCentavos: changed ? comparisonCentavos! - source.totalCentavos : 0,
  };
}
