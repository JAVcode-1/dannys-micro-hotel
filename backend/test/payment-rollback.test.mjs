import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  configurePaymentQr,
  submitPaymentProof,
} from "../dist/payment-proofs.js";

test("an uncertain QR commit retains the private image rather than deleting possibly committed media", async () => {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
    "base64",
  );
  const objects = new Map();
  const client = {
    async query(sql) {
      if (sql === "commit")
        throw Object.assign(new Error("connection lost during commit"), {
          code: "ECONNRESET",
        });
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: async () => ({ rows: [{ used: false }] }),
  };
  const store = {
    upload: async (_bucket, key, data) => {
      objects.set(key, data);
    },
    remove: async (_bucket, key) => {
      objects.delete(key);
    },
  };
  await assert.rejects(
    configurePaymentQr(
      "33333333-3333-4333-8333-333333333333",
      "TEST PAYEE",
      bytes,
      "image/png",
      pool,
      store,
    ),
    /connection lost/,
  );
  assert.equal(objects.size, 1);
});

test("an uncertain proof commit retains the screenshot for safe reconciliation", async () => {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
    "base64",
  );
  const objects = new Map();
  const client = {
    async query(sql) {
      if (sql === "commit")
        throw Object.assign(new Error("uncertain proof commit"), {
          code: "ECONNRESET",
        });
      if (sql.includes("select total_centavos"))
        return { rows: [{ total_centavos: "20000" }], rowCount: 1 };
      if (sql.includes("select request_hash")) return { rows: [], rowCount: 0 };
      if (sql.includes("select i.id"))
        return {
          rows: [
            {
              id: "1",
              state: "held",
              proof_deadline_at: new Date(Date.now() + 60000),
            },
          ],
          rowCount: 1,
        };
      if (sql.includes("clock_timestamp"))
        return { rows: [{ now: new Date() }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: async (sql) =>
      sql.includes("select total_centavos")
        ? { rows: [{ total_centavos: "20000" }], rowCount: 1 }
        : { rows: [{ used: false }] },
  };
  const store = {
    upload: async (_bucket, key, data) => {
      objects.set(key, data);
    },
    remove: async (_bucket, key) => {
      objects.delete(key);
    },
  };
  await assert.rejects(
    submitPaymentProof(
      {
        id: "11111111-1111-4111-8111-111111111111",
        email: "owner@example.test",
      },
      "44444444-4444-4444-8444-444444444444",
      "TEST-REF",
      bytes,
      "image/png",
      pool,
      store,
    ),
    /uncertain proof commit/,
  );
  assert.equal(objects.size, 1);
});
