import assert from "node:assert/strict";
import { test } from "node:test";
import {
  issueReviewInvitation,
  startReviewOtp,
} from "../dist/review-access.js";
function fixture() {
  const queries = [];
  const client = {
    query: async (sql) => {
      queries.push(sql);
      if (sql.includes("select first_checkout"))
        return {
          rows: [{ public_open: true, first_checkout: new Date() }],
          rowCount: 1,
        };
      if (sql.includes("invitation_allowed"))
        return {
          rows: [{ email: "guest@example.test", invitation_allowed: true }],
          rowCount: 1,
        };
      if (sql.includes("offset 2")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  return { queries, client, pool: { connect: async () => client } };
}
const delivery = {
  invitation: async () => {},
  generateOtp: async () => "123456",
  sendOtp: async () => {},
  verifyOtp: async () => null,
};
test("invitation enqueue failure rolls back its credential instead of committing an undeliverable token", async () => {
  const { pool, client, queries } = fixture();
  await assert.rejects(
    issueReviewInvitation(
      pool,
      {
        ...delivery,
        queueInvitation: async (db) => {
          assert.equal(db, client);
          throw new Error("Queue failure");
        },
      },
      "reservation",
    ),
    /Queue failure/,
  );
  assert.equal(queries.at(-1), "rollback");
  assert.equal(queries.includes("commit"), false);
});
test("OTP enqueue failure rolls back its digest and challenge in the same transaction", async () => {
  const { pool, client, queries } = fixture();
  await assert.rejects(
    startReviewOtp(
      pool,
      {
        ...delivery,
        queueOtp: async (db) => {
          assert.equal(db, client);
          throw new Error("Queue failure");
        },
      },
      "reservation",
      "guest@example.test",
      "feedback_otp",
      undefined,
      false,
    ),
    /Queue failure/,
  );
  assert.equal(queries.at(-1), "rollback");
  assert.equal(queries.includes("commit"), false);
});
