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
const { default: App } = await import("../src/StayMonitor.tsx");
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
test("W03 synthetic preview keeps overdue occupied, requires unpaid reason and departs only one room", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-11-25T00:00:00Z"),
  });
  const mounted = render(createElement(App));
  assert.ok(screen.getByRole("heading", { name: "Stays and checkout" }));
  assert.ok(screen.getByText(/Package expired/));
  assert.ok(screen.getByText(/not actual hotel room identifiers/));
  const otherRooms = () =>
    [...document.querySelectorAll("article")]
      .filter((article) =>
        /Synthetic fixture [BC]/.test(article.querySelector("h3").textContent),
      )
      .map((article) => article.textContent);
  const original = otherRooms();
  assert.equal(original.length, 2);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Record checkout · Synthetic fixture A",
    }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText(/Settle the reservation balance or document/)),
  );
  fireEvent.change(
    screen.getByLabelText(
      "Unpaid-departure exception reason · Synthetic fixture A",
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
      name: "Record checkout · Synthetic fixture A",
    }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText(/Unpaid-departure exception recorded/)),
  );
  assert.deepEqual(otherRooms(), original);
  assert.ok(
    screen.getByRole("button", {
      name: "Record checkout · Synthetic fixture B",
    }),
  );
  mounted.unmount();
  render(createElement(App));
  assert.ok(screen.getByText(/Unpaid-departure exception recorded/));
  assert.ok(screen.getByText(/Package expired/));
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
