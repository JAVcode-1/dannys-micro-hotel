import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/reservations",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, waitFor, cleanup, act } =
  await import("@testing-library/react");
const { GuestSessionProvider, useGuestSession, safeGuestReturnTo } =
  await import("../src/GuestSession.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
function Probe() {
  const { access, signOut } = useGuestSession();
  return createElement(
    "button",
    { onClick: () => void signOut() },
    access.status === "authenticated"
      ? `${access.email}:${access.token}`
      : access.status,
  );
}
test("guest session restores, verifies refreshed tokens and clears private access on logout", async () => {
  let notify;
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: "first",
            user: { id: "guest", email: "first@example.test" },
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      }),
      onAuthStateChange: (callback) => {
        notify = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => {
        notify("SIGNED_OUT", null);
        return { error: null };
      },
    },
  };
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    json: async () => ({
      id: "guest",
      email:
        options.headers.Authorization === "Bearer first"
          ? "first@example.test"
          : "second@example.test",
    }),
  });
  render(
    createElement(
      GuestSessionProvider,
      { authClient: client },
      createElement(Probe),
    ),
  );
  await waitFor(() => assert.ok(screen.getByText("first@example.test:first")));
  await act(async () =>
    notify("TOKEN_REFRESHED", {
      access_token: "second",
      user: { id: "guest", email: "second@example.test" },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText("second@example.test:second")),
  );
  await act(async () => screen.getByRole("button").click());
  await waitFor(() => assert.ok(screen.getByText("unauthenticated")));
});
test("late restoration cannot overwrite a sign-out and external return paths are rejected", async () => {
  let finish, notify;
  const client = {
    auth: {
      getSession: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      onAuthStateChange: (callback) => {
        notify = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  render(
    createElement(
      GuestSessionProvider,
      { authClient: client },
      createElement(Probe),
    ),
  );
  await act(async () => {
    notify("SIGNED_OUT", null);
    finish({ data: { session: { access_token: "stale" } }, error: null });
  });
  assert.ok(screen.getByText("unauthenticated"));
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/staff",
    "/book\n",
  ])
    assert.equal(safeGuestReturnTo(path), "/reservations");
  assert.equal(
    safeGuestReturnTo("/book?category=family_executive"),
    "/book?category=family_executive",
  );
});
