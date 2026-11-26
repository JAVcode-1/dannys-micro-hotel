import type { Express, RequestHandler } from "express";
import { databasePool } from "./database.js";
import { BookingError } from "./booking-quote.js";
import { loadAnalyticsRows } from "./analytics-data.js";
import { calculateAnalytics } from "./analytics-report.js";

function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BookingError("Choose valid Manila dates.");
  const parsed = new Date(value + "T00:00:00.000Z");
  if (
    !Number.isFinite(+parsed) ||
    parsed.toISOString().slice(0, 10) !== value ||
    +parsed < Date.UTC(2000, 0, 1)
  )
    throw new BookingError("Choose valid Manila dates.");
  return +parsed;
}

export function registerAnalytics(
  app: Express,
  staff: RequestHandler,
  pool?: ReturnType<typeof databasePool>,
) {
  app.get("/staff/analytics", staff, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const { from, through, grain, category } = req.query;
      const first = date(from);
      const last = date(through);
      if (last < first || last - first >= 366 * 86400000)
        throw new BookingError("Choose a range of at most 366 days.");
      if (grain !== "day" && grain !== "week" && grain !== "month")
        throw new BookingError("Choose a valid trend interval.");
      if (
        category !== undefined &&
        (typeof category !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(category))
      )
        throw new BookingError("Choose a valid category.");
      const timestamp = (ms: number) =>
        new Date(ms - 8 * 3600000).toISOString().replace("Z", "000Z");
      const start = timestamp(first);
      const end = timestamp(last + 86400000);
      const client = await (pool ?? databasePool()).connect();
      let rows;
      try {
        await client.query("begin isolation level repeatable read read only");
        rows = await loadAnalyticsRows(client, start, end);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
      res.json(calculateAnalytics(rows, start, end, grain, category));
    } catch (error) {
      res.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Analytics is unavailable.",
      });
    }
  });
}
