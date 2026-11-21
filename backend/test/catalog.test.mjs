/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changePackagePrice,
  setPackageActive,
  updateCategory,
} from "../dist/catalog.js";
import { createApp } from "../dist/app.js";

test("unsupported Family 3-hour and unsafe prices are rejected before database access", async () => {
  for (const [code, duration, price] of [
    ["family_executive", 180, 20000],
    ["double_standard", 180, -1],
    ["double_standard", 180, 1.5],
    ["unknown", 360, 10000],
  ])
    assert.equal(
      await changePackagePrice("staff", code, duration, price),
      false,
    );
});

test("retired staff cannot mutate catalog through a stale verified request", async () => {
  const statements = [];
  const pool = {
    connect: async () => ({
      query: async (sql) => {
        statements.push(sql);
        return { rows: [], rowCount: 0 };
      },
      release() {},
    }),
  };
  for (const operation of [
    () => changePackagePrice("retired", "double_standard", 180, 20000, pool),
    () => setPackageActive("retired", "double_standard", 180, true, pool),
    () => updateCategory("retired", "double_standard", "Standard", true, pool),
  ]) {
    await assert.rejects(operation(), /Staff access denied/);
  }
  assert.equal(
    statements.some((sql) => /^\s*(update|insert)/i.test(sql)),
    false,
  );
});

test("price revision retains old version and commits audit in one transaction", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push([sql, params]);
      if (sql.includes("select p.id"))
        return { rowCount: 1, rows: [{ id: 7, category_id: 2, version: 3 }] };
      return { rowCount: 1, rows: [] };
    },
    release() {
      calls.push(["release"]);
    },
  };
  assert.equal(
    await changePackagePrice("actor", "family_executive", 360, 65000, {
      connect: async () => client,
    }),
    true,
  );
  assert.deepEqual(
    calls.map(([sql]) => sql.trim().split(/\s+/)[0].toLowerCase()),
    [
      "begin",
      "select",
      "select",
      "update",
      "insert",
      "insert",
      "commit",
      "release",
    ],
  );
  assert.deepEqual(calls[4][1], [2, "family_executive", 360, 65000, 4]);
  assert.deepEqual(calls[5][1], ["actor"]);
});

test("audit failure rolls back price revision", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes("select p.id"))
        return { rowCount: 1, rows: [{ id: 7, category_id: 2, version: 3 }] };
      if (sql.includes("staff_audit")) throw new Error("audit unavailable");
      return { rowCount: 1 };
    },
    release() {},
  };
  await assert.rejects(
    changePackagePrice("actor", "family_executive", 360, 65000, {
      connect: async () => client,
    }),
    /audit unavailable/,
  );
  assert.equal(calls.at(-1), "rollback");
});

test("package activation rejects unsupported duration before database access", async () => {
  assert.equal(
    await setPackageActive("actor", "family_executive", 180, true),
    false,
  );
});

test("catalog settings routes deny anonymous and non-staff callers before database access", async () => {
  const app = createApp(
    async () => {},
    async () => null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const root = `http://127.0.0.1:${server.address().port}`;
    for (const path of [
      "/staff/catalog",
      "/staff/catalog/packages",
      "/staff/catalog/categories",
    ]) {
      const method = path === "/staff/catalog" ? "GET" : "PATCH";
      assert.equal((await fetch(root + path, { method })).status, 401);
      assert.equal(
        (
          await fetch(root + path, {
            method,
            headers: { Authorization: "Bearer guest" },
          })
        ).status,
        403,
      );
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
