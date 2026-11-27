import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryObserver } from "@tanstack/react-query";
import {
  apiQueryOptions,
  clearApiScope,
  createApiQueryClient,
  invalidateApiDomains,
} from "../src/api-query";
import { createInvalidationBatch } from "../src/data-sync";
import { writeDomain } from "@staytrack/shared/data-domains";

test("concurrent reads share a request only within the same access scope and parameters", async () => {
  const client = createApiQueryClient();
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.headers.Authorization]);
    return globalThis.Response.json(options.headers.Authorization);
  };
  try {
    const first = apiQueryOptions("/staff/reservations?page=1", "token-a", [
      "staff",
      "a",
    ]);
    const second = apiQueryOptions("/staff/reservations?page=1", "token-b", [
      "staff",
      "b",
    ]);
    const anotherPage = apiQueryOptions(
      "/staff/reservations?page=2",
      "token-a",
      ["staff", "a"],
    );
    assert.deepEqual(
      await Promise.all([
        client.fetchQuery(first),
        client.fetchQuery(first),
        client.fetchQuery(second),
        client.fetchQuery(anotherPage),
      ]),
      ["Bearer token-a", "Bearer token-a", "Bearer token-b", "Bearer token-a"],
    );
    assert.equal(calls.length, 3);
    assert.equal(await client.fetchQuery(first), "Bearer token-a");
    assert.equal(calls.length, 3);
    clearApiScope(client, ["staff", "a"]);
    assert.equal(client.getQueryData(first.queryKey), undefined);
    assert.equal(client.getQueryData(anotherPage.queryKey), undefined);
    assert.equal(client.getQueryData(second.queryKey), "Bearer token-b");
  } finally {
    client.clear();
    globalThis.fetch = originalFetch;
  }
});

test("payment invalidation reaches dependent staff queries without touching settings or guest caches", async () => {
  const client = createApiQueryClient();
  try {
    const cached = (path, scope) =>
      apiQueryOptions(path, "token", scope).queryKey;
    const dashboard = cached("/staff/dashboard", ["staff", "a"]);
    const reservations = cached("/staff/reservations?page=2", ["staff", "a"]);
    const settings = cached("/staff/settings", ["staff", "a"]);
    const guest = cached("/guest/payments/id", ["guest", "b"]);
    for (const key of [dashboard, reservations, settings, guest])
      client.setQueryData(key, {});
    await invalidateApiDomains(client, ["payment"], ["staff", "a"]);
    const stale = (key) => client.getQueryState(key).isInvalidated;
    assert.deepEqual([dashboard, reservations, settings, guest].map(stale), [
      true,
      true,
      false,
      false,
    ]);
    assert.equal(writeDomain("POST", "/guest/payments/id/proof"), "payment");
    assert.equal(writeDomain("POST", "/staff/hall/extension-quote"), undefined);
    assert.equal(writeDomain("GET", "/staff/rooms"), undefined);
  } finally {
    client.clear();
  }
});

test("related notifications coalesce and disposal cancels queued invalidation", async () => {
  const calls = [];
  const batch = createInvalidationBatch((domains) => calls.push(domains), 5);
  batch.add("payment");
  batch.add("payment");
  batch.add("reservation");
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
  assert.deepEqual(calls, [["payment", "reservation"]]);
  batch.add("room");
  batch.dispose();
  batch.add("settings");
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
  assert.equal(calls.length, 1);
});

test("an invalidation replaces an initial read that started before the committed change", async () => {
  const client = createApiQueryClient();
  const originalFetch = globalThis.fetch;
  let finishStaleRead;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1)
      return new Promise((resolve) => {
        finishStaleRead = resolve;
      });
    return globalThis.Response.json("confirmed");
  };
  const scope = ["staff", "a"];
  const read = apiQueryOptions("/staff/reservations?page=1", "token", scope);
  const listener = new QueryObserver(client, read);
  const unsubscribe = listener.subscribe(() => {});
  try {
    assert.equal(calls, 1);
    const refreshed = invalidateApiDomains(client, ["payment"], scope);
    finishStaleRead(globalThis.Response.json("pending review"));
    await refreshed;
    assert.equal(client.getQueryData(read.queryKey), "confirmed");
    assert.equal(calls, 2);
  } finally {
    unsubscribe();
    client.clear();
    globalThis.fetch = originalFetch;
  }
});
