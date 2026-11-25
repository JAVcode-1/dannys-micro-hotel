/* global document */
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff/reschedule-preview",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, cleanup, fireEvent, waitFor } =
  await import("@testing-library/react");
const {
  default: RescheduleDesk,
  GuestRescheduleForm,
  ReschedulePreview,
} = await import("../src/RescheduleDesk.tsx");
afterEach(cleanup);
test("X02 preview approves one item, preserving sibling and showing original deadline", async () => {
  render(createElement(ReschedulePreview));
  const before = document.querySelectorAll("article")[1].textContent;
  fireEvent.change(
    screen.getByLabelText("Decision reason - Synthetic item A"),
    { target: { value: "Confirmed guest request" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Approve - Synthetic item A" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm approval" }));
  await waitFor(() => assert.ok(screen.getByText("Approved schedule move")));
  assert.equal(document.querySelectorAll("article")[1].textContent, before);
  assert.ok(screen.getAllByText(/Original cancellation deadline/).length);
  fireEvent.change(
    screen.getByLabelText("Decision reason - Synthetic item B"),
    { target: { value: "Reviewed policy pending" } },
  );
  assert.equal(
    screen.getByRole("button", { name: "Reject - Synthetic item B" }).disabled,
    false,
  );
  assert.equal(
    screen.getByRole("button", { name: "Approve - Synthetic item B" }).disabled,
    true,
  );
  assert.ok(screen.getByText(/Proposal only/));
});
test("X02 guest form isolates item state and preserves inputs on conflict", async () => {
  const props = {
    revision: 0,
    startAt: "2027-01-01T02:00:00Z",
    endAt: "2027-01-01T08:00:00Z",
    blocks: [360],
    confirmationAt: "2026-11-19T02:00:00Z",
    refresh: async () => ({
      revision: 0,
      startAt: "2027-01-01T02:00:00Z",
      endAt: "2027-01-01T08:00:00Z",
      confirmationAt: "2026-11-19T02:00:00Z",
      pending: false,
    }),
    submit: async () => {
      throw new Error("Schedule changed. Refresh and review again.");
    },
  };
  render(
    createElement(
      "div",
      null,
      createElement(GuestRescheduleForm, { ...props, itemId: "A" }),
      createElement(GuestRescheduleForm, { ...props, itemId: "B" }),
    ),
  );
  const peer = screen.getByLabelText("Arrival date - B").value;
  fireEvent.change(screen.getByLabelText("Arrival date - A"), {
    target: { value: "2027-01-02" },
  });
  fireEvent.change(screen.getByLabelText("Note for staff - A"), {
    target: { value: "New arrival" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send request - A" }));
  await waitFor(() => assert.ok(screen.getByRole("alert")));
  assert.equal(screen.getByLabelText("Arrival date - A").value, "2027-01-02");
  assert.equal(screen.getByLabelText("Arrival date - B").value, peer);
  assert.equal(
    screen.getByRole("button", { name: "Send request - A" }).disabled,
    true,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh reservation - A" }),
  );
  await waitFor(() =>
    assert.equal(
      screen.getByRole("button", { name: "Send request - A" }).disabled,
      false,
    ),
  );
  assert.equal(screen.getByLabelText("Arrival date - A").value, "2027-01-02");
  assert.equal(screen.getByLabelText("Arrival date - B").value, peer);
});

test("X02 staff refresh preserves both drafts and disables newly blocked approval", async () => {
  const originalFetch = globalThis.fetch;
  let reads = 0;
  const row = {
    id: "request A",
    roomBookingId: "A",
    expectedRevision: 0,
    originalStartAt: "2027-01-01T02:00:00Z",
    originalEndAt: "2027-01-01T08:00:00Z",
    requestedStartAt: "2027-01-02T02:00:00Z",
    requestedEndAt: "2027-01-02T08:00:00Z",
    eligibility: "eligible",
    approved: null,
    originalCentavos: 40000,
    proposalDeltaCentavos: null,
    proposalStatus: null,
    confirmationAt: "2026-11-19T02:00:00Z",
    cancellationDeadlineAt: "2026-11-19T03:00:00Z",
    currentStartAt: "2027-01-01T02:00:00Z",
    currentEndAt: "2027-01-01T08:00:00Z",
    currentRevision: 0,
    blocks: [360],
    originalBlocks: [360],
    reason: "Guest changed arrival",
    canApprove: true,
    blocker: null,
  };
  globalThis.fetch = async () =>
    new globalThis.Response(
      JSON.stringify({
        enabled: true,
        items: [
          {
            ...row,
            canApprove: ++reads === 1,
            blocker: reads === 1 ? null : "Room has checked in",
          },
          { ...row, id: "request B" },
        ],
      }),
      { status: 200 },
    );
  try {
    render(createElement(RescheduleDesk, { token: "synthetic-staff" }));
    await waitFor(() =>
      assert.ok(screen.getByLabelText("Decision reason - request A")),
    );
    fireEvent.change(screen.getByLabelText("Decision reason - request A"), {
      target: { value: "Preserve first draft" },
    });
    fireEvent.change(screen.getByLabelText("Decision reason - request B"), {
      target: { value: "Preserve second draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refresh requests" }));
    await waitFor(() => assert.ok(screen.getByText("Room has checked in")));
    assert.equal(
      screen.getByLabelText("Decision reason - request A").value,
      "Preserve first draft",
    );
    assert.equal(
      screen.getByLabelText("Decision reason - request B").value,
      "Preserve second draft",
    );
    assert.equal(
      screen.getByRole("button", { name: "Approve - request A" }).disabled,
      true,
    );
    assert.equal(
      screen.getByRole("button", { name: "Reject - request A" }).disabled,
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("X02 guest can correct the arrival time and send without a note", async () => {
  let submitted;
  render(
    createElement(GuestRescheduleForm, {
      itemId: "A",
      revision: 0,
      startAt: "2099-01-01T02:00:00Z",
      blocks: [360],
      submit: async (input) => {
        submitted = input;
      },
    }),
  );
  fireEvent.change(screen.getByLabelText("Arrival time - A"), {
    target: { value: "14:90" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send request - A" }));
  assert.ok(screen.getByText("Enter a time such as 2:30."));
  assert.equal(submitted, undefined);
  fireEvent.change(screen.getByLabelText("Arrival time - A"), {
    target: { value: "11:15" },
  });
  assert.ok(screen.getByText("New checkout:"));
  fireEvent.click(screen.getByRole("button", { name: "Send request - A" }));
  await screen.findByText("Awaiting staff approval");
  assert.deepEqual(submitted.blocks, [360]);
  assert.equal(submitted.startAt, "2099-01-01T11:15:00+08:00");
  assert.equal(submitted.endAt, "2099-01-01T09:15:00.000Z");
  assert.ok(submitted.reason);
});
