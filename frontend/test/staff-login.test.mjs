import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";

/* global window */

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/staff",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, waitFor, cleanup, act } =
  await import("@testing-library/react");
const { default: App } = await import("../src/App.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  globalThis.window.history.replaceState(null, "", "/staff");
});

function client(initialSession = null) {
  let listener;
  const calls = [];
  return {
    calls,
    emit(event, session) {
      listener?.(event, session);
    },
    auth: {
      getSession: async () => ({ data: { session: initialSession } }),
      onAuthStateChange(callback) {
        listener = callback;
        return {
          data: {
            subscription: {
              unsubscribe() {
                listener = undefined;
              },
            },
          },
        };
      },
      signInWithPassword: async (credentials) => {
        calls.push(["signIn", credentials]);
        return { error: null };
      },
      resetPasswordForEmail: async (email) => {
        calls.push(["recover", email]);
        return { error: null };
      },
      updateUser: async (value) => {
        calls.push(["update", value]);
        return { error: null };
      },
      signOut: async () => {
        calls.push(["signOut"]);
        listener?.("SIGNED_OUT", null);
        return { error: null };
      },
    },
  };
}

test("refresh at a protected URL hides sign-in during restoration and membership verification", async () => {
  window.history.replaceState(null, "", "/staff/analytics");
  const auth = client();
  let restore;
  let verify;
  auth.auth.getSession = () =>
    new Promise((resolve) => {
      restore = resolve;
    });
  globalThis.fetch = async (url) => {
    if (url.endsWith("/staff/me"))
      return new Promise((resolve) => {
        verify = resolve;
      });
    return { ok: false, status: 503 };
  };
  render(createElement(App, { staffAuthClient: auth }));
  assert.match(
    screen.getByRole("status").textContent,
    /Verifying staff session/,
  );
  assert.equal(screen.queryByLabelText("Password"), null);
  await act(async () =>
    restore({ data: { session: { access_token: "restored-token" } } }),
  );
  assert.match(
    screen.getByRole("status").textContent,
    /Verifying staff session/,
  );
  assert.equal(screen.queryByLabelText("Password"), null);
  await act(async () =>
    verify({
      ok: true,
      json: async () => ({ email: "restored@example.test" }),
    }),
  );
  assert.ok(screen.getByText("Signed in as restored@example.test"));
  assert.ok(screen.getByRole("heading", { name: /analytics/i }));
  assert.equal(window.location.pathname, "/staff/analytics");
});

test("protected navigation preserves the staff layout and verifies the same token once", async () => {
  const auth = client({ access_token: "staff-token" });
  let membershipChecks = 0;
  let restores = 0;
  const getSession = auth.auth.getSession;
  auth.auth.getSession = () => {
    restores++;
    return getSession();
  };
  globalThis.fetch = async (url) => {
    if (!url.endsWith("/staff/me")) return { ok: false, status: 503 };
    membershipChecks++;
    return { ok: true, json: async () => ({ email: "staff@example.test" }) };
  };
  const app = createElement(App, { staffAuthClient: auth });
  const mounted = render(app);
  const link = await screen.findByRole("link", { name: "Analytics" });
  const nav = link.closest("section");
  fireEvent.click(link);
  assert.ok(await screen.findByRole("heading", { name: /analytics/i }));
  assert.equal(window.location.pathname, "/staff/analytics");
  assert.equal(
    screen.getByRole("link", { name: "Analytics" }).closest("section"),
    nav,
  );
  assert.equal(screen.queryByLabelText("Password"), null);
  await act(async () =>
    auth.emit("SIGNED_IN", { access_token: "staff-token" }),
  );
  assert.ok(screen.getByRole("heading", { name: /analytics/i }));
  fireEvent.click(screen.getByRole("link", { name: "Staff audit" }));
  assert.ok(await screen.findByRole("heading", { name: /staff audit/i }));
  assert.equal(membershipChecks, 1);
  assert.equal(restores, 1);

  mounted.unmount();
  render(app);
  assert.equal(screen.queryByRole("heading", { name: "Staff sign-in" }), null);
  assert.ok(await screen.findByRole("heading", { name: /staff audit/i }));
  assert.equal(membershipChecks, 2);
  assert.equal(restores, 2);
});

test("staff feature routes require both their feature gate and verified staff access", async () => {
  for (const path of ["/staff/hall", "/staff/reviews", "/staff/feedback"]) {
    window.history.replaceState(null, "", path);
    const disabled = render(createElement(App, { staffAuthClient: client() }));
    assert.ok(screen.getByRole("heading", { name: "Stay on your schedule." }));
    disabled.unmount();

    const enabled = render(
      createElement(App, {
        staffAuthClient: client(),
        reviewsEnabled: true,
        hallEnabled: true,
      }),
    );
    assert.ok(await screen.findByRole("heading", { name: "Staff sign-in" }));
    assert.equal(window.location.pathname, "/staff/sign-in");
    enabled.unmount();
  }
});

