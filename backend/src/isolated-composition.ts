import type { Pool } from "pg";
import { assertIsolatedTarget } from "./runtime-config.js";
export { assertIsolatedTarget } from "./runtime-config.js";
import { createApp } from "./app.js";
import { probeWorkflowSchema } from "./database.js";
import type { GuestIdentity } from "./guest-auth.js";
import type { StaffIdentity } from "./staff-auth.js";
import type { ReviewDelivery } from "./review-access.js";
import type { PaymentMediaStore } from "./payment-media.js";
import { outboxReviewDelivery } from "./notifications.js";

export type RuntimeComposition = {
  pool: Pool;
  writesEnabled: boolean;
  reviewDelivery?: ReviewDelivery;
};

export function createIsolatedApp(deps: {
  pool: Pool;
  verifyStaff: (token: string) => Promise<StaffIdentity | null>;
  verifyGuest: (token: string) => Promise<GuestIdentity | null>;
  media: PaymentMediaStore;
  delivery: ReviewDelivery;
}) {
  assertIsolatedTarget(deps.pool.options);
  return createApp(
    async () => {
      await probeWorkflowSchema(deps.pool);
    },
    deps.verifyStaff,
    async () => {},
    deps.verifyGuest,
    {
      pool: deps.pool,
      store: deps.media,
      guestEnabled: true,
      confirmationEnabled: true,
    },
    { pool: deps.pool, writesEnabled: true },
    {
      pool: deps.pool,
      writesEnabled: true,
      reviewDelivery: outboxReviewDelivery(deps.pool, deps.delivery),
    },
  );
}
