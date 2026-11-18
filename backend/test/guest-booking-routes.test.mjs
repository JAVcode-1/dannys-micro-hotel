/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("guest hold creation stays disabled and lookup requires verified identity", async () => {
  const app = createApp(
    async () => {},
    async () => null,
    async () => {},
    async () => null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal(
      (await fetch(`${url}/guest/reservations`, { method: "POST" })).status,
      503,
    );
    assert.equal((await fetch(`${url}/guest/reservations`)).status, 401);
    assert.equal(
      (
        await fetch(`${url}/guest/reservations`, {
          headers: { Authorization: "Bearer expired" },
        })
      ).status,
      403,
    );
    const invalid = await fetch(`${url}/guest/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ category: "family_executive", blocks: [180] }],
      }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get("cache-control"), "no-store");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
