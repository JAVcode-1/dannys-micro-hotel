/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";
test("X03 all mutation routes require active staff and remain closed in normal application", async () => {
  const app = createApp(
    async () => {},
    async (token) =>
      token === "staff"
        ? { id: "33333333-3333-4333-8333-333333333333", email: null }
        : null,
    async () => {},
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}/staff/`;
    for (const path of [
      "stay-changes/id/extensions",
      "stay-extensions/id/decision",
      "stay-changes/id/receipts",
      "stay-receipts/id/allocations",
      "stay-allocations/id/release",
      "stay-changes/id/reviews",
      "stay-reviews/id/decision",
      "stay-charges/id/credit",
    ]) {
      assert.equal((await fetch(base + path, { method: "POST" })).status, 401);
      assert.equal(
        (
          await fetch(base + path, {
            method: "POST",
            headers: { Authorization: "Bearer guest" },
          })
        ).status,
        403,
      );
      const res = await fetch(base + path, {
        method: "POST",
        headers: { Authorization: "Bearer staff" },
      });
      assert.equal(res.status, 503);
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});
