import type { Express, RequestHandler, Response } from "express";
import { BookingError, quoteBooking } from "./booking-quote.js";
import {
  createWalkInBooking,
  recordWalkInPayment,
  walkInBooking,
  walkInBookings,
} from "./walkins.js";
import type { databasePool } from "./database.js";
export type WalkInRouteOptions = {
  pool?: ReturnType<typeof databasePool>;
  writesEnabled?: boolean;
};
export function registerWalkInRoutes(
  app: Express,
  staff: RequestHandler,
  options: WalkInRouteOptions = {},
) {
  const fail = (res: Response, error: unknown) =>
    res.status(error instanceof BookingError ? error.status : 503).json({
      error:
        error instanceof BookingError
          ? error.message
          : "Walk-in service unavailable. The approved migration and acceptance gates are required.",
    });
  app.use("/staff/walkins", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const closed: RequestHandler = (_req, res, next) => {
    if (!options.writesEnabled) {
      res.status(503).json({
        error:
          "Live walk-in booking and payments are closed pending acceptance.",
      });
      return;
    }
    next();
  };
  app.get("/staff/walkins", staff, async (req, res) => {
    try {
      res.json({
        ...(await walkInBookings(
          options.pool,
          req.query.page === undefined ? 0 : Number(req.query.page),
        )),
        writesEnabled: options.writesEnabled === true,
      });
    } catch (error) {
      fail(res, error);
    }
  });
  app.post("/staff/walkins/quote", staff, async (req, res) => {
    try {
      res.json(await quoteBooking(req.body?.items));
    } catch (error) {
      fail(res, error);
    }
  });
  app.get("/staff/walkins/:id", staff, async (req, res) => {
    try {
      res.json(await walkInBooking(String(req.params.id), options.pool));
    } catch (error) {
      fail(res, error);
    }
  });
  app.post("/staff/walkins", staff, closed, async (req, res) => {
    try {
      res.json(
        await createWalkInBooking(
          res.locals.actorId as string,
          req.body?.requestKey,
          req.body?.primaryName,
          req.body?.items,
          options.pool,
        ),
      );
    } catch (error) {
      fail(res, error);
    }
  });
  app.post("/staff/walkins/:id/payments", staff, closed, async (req, res) => {
    try {
      res.json(
        await recordWalkInPayment(
          res.locals.actorId as string,
          String(req.params.id),
          req.body,
          options.pool,
        ),
      );
    } catch (error) {
      fail(res, error);
    }
  });
}
