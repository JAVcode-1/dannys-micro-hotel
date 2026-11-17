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
after(async () => {
  await closeDatabase();
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  if (originalCertificatePath === undefined)
    delete process.env.DATABASE_CA_CERT_PATH;
  else process.env.DATABASE_CA_CERT_PATH = originalCertificatePath;
});

test("remote database options cannot override TLS or host", () => {
  for (const query of ["?sslmode=no-verify", "?host=other.example"]) {
    process.env.DATABASE_URL = `postgresql://user:pass@db.example:5432/postgres${query}`;
    assert.throws(() => databasePool(), /query parameters/);
  }
});

test("remote database pool uses verified TLS and bounded connections", async () => {
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
