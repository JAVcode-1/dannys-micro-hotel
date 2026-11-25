import { readdirSync } from "node:fs";
import { createApp } from "./app.js";
import { databasePool, probeWorkflowSchema } from "./database.js";
import { verifyGuest } from "./guest-auth.js";
import { auditStaffAccess, verifyStaff } from "./staff-auth.js";
import { paymentMediaStore } from "./payment-media.js";
import { assertDevelopmentProject } from "./runtime-config.js";

// Explicit real-provider composition for local design/development, never production.
export async function createHostedDevelopmentApp() {
  if (process.env.NODE_ENV !== "development")
    throw new Error(
      "Hosted development is available only in development mode.",
    );
  assertDevelopmentProject();
  const pool = databasePool();
  const applied = await pool.query<{ version: string }>(
    "select version from supabase_migrations.schema_migrations",
  );
  const versions = new Set(applied.rows.map((row) => row.version));
  const missing = readdirSync(
    new URL("../../supabase/migrations/", import.meta.url),
  ).filter(
    (name) => name.endsWith(".sql") && !versions.has(name.split("_")[0]),
  );
  if (missing.length)
    throw new Error(
      `Hosted booking requires separately approved migrations: ${missing.join(", ")}. Startup never applies migrations automatically.`,
    );
  await probeWorkflowSchema(pool);
  const media = paymentMediaStore();
  // Check bucket privacy without uploading anything or issuing public URLs.
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret)
    throw new Error("Supabase private storage is not configured.");
  const storage = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
  for (const bucket of ["payment-proofs", "payment-qr"]) {
    const { data, error } = await storage.getBucket(bucket);
    if (error || !data || data.public)
      throw new Error(
        `A private ${bucket} bucket is required for hosted booking.`,
      );
  }
  return createApp(
    () => probeWorkflowSchema(pool),
    verifyStaff,
    auditStaffAccess,
    verifyGuest,
    { pool, store: media, guestEnabled: true, confirmationEnabled: true },
    { pool, writesEnabled: true },
    { pool, writesEnabled: true, hostedDevelopment: true },
  );
}
