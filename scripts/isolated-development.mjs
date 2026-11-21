// Explicit disposable composition. Does not read backend/.env or access hosted services.
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { Pool } from "pg";
import process from "node:process";

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
    SUPABASE_URL: "",
    SUPABASE_SECRET_KEY: "",
    SUPABASE_PUBLISHABLE_KEY: "",
    TEST_DATABASE_URL: `postgresql://staytrack_test:${password}@127.0.0.1:${port}/staytrack_test`,
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_PUBLISHABLE_KEY: "",
    VITE_ISOLATED_DEVELOPMENT: "true",
    VITE_API_URL: "/api",
  };
  children.push(
    spawn(process.execPath, ["backend/dist/isolated-server.js"], {
      env,
      stdio: "inherit",
      windowsHide: true,
    }),
  );
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
  // Run Vite from the workspace node_modules, never a remote download.
  children[1].on("error", () => void stop());
  console.log(
    "Disposable database and synthetic fixture identities only. Open http://127.0.0.1:5173. Rooms require explicit inspection before Ready.",
  );
  for (const child of children) {
    child.on("error", () => void stop());
    child.on("exit", () => void stop());
  }
} catch (error) {
  await stop();
  throw error;
}
