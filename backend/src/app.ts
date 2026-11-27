import { registerGuestHall } from "./unified-hall-actions.js";
import { configuredMailAdapter } from "./mail.js";
import { quoteUnified, hallAvailability } from "./unified-booking.js";
import { registerHall } from "./hall-routes.js";
import { signInStaffUsername } from "./staff-sign-in.js";
import { registerReservationWorkspace } from "./reservation-workspace.js";
import { registerStaffNavEvents } from "./staff-nav-events.js";
import { registerReviews } from "./review-routes.js";
import { registerAnalytics } from "./analytics.js";
import { registerAudit } from "./audit.js";
import { registerMaintenance } from "./maintenance.js";
import { registerStayChanges } from "./extensions.js";
import { registerCancellations } from "./cancellations.js";
import { registerRefundIssues } from "./refund-issues.js";
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
  createGuestHold,
  bookingPolicy,
  parseBookingContact,
} from "./guest-booking.js";
import { randomUUID } from "node:crypto";
import {
  claimTransaction,
  createClaimsInTransaction,
} from "./inventory-claims.js";
import type { RuntimeComposition } from "./isolated-composition.js";
import { sharedRequestLimit } from "./request-limits.js";
import { databasePool } from "./database.js";
import {
  assertDevelopmentProject,
  assertIsolatedTarget,
  proxyTrust,
} from "./runtime-config.js";
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
  runtime?: RuntimeComposition,
) {
  if (runtime?.writesEnabled) {
    if (runtime.hostedDevelopment) {
      assertDevelopmentProject();
      const ssl = runtime.pool.options.ssl;
      if (
        process.env.NODE_ENV !== "development" ||
        runtime.pool !== databasePool() ||
        !ssl ||
        typeof ssl !== "object" ||
        ssl.rejectUnauthorized !== true
      )
        throw new Error(
          "Hosted development requires the configured database pool and verified TLS in development mode.",
        );
    } else {
      assertIsolatedTarget(runtime.pool.options);
    }
  }
  const app = express();
  if (
    process.env.RATE_LIMIT_MODE &&
    !["memory", "postgres"].includes(process.env.RATE_LIMIT_MODE)
  )
    throw new Error("RATE_LIMIT_MODE must be memory or postgres.");
  app.set("trust proxy", proxyTrust(process.env.TRUSTED_PROXY_CIDRS));
  app.use(express.json({ limit: "8kb" }));
  app.use((request, response, next) => {
    response.vary("Origin");
    const allowedOrigin = process.env.STAFF_WEB_ORIGIN;
    if (allowedOrigin && request.header("origin") === allowedOrigin) {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, Idempotency-Key, X-GCash-Payee, X-Transaction-Reference",
      );
      response.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, OPTIONS",
      );
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
      "/availability",
      "/staff",
      "/guest",
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
      "/staff/audit",
      "/staff/analytics",
      "/staff/settings",
    ],
    async (request, response, next) => {
      response.setHeader("Cache-Control", "no-store");
      if (process.env.RATE_LIMIT_MODE === "postgres") {
        try {
          const result = await sharedRequestLimit(
            runtime?.pool ?? databasePool(),
            request.ip ?? "unknown",
          );
          if (!result.allowed) {
            response.setHeader("Retry-After", String(result.retryAfter));
            response.status(429).json({ error: "Too many requests" });
            return;
          }
          next();
          return;
        } catch {
          response
            .status(503)
            .json({ error: "Request protection unavailable." });
          return;
        }
      }
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

  registerStaffNavEvents(app, catalogStaff);

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
  app.post("/staff/sign-in", async (request, response) => {
    if (runtime?.writesEnabled && !runtime.hostedDevelopment) {
      response
        .status(503)
        .json({ error: "Use the local development sign-in." });
      return;
    }
    try {
      response.json(await signInStaffUsername(request.body));
    } catch (error) {
      response.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Staff sign-in is unavailable.",
      });
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
      response.json({
        id: staff.id,
        email: staff.email,
        username: staff.username,
      });
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
      response.json(await publicCatalog(runtime?.pool));
    } catch {
      response.status(503).json({ error: "Catalog unavailable" });
    }
  });
  app.post("/guest/quote", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      response.json(
        runtime?.pool
          ? await claimTransaction(
              (db) => quoteUnified(request.body?.items, request.body?.hall, db),
              runtime.pool,
            )
          : await quoteBooking(request.body?.items),
      );
    } catch (error) {
      response.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Quote unavailable. Please try again later.",
      });
    }
  });
  app.get("/guest/booking-status", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({
      enabled: runtime?.writesEnabled === true,
      bookingEnabled: runtime?.writesEnabled === true,
      policy: bookingPolicy,
      hallEnabled: runtime?.writesEnabled === true,
      unifiedEnabled: runtime?.writesEnabled === true,
      isolatedDevelopment:
        runtime?.writesEnabled === true && !runtime.hostedDevelopment,
      paymentsEnabled:
        runtime?.writesEnabled === true &&
        paymentOptions.guestEnabled === true &&
        paymentOptions.confirmationEnabled === true,
    });
  });
  app.post("/availability", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      const result = await claimTransaction(async (client) => {
        const quote = await quoteUnified(
          request.body?.items,
          request.body?.hall,
          client,
        );
        const settings = await client.query(
          "select cleaning_buffer_minutes from staytrack.operational_settings where id=true for share",
        );
        const buffer = settings.rows[0]?.cleaning_buffer_minutes;
        if (quote.items.length && (buffer === null || buffer === undefined))
          throw new BookingError(
            "Availability requires configured turnover settings.",
            503,
          );
        const check = quote.items.length
          ? await createClaimsInTransaction(
              randomUUID(),
              quote.items.map((item) => ({
                category: item.category,
                start: Date.parse(item.startAt),
                end: Date.parse(item.endAt),
                bufferMinutes: buffer,
              })),
              client,
              true,
            )
          : { status: "created", reason: undefined };
        const hallAvailable =
          !quote.hall || (await hallAvailability(client, quote.hall));
        return {
          available: check.status === "created" && hallAvailable,
          ...(quote.hall && { hallAvailable }),
          reason:
            check.status !== "created"
              ? check.reason
              : !hallAvailable
                ? "The Function Hall is unavailable for the selected schedule, including preparation and cleanup time."
                : undefined,
          quote,
          advisory: true,
        };
      }, runtime?.pool);
      response.json(result);
    } catch (error) {
      response.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Availability unavailable.",
      });
    }
  });
  app.post("/guest/reservations", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!runtime?.writesEnabled) {
      response.status(503).json({
        error:
          "Online booking is not open. Payment and readiness checks are pending.",
      });
      return;
    }
    const token = /^Bearer ([^\s]+)$/.exec(
      request.header("authorization") ?? "",
    )?.[1];
    if (!token) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const guest = await guestVerifier(token);
      if (!guest) {
        response.status(403).json({ error: "Guest access denied" });
        return;
      }
      const body = request.body ?? {};
      const contact = parseBookingContact(body.contact);
      response.json(
        await createGuestHold(
          guest,
          body.requestKey,
          body.primaryName,
          body.items,
          runtime.pool,
          body.chargeDisclosures,
          contact,
          body.expectedTotalCentavos,
          body.hall,
        ),
      );
    } catch (error) {
      response.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Booking unavailable.",
      });
    }
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
      response.json(
        await guestReservations(guest, runtime?.pool, {
          limit:
            request.query.limit === undefined
              ? 20
              : Number(request.query.limit),
          offset:
            request.query.offset === undefined
              ? 0
              : Number(request.query.offset),
          reservationId:
            typeof request.query.reservationId === "string"
              ? request.query.reservationId
              : undefined,
        }),
      );
    } catch {
      response.status(503).json({
        error: "Reservation lookup is unavailable. Online booking is not open.",
      });
    }
  });
  app.get("/guest/reservations/:id", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const token = /^Bearer ([^\s]+)$/.exec(
      request.header("authorization") ?? "",
    )?.[1];
    if (!token) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const guest = await guestVerifier(token);
      if (!guest) {
        response.status(403).json({ error: "Guest access denied" });
        return;
      }
      const rows = await guestReservations(guest, runtime?.pool, {
        reservationId: String(request.params.id),
        limit: 1,
      });
      if (!rows.length) {
        response.status(404).json({ error: "Reservation not found." });
        return;
      }
      response.json(rows[0]);
    } catch (error) {
      response.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Reservation detail unavailable.",
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
          runtime?.pool,
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
      response.json(await staffCatalog(runtime?.pool));
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
            runtime?.pool,
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
            runtime?.pool,
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
      response.json(await staffRooms(runtime?.pool, runtime?.writesEnabled));
    } catch {
      response.status(503).json({ error: "Room catalog unavailable" });
    }
  });
  app.get("/staff/notifications", catalogStaff, async (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (!runtime?.writesEnabled) {
      response
        .status(503)
        .json({ error: "Notification delivery is not enabled." });
      return;
    }
    try {
      const states = await runtime.pool.query(
        "select state,count(*)::int as count from staytrack.notification_outbox group by state",
      );
      response.json({
        deliveryConfigured: !!configuredMailAdapter(),
        states: states.rows,
      });
    } catch {
      response.status(503).json({ error: "Notification status unavailable." });
    }
  });
  app.get("/staff/settings", catalogStaff, async (_request, response) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json(await getSettings(runtime?.pool));
    } catch {
      response.status(503).json({ error: "Settings unavailable" });
    }
  });
  app.put("/staff/settings", catalogStaff, async (request, response) => {
    try {
      if (
        !(await saveSettings(
          response.locals.actorId as string,
          request.body,
          runtime?.pool,
        ))
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
  registerGuestHall(
    app,
    guestVerifier,
    runtime?.pool,
    runtime?.writesEnabled === true,
  );
  registerReservationWorkspace(
    app,
    catalogStaff,
    runtime?.pool,
    runtime?.writesEnabled,
  );
  registerWalkInRoutes(app, catalogStaff, walkInOptions);
  registerCheckIn(app, catalogStaff, runtime?.writesEnabled, runtime?.pool);
  registerStayMonitoring(
    app,
    catalogStaff,
    runtime?.writesEnabled,
    runtime?.pool,
  );
  registerHousekeeping(
    app,
    catalogStaff,
    runtime?.writesEnabled,
    runtime?.pool,
  );
  registerMaintenance(app, catalogStaff, runtime?.writesEnabled, runtime?.pool);
  registerAudit(app, catalogStaff, runtime?.pool);
  registerAnalytics(app, catalogStaff, runtime?.pool);
  registerReviews(
    app,
    catalogStaff,
    guestVerifier,
    runtime?.reviewDelivery
      ? { pool: runtime.pool, delivery: runtime.reviewDelivery }
      : undefined,
  );
  registerHall(
    app,
    catalogStaff,
    runtime?.writesEnabled ? runtime.pool : undefined,
  );
  registerCancellations(
    app,
    catalogStaff,
    guestVerifier,
    runtime?.writesEnabled,
    runtime?.pool,
  );
  registerRefundIssues(
    app,
    catalogStaff,
    guestVerifier,
    runtime?.writesEnabled,
    runtime?.pool,
  );
  registerReschedules(
    app,
    catalogStaff,
    guestVerifier,
    runtime?.writesEnabled,
    runtime?.pool,
  );
  registerStayChanges(app, catalogStaff, runtime?.writesEnabled, runtime?.pool);
  return app;
}

export const app = createApp();
