/* global document, sessionStorage */
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/staff/stay-preview",
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
const { default: App } = await import("../src/App.tsx");
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
test("W03 synthetic preview keeps overdue occupied, requires unpaid reason and departs only one room", async () => {
  const mounted = render(createElement(App));
  assert.ok(
    screen.getByRole("heading", { name: "Stay countdown and checkout" }),
  );
  assert.ok(screen.getByText(/Overdue/));
  assert.ok(screen.getByText(/not actual hotel room identifiers/));
  const original = JSON.stringify(
    [...document.querySelectorAll("article")]
      .slice(1)
      .map((e) => e.textContent),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Record checkout � Synthetic fixture A",
    }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText(/Settle the reservation balance or document/)),
  );
  fireEvent.change(
    screen.getByLabelText(
      "Unpaid-departure exception reason � Synthetic fixture A",
    ),
    {
      target: {
        value:
          "Synthetic unpaid departure: staff will reconcile remaining debt.",
      },
    },
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Record checkout � Synthetic fixture A",
    }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText(/Unpaid-departure exception recorded/)),
  );
  assert.equal(
    JSON.stringify(
      [...document.querySelectorAll("article")]
        .slice(1)
        .map((e) => e.textContent),
    ),
    original,
  );
  assert.ok(
    screen.getByRole("button", {
      name: "Record checkout � Synthetic fixture B",
    }),
  );
  mounted.unmount();
  render(createElement(App));
  assert.ok(screen.getByText(/Unpaid-departure exception recorded/));
  assert.ok(screen.getByText(/Overdue/));
});

test("W03 preview persists checkout timestamps before any departure on reload", () => {
  const mounted = render(createElement(App));
  const original = JSON.parse(sessionStorage.getItem("staytrack-w03-preview"));
  assert.equal(original.length, 3);
  mounted.unmount();
  render(createElement(App));
  assert.deepEqual(
    JSON.parse(sessionStorage.getItem("staytrack-w03-preview")),
    original,
  );
});
