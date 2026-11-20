import { registerStayChanges } from "./extensions.js";
import { registerCancellations } from "./cancellations.js";
import { registerReschedules } from "./rescheduling.js";
import express from "express";
import type { HealthResponse } from "@staytrack/shared";
import { probeDatabase } from "./database.js";
import { auditStaffAccess, verifyStaff } from "./staff-auth.js";
import type { StaffIdentity } from "./staff-auth.js";
import { verifyGuest } from "./guest-auth.js";
import type { GuestIdentity } from "./guest-auth.js";
import { BookingError, quoteBooking } from "./booking-quote.js";
import { guestReservations } from "./guest-booking.js";
import {
  registerPaymentRoutes,
  type PaymentRouteOptions,
} from "./payment-routes.js";
import { staffRooms, registerHousekeeping } from "./rooms.js";
import { registerStayMonitoring } from "./stay-monitoring.js";
import { registerCheckIn } from "./check-in.js";
import {
  registerWalkInRoutes,
  type WalkInRouteOptions,
} from "./walkin-routes.js";
import { getSettings, saveSettings } from "./operational-settings.js";
import { evaluateOccupants } from "./occupants.js";
import {
  publicCatalog,
  changePackagePrice,
  staffCatalog,
  setPackageActive,
  updateCategory,
} from "./catalog.js";

