/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("O02 routes reject unauthorized staff/guests and default guest payment gate stays closed", async () => {
  const app = createApp(
    async () => {},
    async () => null,
    async () => {},
    async (token) =>
      token === "verified"
        ? { id: "guest", email: "guest@example.test" }
        : null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal(
      (await fetch(`${base}/staff/payment-qr`, { method: "POST" })).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/staff/payment-qr`, {
          method: "POST",
          headers: { Authorization: "Bearer guest" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(
          `${base}/guest/payments/11111111-1111-4111-8111-111111111111`,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(
          `${base}/guest/payments/11111111-1111-4111-8111-111111111111`,
          { headers: { Authorization: "Bearer verified" } },
        )
      ).status,
      503,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
