import type { HallQuoteInput, HallSettings } from "@staytrack/shared";
import { BookingError } from "./booking-quote.js";

const minute = 60000;
const day = 1440 * minute;
const manila = 480 * minute;
const iso = (ms: number) => new Date(ms).toISOString();
export const hallDefaults: Readonly<HallSettings> = Object.freeze({
  opening: 480,
  closing: 1320,
  notice: 180,
  horizon: 90,
  preparation: 30,
  cleanup: 30,
  noShowGrace: 60,
  reminder: 15,
});

export function hallPackagePrice(start: string, duration: number) {
  const hour = Number(start.slice(11, 13));
  const base = hour >= 8 && hour < 17 ? 300000 : 500000;
  const additional = ((duration - 180) / 60) * 100000;
  return { base, additional, total: base + additional };
}

export function quoteHall(
  input: HallQuoteInput,
  settings: HallSettings,
  now: number,
  ready = false,
) {
  const cap = input.setup === "theater" ? 70 : input.setup === "room" ? 50 : 0;
  if (
    !Number.isInteger(input.attendees) ||
    input.attendees < 1 ||
    input.attendees > cap
  )
    throw new BookingError(
      "Attendee count exceeds the selected setup capacity.",
    );
  if (
    !Number.isInteger(input.minutes) ||
    input.minutes < 180 ||
    input.minutes > 1440 ||
    input.minutes % 60
  )
    throw new BookingError(
      "Book at least three hours in full-hour increments.",
    );
  const local = Date.parse(input.start + ":00.000Z");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.start) ||
    !Number.isFinite(local) ||
    iso(local).slice(0, 16) !== input.start
  )
    throw new BookingError("Choose a valid Manila start time.");
  const start = local - manila;
  const end = start + input.minutes * minute;
  const plannedPreparation = start - settings.preparation * minute;
  if (start <= now) throw new BookingError("Choose a future event start time.");
  if (plannedPreparation < now && !ready)
    throw new BookingError(
      "Choose a later start so staff have time to prepare the Hall.",
    );
  const protectedStart = Math.max(plannedPreparation, now);
  const protectedEnd = end + settings.cleanup * minute;
  if (
    Math.floor(local / day) - Math.floor((now + manila) / day) >
    settings.horizon
  )
    throw new BookingError("The event exceeds the booking horizon.");
  const noticeReason = input.noticeReason?.trim();
  if (noticeReason && noticeReason.length > 1000)
    throw new BookingError("Shorten the notice override reason.");
  return {
    setup: input.setup,
    attendees: input.attendees,
    minutes: input.minutes,
    start: iso(start),
    end: iso(end),
    protectedStart: iso(protectedStart),
    protectedEnd: iso(protectedEnd),
    ...hallPackagePrice(input.start, input.minutes),
    settings: { ...settings },
    noticeReason: noticeReason ?? null,
  };
}
