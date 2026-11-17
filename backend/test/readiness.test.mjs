/* global fetch */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

async function requestReady(probe) {
  const server = createApp(probe).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    return await fetch(`http://127.0.0.1:${address.port}/ready`);
  } finally {
    server.close();
  }
}

test("readiness succeeds after a database probe", async () => {
  const response = await requestReady(async () => {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ready" });
});

test("readiness fails closed and hides database errors", async () => {
  const response = await requestReady(async () => {
    throw new Error("password=private");
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable" });
});

test("readiness reuses a recent database probe", async () => {
  let calls = 0;
  const app = createApp(async () => {
    calls += 1;
  });
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    for (let n = 0; n < 3; n += 1) {
      const response = await fetch(`http://127.0.0.1:${address.port}/ready`);
      assert.equal(response.status, 200);
    }
    assert.equal(calls, 1);
  } finally {
    server.close();
  }
});

test("readiness retries after a failed probe", async () => {
  const originalNow = performance.now;
  let now = originalNow.call(performance);
  performance.now = () => now;
  let calls = 0;
  const app = createApp(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporarily unavailable");
  });
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/ready`;
    assert.equal((await fetch(url)).status, 503);
    assert.equal((await fetch(url)).status, 503);
    assert.equal(calls, 1);
    now += 5001;
    assert.equal((await fetch(url)).status, 200);
    assert.equal(calls, 2);
  } finally {
    performance.now = originalNow;
    server.close();
  }
});

test("simultaneous readiness requests share one in-flight probe", async () => {
  let calls = 0;
  let release;
  const probe = new Promise((resolve) => {
    release = resolve;
  });
  const server = createApp(async () => {
    calls += 1;
    await probe;
  }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/ready`;
    const pending = Array.from({ length: 3 }, () => fetch(url));
    await setTimeout(20);
    release();
    const responses = await Promise.all(pending);
    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200, 200],
    );
    assert.equal(calls, 1);
  } finally {
    release();
    server.close();
  }
});

test("readiness refreshes a successful probe after five seconds", async () => {
  const originalNow = performance.now;
  let now = originalNow.call(performance);
  performance.now = () => now;
  let calls = 0;
  const server = createApp(async () => {
    calls += 1;
  }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/ready`;
    assert.equal((await fetch(url)).status, 200);
    now += 5001;
    assert.equal((await fetch(url)).status, 200);
    assert.equal(calls, 2);
  } finally {
    performance.now = originalNow;
    server.close();
  }
});

test("readiness does not reuse success after a synchronous probe failure", async () => {
  const originalNow = performance.now;
  let now = originalNow.call(performance);
  performance.now = () => now;
  let calls = 0;
  const server = createApp(() => {
    calls += 1;
    if (calls === 2) throw new Error("temporarily unavailable");
    return Promise.resolve();
  }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/ready`;
    assert.equal((await fetch(url)).status, 200);
    now += 5001;
    assert.equal((await fetch(url)).status, 503);
    assert.equal((await fetch(url)).status, 503);
    now += 5001;
    assert.equal((await fetch(url)).status, 200);
    assert.equal(calls, 3);
  } finally {
    performance.now = originalNow;
    server.close();
  }
});

test("readiness expires a success after the wall clock moves backward", async () => {
  const originalWallNow = Date.now;
  const originalMonotonicNow = performance.now;
  let wallNow = originalWallNow();
  let monotonicNow = originalMonotonicNow.call(performance);
  Date.now = () => wallNow;
  performance.now = () => monotonicNow;
  let calls = 0;
  const server = createApp(async () => {
    calls += 1;
    if (calls === 2) throw new Error("database unavailable");
  }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/ready`;
    assert.equal((await fetch(url)).status, 200);
    wallNow -= 60000;
    monotonicNow += 5001;
    assert.equal((await fetch(url)).status, 503);
    assert.equal(calls, 2);
  } finally {
    Date.now = originalWallNow;
    performance.now = originalMonotonicNow;
    server.close();
  }
});