test("a refreshed token rejected by Express closes the protected page and opens sign-in", async () => {
  window.history.replaceState(null, "", "/staff/analytics");
  const auth = client({ access_token: "current" });
  globalThis.fetch = async (url, { headers } = {}) => {
    if (!url.endsWith("/staff/me")) return { ok: false, status: 503 };
    if (headers.Authorization === "Bearer expired")
      return { ok: false, status: 401 };
    return { ok: true, json: async () => ({ email: "staff@example.test" }) };
  };
  render(createElement(App, { staffAuthClient: auth }));
  await screen.findByRole("heading", { name: "Analytics" });
  await act(async () =>
    auth.emit("TOKEN_REFRESHED", { access_token: "expired" }),
  );
  assert.ok(await screen.findByRole("heading", { name: "Staff sign-in" }));
  assert.match(screen.getByRole("status").textContent, /session expired/);
  assert.equal(window.location.pathname, "/staff/sign-in");
  assert.equal(screen.queryByRole("heading", { name: "Analytics" }), null);
});

test("a cached session past its expiry cannot open a protected page", async () => {
  window.history.replaceState(null, "", "/staff/audit");
  const auth = client({
    access_token: "expired",
    expires_at: Math.floor(Date.now() / 1000) - 1,
  });
  let membershipChecks = 0;
  globalThis.fetch = async () => {
    membershipChecks++;
    return { ok: true, json: async () => ({ email: "staff@example.test" }) };
  };
  render(createElement(App, { staffAuthClient: auth }));
  assert.ok(await screen.findByRole("heading", { name: "Staff sign-in" }));
  assert.match(screen.getByRole("status").textContent, /session expired/);
  assert.equal(screen.queryByRole("heading", { name: "Staff audit" }), null);
  assert.equal(membershipChecks, 0);
});

test("logout removes protected content and reauthentication returns to the requested page", async () => {
  window.history.replaceState(null, "", "/staff/analytics");
  const auth = client({ access_token: "staff-token" });
  globalThis.fetch = async (url) =>
    url.endsWith("/staff/me")
      ? { ok: true, json: async () => ({ email: "staff@example.test" }) }
      : { ok: false, status: 503 };
  render(createElement(App, { staffAuthClient: auth }));
  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  assert.ok(await screen.findByRole("button", { name: "Sign in" }));
  assert.equal(window.location.pathname, "/staff/sign-in");
  assert.equal(screen.queryByRole("heading", { name: "Analytics" }), null);
  assert.equal(screen.queryByText(/Signed in as/), null);
  await act(async () => auth.emit("SIGNED_IN", { access_token: "new-token" }));
  assert.ok(await screen.findByRole("heading", { name: "Analytics" }));
  assert.equal(window.location.pathname, "/staff/analytics");
});

test("staff signs in with individual credentials and can request recovery", async () => {
  const auth = client();
  render(createElement(App, { staffAuthClient: auth }));
  fireEvent.change(await screen.findByLabelText("Email"), {
    target: { value: "staff@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "secret-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => assert.equal(auth.calls[0]?.[0], "signIn"));
  assert.deepEqual(auth.calls[0][1], {
    email: "staff@example.test",
    password: "secret-password",
  });
  await waitFor(() =>
    assert.equal(
      screen.getByRole("button", { name: "Forgot password?" }).disabled,
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  await waitFor(() =>
    assert.deepEqual(auth.calls[1], ["recover", "staff@example.test"]),
  );
  assert.match(
    screen.getByRole("status").textContent,
    /If this email has an account/,
  );
});

test("staff session checks Express; denied membership is never shown as signed in", async () => {
  const auth = client({ access_token: "guest-token" });
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  render(createElement(App, { staffAuthClient: auth }));
  await waitFor(() =>
    assert.match(screen.getByRole("status").textContent, /denied/),
  );
  assert.equal(screen.queryByText(/Signed in as/), null);
  assert.equal(window.location.pathname, "/staff/sign-in");
});

test("verified staff sees identity, can sign out, and recovery can update password", async () => {
  const auth = client({ access_token: "staff-token" });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ email: "one@example.test" }),
  });
  render(createElement(App, { staffAuthClient: auth }));
  await waitFor(() =>
    assert.ok(screen.getByText("Signed in as one@example.test")),
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => assert.equal(auth.calls.at(-1)?.[0], "signOut"));
  act(() => auth.emit("PASSWORD_RECOVERY", { access_token: "recovery-token" }));
  await waitFor(() => assert.ok(screen.getByLabelText("New password")));
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-strong-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  await waitFor(() =>
    assert.deepEqual(auth.calls.at(-1), [
      "update",
      { password: "new-strong-password" },
    ]),
  );
});

test("late initial session lookup cannot restore a signed-out session", async () => {
  let resolveInitial;
  const auth = client();
  auth.auth.getSession = () =>
    new Promise((resolve) => {
      resolveInitial = resolve;
    });
  const requests = [];
  globalThis.fetch = async (...args) => {
    requests.push(args);
    return { ok: true, json: async () => ({ email: "stale@example.test" }) };
  };
  render(createElement(App, { staffAuthClient: auth }));
  act(() => auth.emit("SIGNED_OUT", null));
  await act(async () =>
    resolveInitial({ data: { session: { access_token: "stale-token" } } }),
  );
  assert.equal(requests.length, 0);
  assert.equal(screen.queryByText(/Signed in as/), null);
});

