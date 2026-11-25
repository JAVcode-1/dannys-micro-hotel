// Disposable booking database; guest identity is verified by Supabase Auth.
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { Pool } from "pg";
import process from "node:process";

if (process.env.NODE_ENV === "production")
  throw new Error("The isolated launcher cannot run in production mode.");

const authEnv = existsSync("backend/.env")
  ? parseEnv(readFileSync("backend/.env", "utf8"))
  : {};
const supabaseUrl = process.env.SUPABASE_URL || authEnv.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || authEnv.SUPABASE_PUBLISHABLE_KEY;
if (
  !supabaseUrl ||
  !supabaseKey ||
  /REPLACE_ME|YOUR_PROJECT_REF/.test(supabaseUrl + supabaseKey)
)
  throw new Error(
    "Guest email OTP requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env (or the environment). Use a development Supabase project.",
  );

const toolPath =
  process.env.EMBEDDED_POSTGRES_MODULE ||
  ".quality/x02/postgres-tools/node_modules/embedded-postgres/dist/index.js";
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(resolve(toolPath)).href
);
mkdirSync(".quality/isolated-development", { recursive: true });
const password = randomBytes(24).toString("hex");
const port = 55441;
const postgres = new EmbeddedPostgres({
  databaseDir: resolve(".quality/isolated-development/data-" + Date.now()),
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
const children = [];
let pool;
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  for (const child of children) child.kill();
  if (pool) await pool.end();
  await postgres.stop();
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
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
  });
  await pool.query(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id));alter table storage.objects enable row level security;`);
  for (const name of readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await pool.query(
      readFileSync(resolve("supabase/migrations", name), "utf8"),
    );
  await pool.query(`insert into staytrack.rooms(category_id,code,operational_state,active)
    select id,case code when 'double_standard' then 'SYNTHETIC-DS-' else 'SYNTHETIC-FE-' end||n,'unverified',true
    from staytrack.room_categories cross join lateral generate_series(1,case code when 'double_standard' then 10 else 5 end) n;
    update staytrack.operational_settings set cleaning_buffer_minutes=15,checkout_alert_minutes=30,cancellation_display_text='SYNTHETIC DEVELOPMENT POLICY: manual refunds only. Owner/legal acceptance pending.';`);
  await pool.end();
  pool = undefined;
  const env = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: "",
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SECRET_KEY: "",
    SUPABASE_PUBLISHABLE_KEY: supabaseKey,
    TEST_DATABASE_URL: `postgresql://staytrack_test:${password}@127.0.0.1:${port}/staytrack_test`,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
    VITE_ISOLATED_DEVELOPMENT: "true",
    VITE_API_URL: "/api",
    ISOLATED_PORT: "3001",
  };
  const backend = spawn(
    process.execPath,
    ["--import", "tsx", "--watch", "src/isolated-server.ts"],
    {
      cwd: resolve("backend"),
      env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  children.push(backend);
  await new Promise((started, failed) => {
    backend.once("spawn", started);
    backend.once("error", failed);
  });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (backend.exitCode !== null)
      throw new Error("The local development API exited during startup.");
    try {
      const status = await fetch("http://127.0.0.1:3001/guest/booking-status", {
        signal: AbortSignal.timeout(1000),
      });
      const capabilities = status.ok ? await status.json() : null;
      if (capabilities?.isolatedDevelopment === true) {
        const response = await fetch("http://127.0.0.1:3001/ready", {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      }
    } catch {
      // Wait for the source-based API to finish loading its local schema.
    }
    await new Promise((resume) => setTimeout(resume, 250));
  }
  if (!ready)
    throw new Error("The local development API did not become ready.");
  children.push(
    spawn(
      process.execPath,
      [
        resolve("node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
        "--port",
        "5173",
        "--strictPort",
      ],
      { cwd: resolve("frontend"), env, stdio: "inherit", windowsHide: true },
    ),
  );
  // Vite uses installed workspace tooling; it starts only after the API is ready.
  console.log(
    "Disposable booking database with real Supabase guest email OTP and local fixture staff access. Open http://127.0.0.1:5173. Rooms require explicit inspection before Ready.",
  );
  for (const child of children) {
    child.on("error", () => {
      process.exitCode = 1;
      void stop();
    });
    child.on("exit", (code) => {
      if (!stopped && code) process.exitCode = code;
      void stop();
    });
  }
} catch (error) {
  await stop();
  throw error;
}
