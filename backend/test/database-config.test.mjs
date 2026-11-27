import assert from "node:assert/strict";
import process from "node:process";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  closeDatabase,
  databasePool,
  probeDatabase,
} from "../dist/database.js";

const original = process.env.DATABASE_URL;
const originalCertificatePath = process.env.DATABASE_CA_CERT_PATH;
const originalMode = process.env.NODE_ENV;
after(async () => {
  await closeDatabase();
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  if (originalCertificatePath === undefined)
    delete process.env.DATABASE_CA_CERT_PATH;
  else process.env.DATABASE_CA_CERT_PATH = originalCertificatePath;
  if (originalMode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalMode;
});

test("remote database options cannot override TLS or host", () => {
  for (const query of ["?sslmode=no-verify", "?host=other.example"]) {
    process.env.DATABASE_URL = `postgresql://user:pass@db.example:5432/postgres${query}`;
    assert.throws(() => databasePool(), /query parameters/);
  }
});

test("remote database pool uses verified TLS and bounded connections", async () => {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL =
    "postgresql://user:pass@db.example:5432/postgres?sslmode=require";
  delete process.env.DATABASE_CA_CERT_PATH;
  assert.throws(() => databasePool(), /DATABASE_CA_CERT_PATH is required/);
  process.env.DATABASE_CA_CERT_PATH = fileURLToPath(import.meta.url);
  const pool = databasePool();
  assert.equal(pool.options.ssl.rejectUnauthorized, true);
  assert.equal(pool.options.ssl.servername, "db.example");
  assert.match(pool.options.ssl.ca, /remote database pool uses verified TLS/);
  assert.equal(pool.options.max, 5);
  assert.equal(pool.options.connectionTimeoutMillis, 5000);
  await closeDatabase();
});

test("remote development allows slow pooler connections without extending query timeouts", async () => {
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = "postgresql://user:pass@db.example:5432/postgres";
  process.env.DATABASE_CA_CERT_PATH = fileURLToPath(import.meta.url);
  try {
    const pool = databasePool();
    assert.equal(pool.options.connectionTimeoutMillis, 30000);
    assert.equal(pool.options.query_timeout, 10000);
    assert.equal(pool.options.statement_timeout, 10000);
    await closeDatabase();

    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/postgres";
    assert.equal(databasePool().options.connectionTimeoutMillis, 5000);
  } finally {
    await closeDatabase();
  }
});

test("direct IPv6 host is passed to pg without URL brackets", async () => {
  process.env.DATABASE_URL =
    "postgresql://user:pass@[2001:db8::1]:5432/postgres";
  process.env.DATABASE_CA_CERT_PATH = fileURLToPath(import.meta.url);
  const pool = databasePool();
  assert.equal(pool.options.host, "2001:db8::1");
  assert.equal(pool.options.ssl.servername, "2001:db8::1");
  await closeDatabase();
});

test("database probe rejects an absent foundation schema", async () => {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/postgres";
  const pool = databasePool();
  const query = pool.query;
  pool.query = async () => ({ rows: [{ foundation_migrated: false }] });
  try {
    await assert.rejects(probeDatabase(), /F02 database schema is not ready/);
  } finally {
    pool.query = query;
    await closeDatabase();
  }
});
