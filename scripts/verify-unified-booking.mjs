// Targeted local regression runner. Never reads .env or connects to hosted services.
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import assert from "node:assert/strict";
import console from "node:console";
import { Pool } from "pg";
import { generateIsolatedTypes } from "./generate-isolated-types.mjs";

process.env.NODE_ENV = "test";
for (const key of Object.keys(process.env))
  if (key === "DATABASE_URL" || key.startsWith("SUPABASE_"))
    process.env[key] = "";

const modulePath =
  process.env.EMBEDDED_POSTGRES_MODULE ||
  ".quality/x02/postgres-tools/node_modules/embedded-postgres/dist/index.js";
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(resolve(modulePath)).href
);
mkdirSync(".quality/unified-booking", { recursive: true });
const password = randomBytes(24).toString("hex");
const port = 55442;
const postgres = new EmbeddedPostgres({
  databaseDir: resolve(".quality/unified-booking/data-" + Date.now()),
  user: "staytrack_test",
  password,
  port,
  persistent: true,
  createPostgresUser: false,
  autoRehydrateSymlinks: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let pool;
try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("staytrack_test");
  pool = new Pool({
    host: "127.0.0.1",
    port,
    user: "staytrack_test",
    password,
    database: "staytrack_test",
    ssl: false,
    max: 10,
  });
  await pool.query(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id));
    alter table storage.objects enable row level security;`);
  const migrations = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations)
    await pool.query(
      readFileSync(resolve("supabase/migrations", name), "utf8"),
    );
  console.log(
    `Applied ${migrations.length} candidate migrations to disposable loopback PostgreSQL only.`,
  );
  const { unifiedBookingPostgres } =
    await import("../backend/test/unified-booking-postgres.mjs");
  await unifiedBookingPostgres(pool);
  const { createIsolatedApp } =
    await import("../backend/dist/isolated-composition.js");
  const actor = "33333333-3333-4333-8333-333333333333";
  const guest = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "synthetic@example.test",
  };
  const staffToken = randomBytes(24).toString("hex"),
    guestToken = randomBytes(24).toString("hex");
  const app = createIsolatedApp({
    pool,
    verifyStaff: async (token) =>
      token === staffToken ? { id: actor, email: "staff@example.test" } : null,
    verifyGuest: async (token) => (token === guestToken ? guest : null),
    media: {
      upload: async () => {},
      remove: async () => {},
      signedUrl: async () => "data:image/png;base64,",
    },
    delivery: {
      invitation: async () => {},
      generateOtp: async () => "123456",
      sendOtp: async () => {},
      verifyOtp: async () => null,
    },
  });
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [path, token] of [
      ["/ready", null],
      ["/staff/reservations", staffToken],
      ["/guest/reservations", guestToken],
      ["/staff/hall/reservations", staffToken],
    ]) {
      const response = await globalThis.fetch(base + path, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      assert.equal(response.status, 200, `${path}: ${await response.text()}`);
    }
    const hall = (
      await pool.query(
        "select hall_reservation_id from staytrack.online_payment_allocations where hall_reservation_id is not null order by reservation_id limit 1",
      )
    ).rows[0];
    const response = await globalThis.fetch(
      `${base}/staff/hall/reservations/${hall.hall_reservation_id}/finances`,
      { headers: { Authorization: `Bearer ${staffToken}` } },
    );
    const finances = await response.json();
    assert.equal(response.status, 200, JSON.stringify(finances));
    assert.equal(
      finances.receipts.filter(
        (p) => p.evidence === "Shared online payment allocation",
      ).length,
      1,
    );
    assert.equal(
      (await globalThis.fetch(`${base}/staff/hall/reservations`)).status,
      401,
    );
    console.log(
      "Verified isolated HTTP readiness, guest/staff history, private Hall allocation statement and unauthorized denial.",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  writeFileSync(
    ".quality/unified-booking/database.types.ts",
    await generateIsolatedTypes(pool),
  );
  console.log(
    "Unified booking targeted PostgreSQL checks passed. Local schema types generated in .quality/unified-booking/.",
  );
} finally {
  if (pool) await pool.end();
  await postgres.stop();
}
