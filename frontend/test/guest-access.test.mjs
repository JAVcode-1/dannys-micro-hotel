import assert from "node:assert/strict";
/* global window */
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/verify",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, waitFor, cleanup } =
  await import("@testing-library/react");
const { default: GuestAccess } = await import("../src/GuestAccess.tsx");
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
});

test("resend requests a new OTP after cooldown and clears the old digits", async () => {
  let now = originalNow();
  Date.now = () => now;
  const calls = [];
  const client = {
    auth: {
      signInWithOtp: async (value) => {
        calls.push(value);
        return { error: null };
      },
    },
  };
  render(createElement(GuestAccess, { authClient: client }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "fresh@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await waitFor(() => assert.ok(screen.getByLabelText("Digit 1 of 6")));
  fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
    target: { value: "123456" },
  });
  now += 61_000;
  await waitFor(
    () => assert.ok(screen.getByRole("button", { name: "Resend code" })),
    { timeout: 2000 },
  );
  fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
  await waitFor(() => assert.equal(calls.length, 2));
  assert.deepEqual(calls[1], {
    email: "fresh@example.test",
    options: { shouldCreateUser: true },
  });
  await waitFor(() =>
    assert.equal(screen.getByLabelText("Digit 1 of 6").value, ""),
  );
  assert.ok(screen.getByRole("button", { name: /Resend code in/ }).disabled);
});

test("provider email rate limits keep sending disabled", async () => {
  const client = {
    auth: {
      signInWithOtp: async () => ({
        error: { code: "over_email_send_rate_limit" },
      }),
    },
  };
  render(createElement(GuestAccess, { authClient: client }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "fresh@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await waitFor(() =>
    assert.ok(
      screen.getByText(
        "Too many code requests. Please wait before trying again.",
      ),
    ),
  );
  assert.ok(screen.getByRole("button", { name: /Send code in/ }).disabled);
});

test("resend is cooled down after sending and survives remount", async () => {
  let sends = 0;
  const client = {
    auth: {
      signInWithOtp: async () => {
        sends++;
        return { error: null };
      },
    },
  };
  const view = render(createElement(GuestAccess, { authClient: client }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "new@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await waitFor(() =>
    assert.ok(screen.getByRole("button", { name: /Resend code in/ }).disabled),
  );
  fireEvent.click(screen.getByRole("button", { name: /Resend code in/ }));
  assert.equal(sends, 1);
  view.unmount();
  render(createElement(GuestAccess, { authClient: client }));
  assert.ok(screen.getByRole("button", { name: /Send code in/ }).disabled);
});

test("service errors are not reported as an invalid code", async () => {
  const client = {
    auth: {
      signInWithOtp: async () => ({ error: null }),
      verifyOtp: async () => ({
        data: {},
        error: { code: "unexpected_failure", status: 500 },
      }),
    },
  };
  render(createElement(GuestAccess, { authClient: client }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "new@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await waitFor(() => assert.ok(screen.getByLabelText("Digit 1 of 6")));
  fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  await waitFor(() =>
    assert.ok(
      screen.getByText(
        "Verification is unavailable. Please try again shortly.",
      ),
    ),
  );
  assert.equal(screen.queryByText(/The code is invalid or expired/), null);
});

for (const [error, expected] of [
  [
    { code: "otp_expired", status: 403 },
    "The code is invalid or expired. Use the most recent email code or request another below.",
  ],
  [
    { code: "over_request_rate_limit", status: 429 },
    "Too many verification attempts. Please wait a few minutes before trying again.",
  ],
]) {
  test(`verification handles ${error.code} without authenticating`, async () => {
    const client = {
      auth: {
        signInWithOtp: async () => ({ error: null }),
        verifyOtp: async () => ({ data: {}, error }),
      },
    };
    render(createElement(GuestAccess, { authClient: client }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => assert.ok(screen.getByLabelText("Digit 1 of 6")));
    fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    await waitFor(() => assert.ok(screen.getByText(expected)));
    assert.equal(screen.queryByText("Email verified."), null);
  });
}

test("guest OTP verifies through Auth and Express before success", async () => {
  const calls = [];
  const client = {
    auth: {
      signInWithOtp: async (value) => {
        calls.push(value);
        return { error: null };
      },
      verifyOtp: async (value) => {
        calls.push(value);
        return {
          data: {
            session: { access_token: "verified-token" },
            user: { email: "guest@example.test" },
          },
          error: null,
        };
      },
    },
  };
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.headers.Authorization]);
    return { ok: true };
  };
  render(createElement(GuestAccess, { authClient: client }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "guest@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await waitFor(() => assert.ok(screen.getByLabelText("Digit 1 of 6")));
  fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  await waitFor(() => assert.ok(screen.getByText("Email verified.")));
  assert.deepEqual(calls[0], {
    email: "guest@example.test",
    options: { shouldCreateUser: true },
  });
  assert.deepEqual(calls[1], {
    email: "guest@example.test",
    token: "123456",
    type: "email",
  });
  assert.deepEqual(calls[2], ["/api/guest/me", "Bearer verified-token"]);
});
