import express from "express";
import type { GuestIdentity } from "./guest-auth.js";
import { BookingError } from "./booking-quote.js";
import type { databasePool } from "./database.js";
import {
  configurePaymentQr,
  guestPaymentSession,
  paymentQr,
  submitPaymentProof,
} from "./payment-proofs.js";
import type { PaymentMediaStore } from "./payment-media.js";
import {
  decidePaymentReview,
  staffPaymentReviews,
  staffProofUrl,
} from "./payment-review.js";

export type PaymentRouteOptions = {
  pool?: ReturnType<typeof databasePool>;
  store?: PaymentMediaStore;
  guestEnabled?: boolean;
  confirmationEnabled?: boolean;
};
export function registerPaymentRoutes(
  app: express.Express,
  staff: express.RequestHandler,
  verifyGuest: (token: string) => Promise<GuestIdentity | null>,
  options: PaymentRouteOptions,
) {
  function failure(response: express.Response, error: unknown) {
    response.status(error instanceof BookingError ? error.status : 503).json({
      error:
        error instanceof BookingError
          ? error.message
          : "Payment service unavailable.",
    });
  }
  app.get("/staff/payment-reviews", staff, async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      const page =
        request.query.page === undefined ? 0 : Number(request.query.page);
      const reviews = await staffPaymentReviews(options.pool, page);
      response.json({
        reviews: reviews.slice(0, 100),
        hasMore: reviews.length > 100,
        confirmationEnabled: options.confirmationEnabled === true,
      });
    } catch (error) {
      failure(response, error);
    }
  });
  app.get(
    "/staff/payment-reviews/:id/proof",
    staff,
    async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      try {
        response.json(
          await staffProofUrl(
            response.locals.actorId as string,
            String(request.params.id),
            options.pool,
            options.store,
          ),
        );
      } catch (error) {
        failure(response, error);
      }
    },
  );
  app.post(
    "/staff/payment-reviews/:id/decision",
    staff,
    async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      // No environment toggle: only isolated test construction opens confirmation.
      if (
        request.body?.decision === "confirmed" &&
        !options.confirmationEnabled
      ) {
        response.status(503).json({
          error:
            "Live payment confirmation is closed pending hosted acceptance and security checks.",
        });
        return;
      }
      try {
        response.json(
          await decidePaymentReview(
            response.locals.actorId as string,
            String(request.params.id),
            request.body,
            options.pool,
          ),
        );
      } catch (error) {
        failure(response, error);
      }
    },
  );
  async function guest(
    request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) {
    response.setHeader("Cache-Control", "no-store");
    const token = /^Bearer ([^\s]+)$/.exec(
      request.header("authorization") ?? "",
    )?.[1];
    if (!token) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const identity = await verifyGuest(token);
      if (!identity) {
        response.status(403).json({ error: "Guest access denied" });
        return;
      }
      // No environment toggle: production registration keeps real guest payments closed.
      if (!options.guestEnabled) {
        response.status(503).json({
          error: "Online payments are not open. Do not send payment.",
        });
        return;
      }
      response.locals.guest = identity;
      next();
    } catch (error) {
      failure(response, error);
    }
  }
  const image = express.raw({
    type: ["image/png", "image/jpeg"],
    limit: "5mb",
  });
  function decoded(value: string | undefined) {
    try {
      return decodeURIComponent(value ?? "");
    } catch {
      throw new BookingError("Invalid upload metadata.");
    }
  }
  app.get("/staff/payment-qr", staff, async (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      response.json(await paymentQr(options.pool, options.store));
    } catch (error) {
      failure(response, error);
    }
  });
  app.post("/staff/payment-qr", staff, image, async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      response.json(
        await configurePaymentQr(
          response.locals.actorId as string,
          decoded(request.header("x-gcash-payee")),
          request.body as Buffer,
          request.header("content-type") ?? "",
          options.pool,
          options.store,
        ),
      );
    } catch (error) {
      failure(response, error);
    }
  });
  app.get(
    "/guest/payments/:reservationId",
    guest,
    async (request, response) => {
      try {
        response.json(
          await guestPaymentSession(
            response.locals.guest as GuestIdentity,
            String(request.params.reservationId),
            options.pool,
            options.store,
          ),
        );
      } catch (error) {
        failure(response, error);
      }
    },
  );
  app.post(
    "/guest/payments/:reservationId/proof",
    guest,
    image,
    async (request, response) => {
      try {
        response.json(
          await submitPaymentProof(
            response.locals.guest as GuestIdentity,
            String(request.params.reservationId),
            decoded(request.header("x-transaction-reference")),
            request.body as Buffer,
            request.header("content-type") ?? "",
            options.pool,
            options.store,
          ),
        );
      } catch (error) {
        failure(response, error);
      }
    },
  );
}
