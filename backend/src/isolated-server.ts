// Explicit fixture server. Normal server.ts never imports this module or enables these routes.
import { Pool } from "pg";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createIsolatedApp } from "./isolated-composition.js";
import { assertIsolatedTarget } from "./runtime-config.js";
import { verifyGuest } from "./guest-auth.js";
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
const adminFile = new URL("../../.quality/isolated-development/admin-account.json", import.meta.url);
const admin = existsSync(adminFile)
  ? JSON.parse(readFileSync(adminFile, "utf8")) as {
      id: string; username: string; email: string; salt: string; passwordHash: string;
    }
  : null;
if (admin && (
  !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(admin.id) ||
  !/^[a-z0-9_-]{1,40}$/.test(admin.username) ||
  !/^[a-z0-9_-]+@example\.test$/.test(admin.email) ||
  !/^[0-9a-f]{64}$/.test(admin.salt) ||
  !/^[0-9a-f]{128}$/.test(admin.passwordHash)
)) throw new Error("Invalid local admin account configuration.");
// JWT-shaped fixture identifiers support subject-scoped UI retry storage. These are
// never signature-verified: this isolated server accepts only its exact random tokens.
const fixtureToken = (id: string) =>
  Buffer.from(JSON.stringify({ alg: "fixture" })).toString("base64url") +
  "." +
  Buffer.from(
    JSON.stringify({ sub: id, nonce: randomBytes(32).toString("hex") }),
  ).toString("base64url") +
  ".fixture";
const staffToken = fixtureToken(staff.id);
const adminToken = admin ? fixtureToken(admin.id) : null;
const staffSessions = new Map([[staffToken, staff]]);
if (admin && adminToken) staffSessions.set(adminToken, { id: admin.id, email: admin.email });
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
if (admin) {
  await pool.query("insert into auth.users(id) values($1) on conflict do nothing", [admin.id]);
  await pool.query(
    "insert into staytrack.staff_accounts(auth_user_id,active) values($1,true) on conflict(auth_user_id) do nothing",
    [admin.id],
  );
}
const objects = new Map<string, { bytes: Buffer; mime: string }>();
const mail = new FakeMailAdapter();
const delivery = outboxReviewDelivery(pool, {
  generateOtp: async () => "123456",
  verifyOtp: async (email, code) =>
    email === guest.email && code === "123456" ? guest : null,
});
const app = createIsolatedApp({
  pool,
  verifyStaff: async (token) => {
    const identity = staffSessions.get(token);
    if (!identity) return null;
    const active = await pool.query(
      "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active", [identity.id],
    );
    return active.rowCount === 1 ? identity : null;
  },
  verifyGuest,
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
  if (!isStaff) {
    res.status(401).json({ error: "Verify your email through Supabase Auth." });
    return;
  }
  const token = req.header("authorization")?.replace(/^Bearer /, "") ?? "";
  const identity = staffSessions.get(token);
  if (!identity) {
    res.status(401).json({ error: "Staff sign-in is required." });
    return;
  }
  res.json({
    access_token: token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: identity,
  });
});
let loginWindow = { started: Date.now(), attempts: 0 };
app.post("/development/login", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (Date.now() - loginWindow.started >= 60000)
    loginWindow = { started: Date.now(), attempts: 0 };
  if (++loginWindow.attempts > 10) {
    res.status(429).json({ error: "Too many sign-in attempts. Try again in a minute." });
    return;
  }
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = req.body?.password;
  let token: string | null = null;
  if (typeof password === "string" && password.length <= 256) {
    if (admin && (username === admin.username || username === admin.email)) {
      const hash = scryptSync(password, Buffer.from(admin.salt, "hex"), 64);
      if (timingSafeEqual(hash, Buffer.from(admin.passwordHash, "hex"))) token = adminToken;
    } else if (username === staff.email && password === "development-only") token = staffToken;
  }
  if (!token) {
    res.status(401).json({ error: "Invalid local staff credentials." });
    return;
  }
  res.json({
    access_token: token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: staffSessions.get(token),
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
    `Local StayTrack development API on loopback port ${port}; real Supabase guest Auth; staff@example.test password development-only. Booking data remains local.`,
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
