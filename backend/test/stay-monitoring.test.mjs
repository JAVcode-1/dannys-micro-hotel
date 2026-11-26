/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";
import { checkout } from "../dist/stay-monitoring.js";
import { getSettings, validSettings } from "../dist/operational-settings.js";
test("W03 validates room item, key and bounded unpaid reason before database access", async () => {
  const noDb = {
    connect() {
      throw new Error("unexpected database");
    },
  };
  for (const [id, input] of [
    ["invalid", {}],
    [
      "11111111-1111-4111-8111-111111111111",
      { requestKey: "valid-retry-key-001", exceptionReason: " " },
    ],
    [
      "11111111-1111-4111-8111-111111111111",
      { requestKey: "valid-retry-key-001", exceptionReason: "a".repeat(1001) },
    ],
  ])
    await assert.rejects(
      checkout("actor", id, input, noDb),
      (error) => error.status === 400,
    );
});
test("W03 settings accept one bounded checkout reminder or no reminder", () => {
  const value = {
    cleaningBufferMinutes: null,
    checkoutAlertMinutes: null,
    gcashQrObjectKey: null,
    gcashPayeeLabel: null,
    cancellationDisplayText: null,
  };
  for (const minutes of [null, 1, 15, 30, 1440])
    assert.ok(validSettings({ ...value, checkoutAlertMinutes: minutes }));
  for (const minutes of [0, 15.5, 1441, "15", [30, 15]])
    assert.equal(
      validSettings({ ...value, checkoutAlertMinutes: minutes }),
      false,
    );
});
test("W03 settings prefer the saved single reminder and use the earliest legacy reminder when needed", async () => {
  for (const [single, legacy, expected] of [
    [15, [5, 30, 10], 15],
    [null, [5, 30, 10], 30],
    [null, null, null],
  ]) {
    const settings = await getSettings({
      query: async () => ({
        rows: [
          { checkoutAlertMinutes: single, legacyCheckoutReminders: legacy },
        ],
      }),
    });
    assert.deepEqual(settings, { checkoutAlertMinutes: expected });
  }
});
test("W03 endpoints require individual active staff; normal registration cannot enable checkout", async () => {
  let active = true;
  const app = createApp(
    async () => {},
    async (token) =>
      token === "staff" && active
        ? { id: "33333333-3333-4333-8333-333333333333", email: null }
        : null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [path, method] of [
      ["/staff/stays", "GET"],
      ["/staff/stays/11111111-1111-4111-8111-111111111111/checkout", "POST"],
    ]) {
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
    const url =
      base + "/staff/stays/11111111-1111-4111-8111-111111111111/checkout";
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer staff" },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    active = false;
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { Authorization: "Bearer staff" },
        })
      ).status,
      403,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
