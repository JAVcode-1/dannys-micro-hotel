/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";
import {
  normalizePaymentReference,
  parsePaymentDecision,
  decidePaymentReview,
  staffProofUrl,
  staffPaymentReviews,
} from "../dist/payment-review.js";

test("O03 staff review denies guests and revoked staff; live confirmation is closed", async () => {
  let active = true;
  const app = createApp(
    async () => {},
    async (token) =>
      token === "staff" && active
        ? { id: "11111111-1111-4111-8111-111111111111", email: null }
        : null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/staff/payment-reviews`;
    for (const path of [
      "",
      "/11111111-1111-4111-8111-111111111111/proof",
      "/11111111-1111-4111-8111-111111111111/decision",
    ]) {
      const method = path.endsWith("decision") ? "POST" : "GET";
      assert.equal((await fetch(base + path, { method })).status, 401);
      assert.equal(
        (
          await fetch(base + path, {
            method,
            headers: { Authorization: "Bearer guest" },
          })
        ).status,
        403,
      );
    }
    const decision = `${base}/11111111-1111-4111-8111-111111111111/decision`;
    assert.equal(
      (
        await fetch(decision, {
          method: "POST",
          headers: {
            Authorization: "Bearer staff",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision: "confirmed" }),
        })
      ).status,
      503,
    );
    active = false;
    assert.equal(
      (await fetch(base, { headers: { Authorization: "Bearer staff" } }))
        .status,
      403,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

const review = {
  decision: "confirmed",
  expectedVersion: 0,
  requestKey: "review-request-000001",
  note: "Checked the actual receiving ledger.",
  verification: {
    ledgerChecked: true,
    receivingAccountChecked: true,
    timeChecked: true,
    reference: " ab-123 456 ",
    recipient: "TEST PAYEE",
    amountCentavos: 270000,
    receivedAt: "2026-11-19T01:00:00+08:00",
  },
};
test("O03 references normalize separators/case and reject empty, control or ambiguous characters", () => {
  assert.equal(normalizePaymentReference(" ab-123 456 "), "AB123456");
  for (const value of [
    "",
    "---",
    "abc\n123",
    "ABC/123",
    "ＡＢＣ１２３",
    "A".repeat(101),
    null,
  ])
    assert.throws(() => normalizePaymentReference(value));
});
test("O03 screenshot alone, missing checks, unsafe money and invalid time cannot authorize confirmation", () => {
  const parsed = parsePaymentDecision(review);
  assert.equal(parsed.verification.reference, "AB123456");
  assert.equal(parsed.verification.receivedAt, "2026-11-18T17:00:00.000Z");
  for (const patch of [
    { ledgerChecked: false },
    { receivingAccountChecked: false },
    { timeChecked: false },
    { amountCentavos: 2700.5 },
    { amountCentavos: -1 },
    { receivedAt: "2026-11-19T01:00:00" },
    { recipient: "" },
  ])
    assert.throws(() =>
      parsePaymentDecision({
        ...review,
        verification: { ...review.verification, ...patch },
      }),
    );
  for (const patch of [
    { verification: null },
    { expectedVersion: -1 },
    { expectedVersion: 0.1 },
    { decision: "approve-screenshot" },
    { note: "" },
    { requestKey: "short" },
  ])
    assert.throws(() => parsePaymentDecision({ ...review, ...patch }));
});
test("O03 internal decisions recheck active staff and rollback before any payment write", async () => {
  const sql = [];
  const client = {
    query: async (statement) => {
      sql.push(statement);
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  await assert.rejects(
    decidePaymentReview(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      review,
      { connect: async () => client },
    ),
    /Staff access denied/,
  );
  assert.equal(sql.at(-1), "rollback");
  assert.ok(!sql.some((statement) => statement.startsWith("insert")));
});
test("O03 authorized proof access audits before issuing only a short-lived private proof link", async () => {
  const calls = [];
  const pool = {
    query: async (sql, args) => {
      calls.push({ sql, args });
      return {
        rows: sql.startsWith("select")
          ? [{ object_key: "private-fixture.png" }]
          : [],
      };
    },
  };
  const store = {
    signedUrl: async (bucket, key) => {
      assert.equal(calls.length, 2);
      assert.equal(bucket, "payment-proofs");
      assert.equal(key, "private-fixture.png");
      return "https://example.test/private-signed";
    },
  };
  assert.deepEqual(
    await staffProofUrl(
      "actor",
      "22222222-2222-4222-8222-222222222222",
      pool,
      store,
    ),
    { url: "https://example.test/private-signed", expiresIn: 120 },
  );
  assert.ok(calls[1].sql.includes("payment.proof_viewed"));
  await assert.rejects(
    staffProofUrl("actor", "not-a-uuid", pool, store),
    /not found/,
  );
});
test("O03 queue aging derives from the database clock at 15/30/60 minutes", async () => {
  const rows = [14, 15, 30, 60].map((minutes) => ({
    id: String(minutes),
    submittedAt: new Date(0),
    serverNow: new Date(minutes * 60000),
  }));
  const reviews = await staffPaymentReviews({ query: async () => ({ rows }) });
  assert.deepEqual(
    reviews.map((row) => row.age),
    ["on_time", "overdue", "urgent", "critical"],
  );
  assert.ok(reviews.every((row) => !("serverNow" in row)));
});

test("O03 queue pages beyond the first hundred records and rejects invalid pages", async () => {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    },
  };
  await staffPaymentReviews(pool, 2);
  assert.deepEqual(queries[0].params, [200]);
  for (const page of [-1, 0.5, NaN, 1000001])
    await assert.rejects(staffPaymentReviews(pool, page), /page/i);
});