test("rejected Auth requests leave forms usable and show errors", async () => {
  const auth = client();
  auth.auth.getSession = async () => {
    throw new Error("offline");
  };
  auth.auth.signInWithPassword = async () => {
    throw new Error("offline");
  };
  auth.auth.resetPasswordForEmail = async () => {
    throw new Error("offline");
  };
  render(createElement(App, { staffAuthClient: auth }));
  await waitFor(() =>
    assert.match(
      screen.getByRole("status").textContent,
      /restore your session/,
    ),
  );
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "staff@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() =>
    assert.match(
      screen.getByRole("status").textContent,
      /Sign-in is unavailable/,
    ),
  );
  await waitFor(() =>
    assert.equal(
      screen.getByRole("button", { name: "Sign in" }).disabled,
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  await waitFor(() =>
    assert.match(
      screen.getByRole("status").textContent,
      /Recovery is unavailable/,
    ),
  );
  assert.equal(screen.getByRole("button", { name: "Sign in" }).disabled, false);
});

test("switching sessions hides the previous employee until reverified", async () => {
  const auth = client({ access_token: "first" });
  let resolveSecond;
  globalThis.fetch = async (_url, options) => {
    if (options.headers.Authorization === "Bearer first")
      return { ok: true, json: async () => ({ email: "first@example.test" }) };
    return new Promise((resolve) => {
      resolveSecond = resolve;
    });
  };
  render(createElement(App, { staffAuthClient: auth }));
  await waitFor(() =>
    assert.ok(screen.getByText("Signed in as first@example.test")),
  );
  act(() => auth.emit("SIGNED_IN", { access_token: "second" }));
  assert.equal(screen.queryByText("Signed in as first@example.test"), null);
  assert.equal(screen.queryByLabelText("Password"), null);
  await act(async () =>
    resolveSecond({
      ok: true,
      json: async () => ({ email: "second@example.test" }),
    }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText("Signed in as second@example.test")),
  );
});

test("leaving recovery restores sign-in and failed sign-out remains retryable", async () => {
  const auth = client({ access_token: "staff" });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ email: "staff@example.test" }),
  });
  render(createElement(App, { staffAuthClient: auth }));
  await waitFor(() =>
    assert.ok(screen.getByText("Signed in as staff@example.test")),
  );
  auth.auth.signOut = async () => {
    throw new Error("offline");
  };
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    assert.match(screen.getByRole("status").textContent, /Sign-out failed/),
  );
  assert.ok(screen.getByRole("button", { name: "Sign out" }));
  act(() => auth.emit("PASSWORD_RECOVERY", { access_token: "recovery" }));
  assert.ok(screen.getByLabelText("New password"));
  act(() => auth.emit("SIGNED_OUT", null));
  await waitFor(() =>
    assert.ok(screen.getByRole("button", { name: "Sign in" })),
  );
  assert.equal(screen.queryByLabelText("New password"), null);
});

test("unrelated null Auth event does not discard a stored session", async () => {
  let resolveInitial;
  const auth = client();
  auth.auth.getSession = () =>
    new Promise((resolve) => {
      resolveInitial = resolve;
    });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ email: "stored@example.test" }),
  });
  render(createElement(App, { staffAuthClient: auth }));
  act(() => auth.emit("USER_UPDATED", null));
  await act(async () =>
    resolveInitial({ data: { session: { access_token: "stored-token" } } }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText("Signed in as stored@example.test")),
  );
});

test("invitation callback sets a password without showing inactive staff access", async () => {
  globalThis.window.history.replaceState(
    null,
    "",
    "/staff#access_token=secret&type=invite",
  );
  const auth = client({ access_token: "invite-token" });
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  render(createElement(App, { staffAuthClient: auth }));
  await waitFor(() => assert.ok(screen.getByLabelText("New password")));
  assert.equal(screen.queryByText(/Signed in as/), null);
  await waitFor(() => assert.equal(window.location.hash, ""));
  assert.equal(window.location.pathname, "/staff");
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "a-long-unique-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
  await waitFor(() =>
    assert.deepEqual(auth.calls.at(-1), [
      "update",
      { password: "a-long-unique-password" },
    ]),
  );
  assert.ok(await screen.findByRole("heading", { name: "Staff sign-in" }));
  assert.equal(window.location.pathname, "/staff/sign-in");
  assert.match(screen.getByRole("status").textContent, /Password set/);
  assert.equal(screen.queryByText(/Signed in as/), null);
});

test("invitation callback sent to homepage opens staff onboarding", () => {
  globalThis.window.history.replaceState(
    null,
    "",
    "/#access_token=secret&type=invite",
  );
  render(createElement(App));
  assert.ok(
    screen.getByText("Staff sign-in is not configured for this preview."),
  );
  assert.equal(
    screen.queryByRole("heading", { name: "Stay on your schedule." }),
    null,
  );
});
