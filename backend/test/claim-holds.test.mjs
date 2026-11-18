import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expireClaims,
  submitClaimProof,
  reviewAge,
} from "../dist/claim-holds.js";

test("cleanup uses a fake clock and is safe to repeat", async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rowCount: calls.length === 1 ? 1 : 0 };
    },
  };
  const now = Date.UTC(2026, 10, 18, 12);
  assert.equal(await expireClaims(now, pool), 1);
  assert.equal(await expireClaims(now, pool), 0);
  assert.deepEqual(
    calls.map((call) => call.values),
    [[new Date(now)], [new Date(now)]],
  );
  assert.match(calls[0].sql, /state = 'held'/);
});

test("proof transition reports late submissions for reconciliation", async () => {
  const now = Date.UTC(2026, 10, 18, 12);
  let queryCount = 0;
  const client = {
    async query(sql) {
      if (sql.includes("select state, proof_deadline_at"))
        return {
          rowCount: 1,
          rows: [
            {
              state: "held",
              proof_deadline_at: new Date(now - 1),
              proof_submitted_at: null,
            },
          ],
        };
      if (sql.startsWith("update")) throw new Error("late proof changed claim");
      queryCount++;
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  assert.equal(
    await submitClaimProof(1, now, { connect: async () => client }),
    "late_reconciliation",
  );
  assert.ok(queryCount > 0);
});

test("on-time proof protects the claim and repeat submission is idempotent", async () => {
  const now = Date.UTC(2026, 10, 18, 12);
  let state = "held";
  const client = {
    async query(sql) {
      if (sql.includes("select state, proof_deadline_at"))
        return {
          rowCount: 1,
          rows: [
            {
              state,
              proof_deadline_at: new Date(now),
              proof_submitted_at: state === "held" ? null : new Date(now),
            },
          ],
        };
      if (sql.startsWith("update")) state = "proof_pending_review";
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client };
  assert.equal(await submitClaimProof(1, now, pool), "protected");
  assert.equal(await submitClaimProof(1, now, pool), "replayed");
});

test("review flags start at proof submission", () => {
  const proof = Date.UTC(2026, 10, 18, 12);
  assert.equal(reviewAge(proof, proof + 14 * 60000), "on_time");
  assert.equal(reviewAge(proof, proof + 15 * 60000), "overdue");
  assert.equal(reviewAge(proof, proof + 30 * 60000), "urgent");
  assert.equal(reviewAge(proof, proof + 60 * 60000), "critical");
});
