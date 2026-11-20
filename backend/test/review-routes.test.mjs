import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import {
  allowsReviewAction,
  loadReviewEligibility,
} from "../dist/review-access.js";

test("review eligibility projects the authoritative first same-room checkout", async () => {
  const client = {
    query: async (sql, args) => {
      assert.match(sql, /min\(o\.checked_out_at\)/i);
      assert.match(sql, /o\.room_booking_id\s*=\s*i\.room_booking_id/i);
      assert.match(sql, /o\.checked_out_at\s*>\s*i\.checked_in_at/i);
      assert.match(sql, /interval '720 hours'/i);
      assert.deepEqual(args, ["reservation"]);
      return { rows: [{ first_checkout: "recorded", public_open: false }] };
    },
  };
  assert.deepEqual(await loadReviewEligibility(client, "reservation"), {
    first_checkout: "recorded",
    public_open: false,
  });
});

test("fresh OTP capabilities are purpose-scoped and never authorize a rating", () => {
  assert.equal(allowsReviewAction("feedback", "feedback"), true);
  assert.equal(allowsReviewAction("withdrawal", "withdrawal"), true);
  assert.equal(allowsReviewAction("feedback", "review"), false);
  assert.equal(allowsReviewAction("withdrawal", "review"), false);
  assert.equal(allowsReviewAction("review", "feedback"), true);
  assert.equal(allowsReviewAction("review", "withdrawal"), false);
});

test("normal app keeps every H04 entry point inert without checking credentials", async () => {
  const { createApp } = await import("../dist/app.js");
  const unexpectedlyCalled = async () => {
    throw new Error("H04 gate was open");
  };
  const app = createApp(
    unexpectedlyCalled,
    unexpectedlyCalled,
    unexpectedlyCalled,
    unexpectedlyCalled,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    for (const [method, path] of [
      ["GET", "/reviews"],
      ["POST", "/reviews"],
      ["POST", "/reviews/withdrawal"],
      ["POST", "/review-invitations/verify"],
      ["POST", "/review-access/otp"],
      ["POST", "/staff/review-enrollment"],
      ["GET", "/staff/private-feedback"],
    ]) {
      const response = await globalThis.fetch(
        "http://127.0.0.1:" + server.address().port + path,
        { method },
      );
      assert.equal(response.status, 404);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("review mutation preflight permits the idempotency header", async () => {
  const { createApp } = await import("../dist/app.js");
  const previous = process.env.STAFF_WEB_ORIGIN;
  const origin = "https://staff.example.test";
  process.env.STAFF_WEB_ORIGIN = origin;
  const server = createApp().listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const response = await globalThis.fetch(
      "http://127.0.0.1:" + server.address().port + "/reviews",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "idempotency-key",
        },
      },
    );
    assert.equal(response.status, 204);
    assert.match(
      response.headers.get("access-control-allow-headers"),
      /Idempotency-Key/i,
    );
  } finally {
    if (previous === undefined) delete process.env.STAFF_WEB_ORIGIN;
    else process.env.STAFF_WEB_ORIGIN = previous;
    await new Promise((resolve) => server.close(resolve));
  }
});
