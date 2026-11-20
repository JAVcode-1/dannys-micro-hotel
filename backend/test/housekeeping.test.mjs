/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import * as rooms from "../dist/rooms.js";
import { createApp } from "../dist/app.js";

test("H01 exposes transactional housekeeping actions", () => {
  assert.equal(typeof rooms.recordHousekeeping, "function");
  assert.equal(typeof rooms.registerHousekeeping, "function");
});

test("H01 rejects invalid transitions and unauthenticated/inactive actors", async () => {
  assert.equal(typeof rooms.recordHousekeeping, "function");
  await assert.rejects(
    rooms.recordHousekeeping("actor", "1", {}),
    /checkout|Valid/i,
  );
  await assert.rejects(
    rooms.recordHousekeeping("actor", "1", {
      checkoutId: "11111111-1111-4111-8111-111111111111",
      action: ["start"],
      requestKey: "h01-synthetic-request-001",
    }),
    (e) => e.status === 400,
  );
  let released = false;
  const db = {
    query: async (sql) => ({
      rows: [],
      rowCount: sql.includes("staff_accounts") ? 0 : null,
    }),
    release: () => {
      released = true;
    },
  };
  await assert.rejects(
    rooms.recordHousekeeping(
      "actor",
      "1",
      {
        checkoutId: "11111111-1111-4111-8111-111111111111",
        action: "start",
        requestKey: "h01-synthetic-request-001",
      },
      { connect: async () => db },
    ),
    (e) => e.status === 403,
  );
  assert.equal(released, true);
});

test("H01 routes require staff and live housekeeping stays closed", async () => {
  const app = createApp(
    async () => {},
    async (token) => (token === "staff" ? { id: "actor" } : null),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const url = `http://127.0.0.1:${server.address().port}/staff/rooms/1/housekeeping`;
    for (const [token, expected] of [
      [null, 401],
      ["inactive", 403],
      ["staff", 503],
    ]) {
      const response = await fetch(url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      assert.equal(response.status, expected);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("H01 enabled route passes server actor and masks infrastructure failures", async () => {
  assert.equal(typeof rooms.registerHousekeeping, "function");
  const app = express();
  app.use(express.json());
  rooms.registerHousekeeping(
    app,
    (_req, res, next) => {
      res.locals.actorId = "actor";
      next();
    },
    true,
    {
      connect: async () => {
        throw new Error("PRIVATE DATABASE DETAIL");
      },
    },
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/staff/rooms/1/housekeeping`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutId: "11111111-1111-4111-8111-111111111111",
          action: "start",
          requestKey: "h01-synthetic-request-002",
        }),
      },
    );
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
