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
const { GuestRefundIssue } = await import("../src/RefundIssue.tsx");
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

test("a guest can report the PHP amount they received and see the open refund report", async () => {
  const originalFetch = globalThis.fetch;
  const submitted = [];
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/guest\/refund-issues\/hall\/test-item$/);
    if (options.method !== "POST")
      return globalThis.Response.json({ issue: null });
    const issue = JSON.parse(options.body);
    submitted.push(issue);
    return globalThis.Response.json({
      issue: { ...issue, status: "open", resolution: null },
    });
  };
  try {
    render(
      createElement(GuestRefundIssue, {
        token: "guest",
        kind: "hall",
        itemId: "test-item",
      }),
    );
    const details = screen
      .getByText("Report a refund problem")
      .closest("details");
    details.open = true;
    fireEvent(details, new dom.window.Event("toggle"));
    fireEvent.change(
      await screen.findByLabelText("Amount you received (PHP)"),
      { target: { value: "2000.50" } },
    );
    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "Only one transfer arrived." },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Send refund report" })
        .closest("form"),
    );
    assert.ok(await screen.findByText(/Awaiting staff review/));
    assert.deepEqual(submitted, [
      { receivedCentavos: 200050, details: "Only one transfer arrived." },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
  await waitFor(() => assert.ok(screen.getByText("Eligible")));
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
  await waitFor(() => assert.ok(screen.getByText(/Cancelled; refund due/i)));
  assert.deepEqual(peers(), before);
  assert.ok(screen.getByText(/No money is transferred/));
  assert.ok(
    screen.getByRole("button", {
      name: "Verify payer and claim processing - Synthetic item A",
    }),
  );
});

test("a partial room refund keeps its unpaid balance open for another transfer", async () => {
  sessionStorage.setItem(
    "staytrack-x01-preview",
    JSON.stringify([
      {
        id: "Synthetic item A",
        reservationId: "Synthetic reservation",
        channel: "online",
        category: "double_standard",
        startAt: "2026-12-01T06:00:00.000Z",
        endAt: "2026-12-01T09:00:00.000Z",
        requestedAt: "2026-11-25T02:00:00.000Z",
        originalCentavos: 300000,
        eligibility: "eligible",
        approved: true,
        refundCentavos: 300000,
        refundStatus: "processing",
        balanceCentavos: -300000,
        refundDueCentavos: 300000,
        refundedCentavos: 0,
        remainingRefundCentavos: 300000,
        netChargeCentavos: 0,
        claimedBy: "Synthetic staff",
        transferHistory: [],
      },
    ]),
  );
  render(createElement(CancellationDesk));
  assert.ok(screen.getByText(/Still due ₱3,000\.00/));
  fireEvent.change(screen.getByLabelText("Actual amount sent (PHP)"), {
    target: { value: "2000" },
  });
  fireEvent.change(screen.getByLabelText("Actual transfer reference"), {
    target: { value: "SYNTHETICREF001" },
  });
  fireEvent.change(
    screen.getByLabelText("Actual transfer time (Manila) date"),
    {
      target: { value: "2026-11-25" },
    },
  );
  fireEvent.click(
    screen.getByLabelText("Actual outgoing GCash transfer verified"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Record transfer - Synthetic item A" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm transfer" }));
  await waitFor(() =>
    assert.ok(screen.getByText(/Refunded ₱2,000\.00.*Still due ₱1,000\.00/)),
  );
  assert.ok(
    screen.getByRole("button", { name: "Record transfer - Synthetic item A" }),
  );
});
