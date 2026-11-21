// Explicit fixture server. Normal server.ts never imports this module or enables these routes.
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { createIsolatedApp } from "./isolated-composition.js";
import { assertIsolatedTarget } from "./runtime-config.js";
import {
  FakeMailAdapter,
  runScheduledJobs,
  outboxReviewDelivery,
} from "./notifications.js";

const raw = process.env.TEST_DATABASE_URL;
if (!raw)
  throw new Error(
    "TEST_DATABASE_URL is required; hosted databases are prohibited.",
  );
const url = new URL(raw);
if (
  url.search ||
  url.hash ||
  !["postgres:", "postgresql:"].includes(url.protocol)
)
  throw new Error("Use a plain isolated PostgreSQL URL.");
const options = {
  host: url.hostname.replace(/^\[|\]$/g, ""),
  port: Number(url.port || 5432),
  database: decodeURIComponent(url.pathname.slice(1)),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: false as const,
  max: 5,
};
assertIsolatedTarget(options);
const pool = new Pool(options);
const guest = {
  id: "a1111111-1111-4111-8111-111111111111",
  email: "guest@example.test",
};
const staff = {
  id: "a3333333-3333-4333-8333-333333333333",
  email: "staff@example.test",
};
// JWT-shaped fixture identifiers support subject-scoped UI retry storage. These are
// never signature-verified: this isolated server accepts only its exact random tokens.
const fixtureToken = (id: string) =>
  Buffer.from(JSON.stringify({ alg: "fixture" })).toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({ sub: id, nonce: randomBytes(32).toString("hex") }),
  ).toString("base64url") +
  ".fixture";
const guestToken = fixtureToken(guest.id),
  staffToken = fixtureToken(staff.id);
await pool.query(
  "select 'staytrack.notification_outbox'::regclass,'staytrack.reservation_booking_contacts'::regclass",
);
await pool.query(
  "insert into auth.users(id) values($1),($2) on conflict do nothing",
  [guest.id, staff.id],
);
await pool.query(
  "insert into staytrack.staff_accounts(auth_user_id,active) values($1,true) on conflict(auth_user_id) do nothing",
  [staff.id],
);
const objects = new Map<string, { bytes: Buffer; mime: string }>();
const mail = new FakeMailAdapter();
const delivery = outboxReviewDelivery(pool, {
  generateOtp: async () => "123456",
  verifyOtp: async (email, code) =>
    email === guest.email && code === "123456" ? guest : null,
});
const app = createIsolatedApp({
  pool,
  verifyStaff: async (token) => (token === staffToken ? staff : null),
  verifyGuest: async (token) => (token === guestToken ? guest : null),
  media: {
    upload: async (bucket, key, bytes, mime) => {
      objects.set(bucket + "/" + key, { bytes, mime });
    },
    remove: async (bucket, key) => {
      objects.delete(bucket + "/" + key);
    },
    signedUrl: async (bucket, key) => {
      const object = objects.get(bucket + "/" + key);
      if (!object)
        throw new Error("Fixture image missing; upload a synthetic QR/proof.");
      return `data:${object.mime};base64,${object.bytes.toString("base64")}`;
    },
  },
  delivery,
});
app.get("/development/session", (req, res) => {
  res.set("Cache-Control", "no-store");
  const isStaff = req.query.kind === "staff";
  res.json({
    access_token: isStaff ? staffToken : guestToken,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: isStaff ? staff : guest,
  });
});
app.get("/development/mailbox", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    notice: "Synthetic local delivery only",
    messages: mail.messages,
  });
});
app.post("/development/jobs", async (_req, res) => {
  try {
    res.json(await runScheduledJobs(pool, mail, delivery));
  } catch {
    res.status(503).json({ error: "Local jobs unavailable." });
  }
});
const port = Number(process.env.ISOLATED_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid isolated port.");
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `Synthetic StayTrack development API on loopback port ${port}; guest@example.test OTP 123456; staff@example.test password development-only. No hosted services.`,
  ),
);
const timer = setInterval(
  () => void runScheduledJobs(pool, mail, delivery).catch(() => {}),
  30000,
);
async function stop() {
  clearInterval(timer);
  server.close();
  await pool.end();
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
