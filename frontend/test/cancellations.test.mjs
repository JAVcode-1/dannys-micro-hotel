/* global document, sessionStorage */
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff/cancellation-preview",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.sessionStorage = dom.window.sessionStorage;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, cleanup, fireEvent, waitFor } =
  await import("@testing-library/react");
const { default: CancellationDesk } =
  await import("../src/CancellationDesk.tsx");
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
test("X01 preview requests, approves only one room and leaves manual refund due", async () => {
  render(createElement(CancellationDesk));
  const peers = () =>
    [...document.querySelectorAll("article")]
      .slice(1)
      .map((e) => e.textContent);
  const before = peers();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Request cancellation - Synthetic item A",
    }),
  );
  await waitFor(() => assert.ok(screen.getByText("eligible")));
  fireEvent.change(
    screen.getByLabelText("Decision reason - Synthetic item A"),
    { target: { value: "Synthetic guest request confirmed" } },
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Approve cancellation - Synthetic item A",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm approve" }));
  await waitFor(() => assert.ok(screen.getByText(/Cancelled; refund due/)));
  assert.deepEqual(peers(), before);
  assert.ok(screen.getByText(/No money is transferred/));
  assert.ok(
    screen.getByRole("button", {
      name: "Verify payer and claim processing - Synthetic item A",
    }),
  );
});
