import assert from "node:assert/strict";
import { URL } from "node:url";
import { test } from "node:test";
import {
  createDevelopmentAuth,
  developmentAuthAllowed,
} from "../src/development-auth.ts";
test("fixture authentication is unavailable outside explicitly enabled local development", () => {
  for (const options of [
    { development: false, enabled: true, hostname: "localhost" },
    { development: true, enabled: false, hostname: "localhost" },
    { development: true, enabled: true, hostname: "hotel.example" },
  ])
    assert.equal(developmentAuthAllowed(options), false);
  assert.equal(
    developmentAuthAllowed({
      development: true,
      enabled: true,
      hostname: "127.0.0.1",
    }),
    true,
  );
});
test("fixture OTP and staff login reject real identities and preserve explicit synthetic login", async () => {
  const values = new Map();
  let requests = 0;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const request = async (url) => {
    requests++;
    const kind = new URL(url, "http://localhost").searchParams.get("kind");
    return {
      ok: true,
      json: async () => ({
        access_token: `fixture-${kind}`,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: kind, email: `${kind}@example.test` },
      }),
    };
  };
  const client = createDevelopmentAuth("/api", storage, request);
  assert.equal((await client.auth.getSession()).data.session, null);
  assert.ok(
    (await client.auth.signInWithOtp({ email: "real@example.com" })).error,
  );
  assert.ok(
    (
      await client.auth.verifyOtp({
        email: "guest@example.test",
        token: "000000",
        type: "email",
      })
    ).error,
  );
  assert.equal(requests, 0);
  assert.equal(
    (
      await client.auth.verifyOtp({
        email: "guest@example.test",
        token: "123456",
        type: "email",
      })
    ).data.session.access_token,
    "fixture-guest",
  );
  const restored = createDevelopmentAuth("/api", storage, request);
  assert.equal(
    (await restored.auth.getSession()).data.session.access_token,
    "fixture-guest",
  );
  assert.ok(
    (
      await client.auth.signInWithPassword({
        email: "staff@example.test",
        password: "real-password",
      })
    ).error,
  );
  assert.equal(
    (
      await client.auth.signInWithPassword({
        email: "staff@example.test",
        password: "development-only",
      })
    ).error,
    null,
  );
  await client.auth.signOut();
  assert.equal((await client.auth.getSession()).data.session, null);
  assert.throws(
    () => createDevelopmentAuth("https://hosted.example/api", storage, request),
    /loopback/,
  );
});
