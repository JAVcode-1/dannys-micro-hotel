import type { BookingItemInput, BookingQuote } from "@staytrack/shared";
import { evaluateOccupants } from "./occupants.js";
import { databasePool } from "./database.js";
import type { PoolClient } from "pg";

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function parseBookingItems(
  value: unknown,
  now = Date.now(),
): BookingItemInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 15)
    throw new BookingError("Select between 1 and 15 room items.");
  return value.map((item: BookingItemInput) => {
    if (
      !item ||
      typeof item !== "object" ||
      !["double_standard", "family_executive"].includes(item.category) ||
      typeof item.startAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?(?:Z|\+08:00)$/.test(
        item.startAt,
      ) ||
      !Number.isFinite(Date.parse(item.startAt)) ||
      Date.parse(item.startAt) <= now ||
      !Array.isArray(item.blocks) ||
      item.blocks.length < 1 ||
      item.blocks.length > 30 ||
      item.blocks.some(
        (block) =>
          ![180, 360, 720, 1440].includes(block) ||
          (item.category === "family_executive" && block === 180),
      ) ||
      !evaluateOccupants(item.category, item) ||
      !Number.isSafeInteger(item.adults + item.children)
    )
      throw new BookingError(
        "Check each room's future arrival, allowed packages and occupants.",
      );
    const startAt = new Date(item.startAt).toISOString();
    // Reject dates JavaScript normalizes, such as February 30.
    if (
      new Date(
        Date.parse(item.startAt) +
          (item.startAt.endsWith("+08:00") ? 8 * 3600000 : 0),
      )
        .toISOString()
        .slice(0, 16) !== item.startAt.slice(0, 16)
    )
      throw new BookingError("Invalid arrival date.");
    return {
      category: item.category,
      startAt,
      blocks: [...item.blocks],
      adults: item.adults,
      children: item.children,
      extraBed: item.extraBed,
    };
  });
}

export type QuotePackage = {
  id: string;
  category: string;
  duration_minutes: number;
  price_centavos: string | number;
  version: number;
};

export function priceBooking(
  items: BookingItemInput[],
  catalog: QuotePackage[],
): BookingQuote {
  const quoted = items.map((item) => {
    const packages = item.blocks.map((duration) => {
      const row = catalog.find(
        (p) => p.category === item.category && p.duration_minutes === duration,
      );
      if (!row)
        throw new BookingError("A selected package is unavailable.", 409);
      const priceCentavos = Number(row.price_centavos);
      if (!Number.isSafeInteger(priceCentavos) || priceCentavos < 0)
        throw new BookingError("Package price is unavailable.", 503);
      return {
        id: row.id,
        version: row.version,
        durationMinutes: duration,
        priceCentavos,
      };
    });
    const occupancy = evaluateOccupants(item.category, item);
    if (!occupancy) throw new BookingError("Invalid occupants or extra bed.");
    const baseCentavos = packages.reduce((sum, p) => sum + p.priceCentavos, 0);
    const totalCentavos = baseCentavos + occupancy.extraBedCentavos;
    if (!Number.isSafeInteger(totalCentavos))
      throw new BookingError("Quote amount exceeds supported range.");
    return {
      ...item,
      endAt: new Date(
        Date.parse(item.startAt) +
          item.blocks.reduce((a, b) => a + b, 0) * 60000,
      ).toISOString(),
      packages,
      baseCentavos,
      extraBedCentavos: occupancy.extraBedCentavos,
      totalCentavos,
      advisory: occupancy.advisory,
    };
  });
  const totalCentavos = quoted.reduce(
    (sum, item) => sum + item.totalCentavos,
    0,
  );
  if (!Number.isSafeInteger(totalCentavos))
    throw new BookingError("Quote amount exceeds supported range.");
  return { items: quoted, totalCentavos };
}

export async function quoteBooking(
  value: unknown,
  client?: PoolClient,
): Promise<BookingQuote> {
  const items = parseBookingItems(value);
  const db = client ?? databasePool();
  const { rows } =
    await db.query<QuotePackage>(`select p.id::text, c.code as category, p.duration_minutes,
    p.price_centavos, p.version from staytrack.packages p
    join staytrack.room_categories c on c.id = p.category_id
    where p.active and c.active order by c.id, p.duration_minutes${client ? " for share of p, c" : ""}`);
  return priceBooking(items, rows);
}
