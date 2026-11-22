import assert from "node:assert/strict";
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
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

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
  fireEvent.click(
    screen.getByRole("button", { name: "Send code" }),
  );
  await waitFor(() => assert.ok(screen.getByLabelText("Six-digit code")));
  fireEvent.change(screen.getByLabelText("Six-digit code"), {
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
