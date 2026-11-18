/* global fetch */
import assert from "node:assert/strict";
import process from "node:process";
import { test } from "node:test";
import { createApp } from "../dist/app.js";
import {
  createStaffVerifier,
  insertStaffAudit,
  verifyStaff,
} from "../dist/staff-auth.js";

async function request(app, authorization) {
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    return await fetch(`http://127.0.0.1:${address.port}/staff/me`, {
      headers: authorization ? { authorization } : {},
    });
  } finally {
    server.close();
  }
}

test("staff API rejects missing, malformed, guest and revoked credentials", async () => {
  const seen = [];
  const app = createApp(undefined, async (token) => {
    seen.push(token);
    return null;
  });
  assert.equal((await request(app)).status, 401);
  assert.equal((await request(app, "Basic abc")).status, 401);
  assert.equal((await request(app, "Bearer guest-token")).status, 403);
  assert.deepEqual(seen, ["guest-token"]);
});

test("staff session loses access as soon as membership is revoked", async () => {
  let active = true;
  const actors = [];
  const app = createApp(
    undefined,
    async () => (active ? { id: "employee-1", email: null } : null),
    async (id) => {
      actors.push(id);
    },
  );
  assert.equal((await request(app, "Bearer same-session")).status, 200);
  active = false;
  assert.equal((await request(app, "Bearer same-session")).status, 403);
  assert.deepEqual(actors, ["employee-1"]);
});

test("distinct staff actors are audited separately", async () => {
  const actors = [];
  const app = createApp(
    undefined,
    async (token) => ({ id: token, email: null }),
    async (id) => {
      actors.push(id);
    },
  );
  for (const id of ["staff-one", "staff-two"]) {
    const result = await request(app, `Bearer ${id}`);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).id, id);
  }
  assert.deepEqual(actors, ["staff-one", "staff-two"]);
});

test("staff lookup and audit errors fail closed", async () => {
  const broken = createApp(undefined, async () => {
    throw new Error("database offline");
  });
  assert.equal((await request(broken, "Bearer token")).status, 503);
  const auditBroken = createApp(
    undefined,
    async () => ({ id: "staff", email: null }),
    async () => {
      throw new Error("audit offline");
    },
  );
  assert.equal((await request(auditBroken, "Bearer token")).status, 503);
});

test("staff verification is rate limited before provider lookup", async () => {
  let calls = 0;
  const app = createApp(undefined, async () => {
    calls += 1;
    return null;
  });
  for (let index = 0; index < 30; index += 1) {
    assert.equal((await request(app, "Bearer invalid")).status, 403);
  }
  const limited = await request(app, "Bearer invalid");
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
  assert.equal(calls, 30);
});

test("production staff policy checks active membership by authenticated user ID", async () => {
  const queries = [];
  const verifier = createStaffVerifier({
    getUser: async (token) =>
      token === "valid"
        ? { id: "employee-1", email: "staff@example.test" }
        : null,
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rowCount: 1 };
    },
  });
  assert.equal(await verifier("invalid"), null);
  assert.deepEqual(await verifier("valid"), {
    id: "employee-1",
    email: "staff@example.test",
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /active = true/);
  assert.deepEqual(queries[0].params, ["employee-1"]);
  const inactive = createStaffVerifier({
    getUser: async () => ({ id: "disabled" }),
    query: async () => ({ rowCount: 0 }),
  });
  assert.equal(await inactive("valid"), null);
  const failed = createStaffVerifier({
    getUser: async () => ({ id: "employee-1" }),
    query: async () => {
      throw new Error("database offline");
    },
  });
  await assert.rejects(failed("valid"), /database offline/);
});

test("audit insert records the verified actor and propagates failures", async () => {
  const calls = [];
  await insertStaffAudit("employee-1", async (sql, params) => {
    calls.push({ sql, params });
    return { rowCount: 1 };
  });
  assert.match(calls[0].sql, /staff\.session_verified/);
  assert.deepEqual(calls[0].params, ["employee-1"]);
  await assert.rejects(
    insertStaffAudit("employee-1", async () => {
      throw new Error("audit offline");
    }),
    /audit offline/,
  );
});

test("production verifier requires the documented publishable key", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  try {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    await assert.rejects(verifyStaff("token"), /not configured/);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
