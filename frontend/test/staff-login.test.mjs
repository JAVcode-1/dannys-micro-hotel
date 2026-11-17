import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";

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
const { default: StaffLogin } = await import("../src/StaffLogin.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
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

test("staff signs in with individual credentials and can request recovery", async () => {
  const auth = client();
  render(createElement(StaffLogin, { authClient: auth }));
  fireEvent.change(screen.getByLabelText("Email"), {
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
  render(
    createElement(StaffLogin, {
      authClient: auth,
      apiUrl: "http://localhost:3001",
    }),
  );
  await waitFor(() =>
    assert.match(screen.getByRole("status").textContent, /denied/),
  );
  assert.equal(screen.queryByText(/Signed in as/), null);
});

test("verified staff sees identity, can sign out, and recovery can update password", async () => {
  const auth = client({ access_token: "staff-token" });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ email: "one@example.test" }),
  });
  render(createElement(StaffLogin, { authClient: auth }));
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
  render(createElement(StaffLogin, { authClient: auth }));
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
  render(createElement(StaffLogin, { authClient: auth }));
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
  render(createElement(StaffLogin, { authClient: auth }));
  await waitFor(() =>
    assert.ok(screen.getByText("Signed in as first@example.test")),
  );
  act(() => auth.emit("SIGNED_IN", { access_token: "second" }));
  assert.equal(screen.queryByText("Signed in as first@example.test"), null);
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
  render(createElement(StaffLogin, { authClient: auth }));
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
  render(createElement(StaffLogin, { authClient: auth }));
  act(() => auth.emit("USER_UPDATED", null));
  await act(async () =>
    resolveInitial({ data: { session: { access_token: "stored-token" } } }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText("Signed in as stored@example.test")),
  );
});
