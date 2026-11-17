import { readFileSync } from "node:fs";
import { Pool } from "pg";

let pool: Pool | undefined;

export function databasePool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.pathname ||
    url.pathname === "/"
  ) {
    throw new Error("DATABASE_URL must identify a PostgreSQL database");
  }
  const parameters = Array.from(url.searchParams.entries());
  if (
    url.hash ||
    parameters.some(
      ([key, value]) => key !== "sslmode" || value !== "require",
    ) ||
    parameters.length > 1
  ) {
    throw new Error(
      "DATABASE_URL query parameters and fragments are not supported",
    );
  }
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    url.hostname,
  );
  const certificatePath = process.env.DATABASE_CA_CERT_PATH;
  if (!local && !certificatePath) {
    throw new Error("DATABASE_CA_CERT_PATH is required for remote PostgreSQL");
  }
  let ca: string | undefined;
  if (certificatePath) {
    try {
      ca = readFileSync(certificatePath, "utf8");
    } catch {
      throw new Error(
        "DATABASE_CA_CERT_PATH must point to a readable CA certificate",
      );
    }
  }
  pool = new Pool({
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: local
      ? false
      : {
          ca,
          rejectUnauthorized: true,
          servername: url.hostname.replace(/^\[|\]$/g, ""),
        },
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 10000,
  });
  pool.on("error", () => {
    /* Idle client errors are handled by the pool. */
  });
  return pool;
}

export async function probeDatabase(): Promise<void> {
  const client = databasePool();
  const result = await client.query<{
    foundation_migrated: boolean;
  }>(
    "SELECT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261117000100') AND to_regclass('staytrack.room_categories') IS NOT NULL AND to_regclass('staytrack.rooms') IS NOT NULL AND to_regclass('staytrack.packages') IS NOT NULL AS foundation_migrated",
  );
  if (!result.rows[0]?.foundation_migrated) {
    throw new Error("The expected F02 database schema is not ready");
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}
