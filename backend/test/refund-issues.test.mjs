/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("refund report routes require the right identity and stay closed without an enabled runtime", async () => {
  const staff = { id: "staff", email: null };
  const guest = { id: "guest", email: "guest@example.test" };
  const app = createApp(
    undefined,
    async (token) => (token === "staff" ? staff : null),
    undefined,
    async (token) => (token === "guest" ? guest : null),
  );
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const item = "/refund-issues/room/11111111-1111-4111-8111-111111111111";
  try {
    for (const [actor, token, status] of [
      ["guest", undefined, 401],
      ["guest", "staff", 403],
      ["guest", "guest", 503],
      ["staff", undefined, 401],
      ["staff", "guest", 403],
      ["staff", "staff", 503],
    ]) {
      for (const method of ["GET", "POST"]) {
        const response = await fetch(base + "/" + actor + item, {
          method,
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        assert.equal(
          response.status,
          status,
          `${actor} ${method} with ${token}`,
        );
        assert.match(response.headers.get("cache-control"), /no-store/);
      }
    }
  } finally {
    server.close();
  }
});
