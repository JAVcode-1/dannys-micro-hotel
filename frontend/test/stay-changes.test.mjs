/* global document, fetch */
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff/stay-changes",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, cleanup, fireEvent, waitFor, within, act } =
  await import("@testing-library/react");
const { default: Desk, StayChangesPreview } =
  await import("../src/StayChangesDesk.tsx");
const originalFetch = fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
const row = (id) => ({
  id,
  reservationId: "reservation-" + id,
  category: "double_standard",
  channel: "walk_in",
  roomCode: "SYNTHETIC " + id,
  originalCheckoutAt: "2027-01-01T09:00:00Z",
  effectiveCheckoutAt: "2027-01-01T09:00:00Z",
  revision: 0,
  checkedOut: false,
  financials: {
    originalCentavos: 60000,
    netChargeCentavos: 60000,
    collectedCentavos: 45000,
    balanceCentavos: 15000,
    settlementDueCentavos: 30000,
    refundDueCentavos: 0,
    unallocatedX03Centavos: 0,
    pendingExtensionFundsCentavos: 15000,
  },
  extensions: [],
  receipts: [],
  allocations: [],
  charges: [],
  reviews: [],
});
test("X03 synthetic preview shows extension funding without overtime review", () => {
  render(createElement(StayChangesPreview));
  assert.ok(screen.getByText(/Synthetic preview/));
  screen.getByText("Extend this stay").closest("details").open = true;
  assert.equal(screen.queryByText("Overtime review"), null);
  assert.ok(screen.getByText("Charges and payment breakdown"));
  assert.ok(screen.getByText("Pending extension funds"));
  assert.ok(screen.getByText("Remaining balance"));
  assert.ok(screen.getByText("Minimum to approve"));
  assert.equal(
    screen.getByRole("button", { name: "Approve funded extension" }).disabled,
    true,
  );
});
test("X03 extension drafts stay independent after a failed quote and refresh", async () => {
  let posts = 0;
  globalThis.fetch = async (_url, options) =>
    options?.method === "POST"
      ? (posts++,
        {
          ok: false,
          json: async () => ({ error: "Conflict: refresh and reconcile" }),
        })
      : {
          ok: true,
          json: async () => ({ items: [row("A"), row("B")], enabled: true }),
        };
  render(createElement(Desk, { token: "synthetic-token" }));
  await waitFor(() =>
    assert.equal(document.querySelectorAll("article").length, 2),
  );
  let cards = document.querySelectorAll("article");
  for (const card of cards) {
    within(card).getByText("Extend this stay").closest("details").open = true;
  }
  fireEvent.change(within(cards[0]).getByLabelText("Additional stay length"), {
    target: { value: "360" },
  });
  fireEvent.change(within(cards[1]).getByLabelText("Additional stay length"), {
    target: { value: "720" },
  });
  fireEvent.click(
    within(cards[0]).getByRole("button", { name: "Request extension quote" }),
  );
  await waitFor(() => assert.equal(posts, 1));
  await screen.findByText("Conflict: refresh and reconcile");
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh current stays" }),
    );
  });
  cards = document.querySelectorAll("article");
  assert.equal(
    within(cards[0]).getByLabelText("Additional stay length").value,
    "360",
  );
  assert.equal(
    within(cards[1]).getByLabelText("Additional stay length").value,
    "720",
  );
  assert.equal(
    within(cards[1]).getByRole("button", { name: "Request extension quote" })
      .disabled,
    false,
  );
});