export function createApp(
  databaseProbe: () => Promise<void> = probeDatabase,
  staffVerifier: (token: string) => Promise<StaffIdentity | null> = verifyStaff,
  audit: (actorId: string) => Promise<void> = auditStaffAccess,
  guestVerifier: (token: string) => Promise<GuestIdentity | null> = verifyGuest,
  paymentOptions: PaymentRouteOptions = {},
  walkInOptions: WalkInRouteOptions = {},
) {
  const app = express();
  app.use(express.json({ limit: "8kb" }));
  app.use((request, response, next) => {
    const allowedOrigin = process.env.STAFF_WEB_ORIGIN;
    if (allowedOrigin && request.header("origin") === allowedOrigin) {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, X-GCash-Payee, X-Transaction-Reference",
      );
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Vary", "Origin");
      if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
      }
    }
    next();
  });
  let lastProbe: Promise<void> | undefined;
  let lastProbeAt = 0;
  let probeInFlight = false;
  const attempts = new Map<string, { count: number; resetAt: number }>();

  app.use(
    [
      "/staff/me",
      "/guest/me",
      "/guest/quote",
      "/guest/reservations",
      "/guest/payments",
      "/staff/payment-qr",
      "/staff/payment-reviews",
      "/staff/walkins",
      "/staff/check-ins",
      "/staff/stays",
      "/staff/stay-changes",
      "/staff/stay-extensions",
      "/staff/stay-receipts",
      "/staff/stay-allocations",
      "/staff/stay-reviews",
      "/staff/stay-charges",
      "/staff/cancellations",
      "/guest/cancellations",
      "/staff/reschedules",
      "/guest/reschedules",
      "/staff/catalog",
      "/staff/catalog/package-price",
      "/staff/catalog/packages",
      "/staff/catalog/categories",
      "/staff/rooms",
      "/staff/settings",
    ],
    (request, response, next) => {
      response.setHeader("Cache-Control", "no-store");
      const now = Date.now();
      const address = request.ip ?? "unknown";
      if (attempts.size >= 10000) {
        for (const [key, value] of attempts)
          if (value.resetAt <= now) attempts.delete(key);
        if (!attempts.has(address) && attempts.size >= 10000) {
          response.status(429).json({ error: "Too many requests" });
          return;
        }
      }
      const current = attempts.get(address);
      const bucket =
        current && current.resetAt > now
          ? current
          : { count: 0, resetAt: now + 60000 };
      bucket.count += 1;
      attempts.set(address, bucket);
      if (bucket.count > 30) {
        response.setHeader(
          "Retry-After",
          String(Math.ceil((bucket.resetAt - now) / 1000)),
        );
        response.status(429).json({ error: "Too many requests" });
        return;
      }
      next();
    },
  );

  app.get("/health", (_request, response) => {
    const body: HealthResponse = { status: "ok" };
    response.json(body);
  });

  app.get("/ready", async (_request, response) => {
    try {
      if (
        !lastProbe ||
        (!probeInFlight && performance.now() - lastProbeAt >= 5000)
      ) {
        lastProbeAt = performance.now();
        probeInFlight = true;
        const current = Promise.resolve().then(databaseProbe);
        lastProbe = current;
        void current.then(
          () => {
            if (lastProbe === current) probeInFlight = false;
          },
          () => {
            if (lastProbe === current) {
              probeInFlight = false;
            }
          },
        );
      }
      await lastProbe;
      response.json({ status: "ready" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });
  app.get("/staff/me", async (request, response) => {
    const authorization = request.header("authorization");
    const match = /^Bearer ([^\s]+)$/.exec(authorization ?? "");
    if (!match) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const staff = await staffVerifier(match[1]);
      if (!staff) {
        response.status(403).json({ error: "Staff access denied" });
        return;
      }
      await audit(staff.id);
      response.setHeader("Cache-Control", "no-store");
      response.json({ id: staff.id, email: staff.email });
    } catch {
      response.status(503).json({ error: "Staff access unavailable" });
    }
  });
  app.get("/guest/me", async (request, response) => {
    const match = /^Bearer ([^\s]+)$/.exec(
      request.header("authorization") ?? "",
    );
    if (!match) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const guest = await guestVerifier(match[1]);
      if (!guest) {
        response.status(403).json({ error: "Guest access denied" });
        return;
      }
      response.setHeader("Cache-Control", "no-store");
      response.json({ id: guest.id, email: guest.email });
    } catch {
      response.status(503).json({ error: "Guest access unavailable" });
    }
  });
  app.get("/catalog", async (_request, response) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json(await publicCatalog());
    } catch {
      response.status(503).json({ error: "Catalog unavailable" });
    }
  });
  app.post("/guest/quote", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      response.json(await quoteBooking(request.body?.items));
    } catch (error) {
      response.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Quote unavailable. Please try again later.",
      });
    }
  });
  app.post("/guest/reservations", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.status(503).json({
      error:
        "Online booking is not open. Payment and readiness checks are pending.",
    });
  });
  app.get("/guest/reservations", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const match = /^Bearer ([^\s]+)$/.exec(
      request.header("authorization") ?? "",
    );
    if (!match) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const guest = await guestVerifier(match[1]);
      if (!guest) {
        response.status(403).json({ error: "Guest access denied" });
        return;
      }
      response.json(await guestReservations(guest));
    } catch {
      response.status(503).json({
        error: "Reservation lookup is unavailable. Online booking is not open.",
      });
    }
  });
  app.put("/staff/catalog/package-price", async (request, response) => {
    const match = /^Bearer ([^\s]+)$/.exec(
      request.header("authorization") ?? "",
    );
    if (!match) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const staff = await staffVerifier(match[1]);
      if (!staff) {
        response.status(403).json({ error: "Staff access denied" });
        return;
      }
      const { categoryCode, durationMinutes, priceCentavos } =
        request.body ?? {};
      if (
        !(await changePackagePrice(
          staff.id,
          categoryCode,
          durationMinutes,
          priceCentavos,
        ))
      ) {
        response.status(400).json({ error: "Unsupported package or price" });
        return;
      }
      response.status(204).end();
    } catch {
      response.status(503).json({ error: "Catalog update unavailable" });
    }
  });
  async function catalogStaff(
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) {
    const match = /^Bearer ([^\s]+)$/.exec(
      request.header("authorization") ?? "",
    );
    if (!match) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const staff = await staffVerifier(match[1]);
      if (!staff) {
        response.status(403).json({ error: "Staff access denied" });
        return;
      }
      response.locals.actorId = staff.id;
      next();
    } catch {
      response.status(503).json({ error: "Staff access unavailable" });
    }
  }
  app.get("/staff/catalog", catalogStaff, async (_request, response) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json(await staffCatalog());
    } catch {
      response.status(503).json({ error: "Catalog unavailable" });
    }
  });
  app.patch(
    "/staff/catalog/packages",
    catalogStaff,
    async (request, response) => {
      try {
        const { categoryCode, durationMinutes, active } = request.body ?? {};
        if (
          !(await setPackageActive(
            response.locals.actorId as string,
            categoryCode,
            durationMinutes,
            active,
          ))
        ) {
          response.status(400).json({ error: "Unsupported package state" });
          return;
        }
        response.status(204).end();
      } catch {
        response.status(503).json({ error: "Catalog update unavailable" });
      }
    },
  );
  app.patch(
    "/staff/catalog/categories",
    catalogStaff,
    async (request, response) => {
      try {
        const { categoryCode, name, active } = request.body ?? {};
        if (
          !(await updateCategory(
            response.locals.actorId as string,
            categoryCode,
            name,
            active,
          ))
        ) {
          response.status(400).json({ error: "Unsupported category state" });
          return;
        }
        response.status(204).end();
      } catch {
        response.status(503).json({ error: "Catalog update unavailable" });
      }
    },
  );
  app.get("/staff/rooms", catalogStaff, async (_request, response) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json(await staffRooms());
    } catch {
      response.status(503).json({ error: "Room catalog unavailable" });
    }
  });
  app.get("/staff/settings", catalogStaff, async (_request, response) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json(await getSettings());
    } catch {
      response.status(503).json({ error: "Settings unavailable" });
    }
  });
  app.put("/staff/settings", catalogStaff, async (request, response) => {
    try {
      if (
        !(await saveSettings(response.locals.actorId as string, request.body))
      ) {
        response.status(400).json({ error: "Invalid settings" });
        return;
      }
      response.status(204).end();
    } catch {
      response.status(503).json({ error: "Settings update unavailable" });
    }
  });
  app.post("/occupancy-advisory", (request, response) => {
    const { categoryCode, adults, children, extraBed } = request.body ?? {};
    const result = evaluateOccupants(categoryCode, {
      adults,
      children,
      extraBed,
    });
    if (!result) {
      response.status(400).json({ error: "Invalid occupants or extra bed" });
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    response.json(result);
  });
  registerPaymentRoutes(app, catalogStaff, guestVerifier, paymentOptions);
  registerWalkInRoutes(app, catalogStaff, walkInOptions);
  registerCheckIn(app, catalogStaff);
  registerStayMonitoring(app, catalogStaff);
  registerHousekeeping(app, catalogStaff);
  registerCancellations(app, catalogStaff, guestVerifier);
  registerReschedules(app, catalogStaff, guestVerifier);
  registerStayChanges(app, catalogStaff);
  return app;
}

export const app = createApp();
