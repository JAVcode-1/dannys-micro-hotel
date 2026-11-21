import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/staff/reservations/reservation",
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
const { StaffReservationDetail } = await import("../src/StaffReservations.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
const fixture = {
  reservation: {
    id: "reservation",
    primaryName: "Synthetic guest",
    channel: "online",
    createdAt: "2027-01-01T00:00:00Z",
    totalCentavos: 40000,
  },
  rescheduleEnabled: true,
  items: [
    {
      id: "item-one",
      category: "double_standard",
      startAt: "2027-01-02T06:00:00Z",
      endAt: "2027-01-02T09:00:00Z",
      status: "Confirmed",
      state: "confirmed",
      adults: 2,
      children: 0,
      blocks: [180],
      scheduleRevision: 7,
      confirmationAt: "2026-11-21T00:00:00Z",
      pendingReschedule: false,
      checkedInAt: null,
    },
    {
      id: "item-two",
      category: "double_standard",
      startAt: "2027-01-02T06:00:00Z",
      endAt: "2027-01-02T09:00:00Z",
      status: "Checked in",
      state: "confirmed",
      adults: 2,
      children: 0,
      blocks: [180],
      scheduleRevision: 2,
      checkedInAt: "2027-01-02T06:00:00Z",
    },
  ],
  financials: {
    netChargeCentavos: 40000,
    collectedCentavos: 40000,
    settlementDueCentavos: 0,
    refundDueCentavos: 0,
  },
  payments: [],
  refunds: [],
};
function view() {
  render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/staff/reservations/reservation"] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/staff/reservations/:id",
          element: createElement(StaffReservationDetail, { token: "staff" }),
        }),
      ),
    ),
  );
}
test("staff requests a reschedule for one eligible room without changing its sibling", async () => {
  let submitted;
  globalThis.fetch = async (url, options) => {
    if (options?.method === "POST") {
      submitted = {
        url,
        body: JSON.parse(options.body),
        authorization: options.headers.Authorization,
      };
      return { ok: true, json: async () => ({ id: "request" }) };
    }
    return { ok: true, json: async () => fixture };
  };
  view();
  await waitFor(() =>
    assert.ok(screen.getByText("Request a schedule change for this room")),
  );
  fireEvent.click(screen.getByText("Request a schedule change for this room"));
  fireEvent.change(screen.getByLabelText("Arrival date - item-one"), {
    target: { value: "2027-01-03" },
  });
  fireEvent.change(screen.getByLabelText("Request reason - item-one"), {
    target: { value: "Guest asked staff to move one room" },
  });
  fireEvent.submit(
    screen.getByLabelText("Request reason - item-one").closest("form"),
  );
  await waitFor(() => assert.ok(submitted));
  assert.equal(submitted.url, "/api/staff/reschedules/item-one/request");
  assert.equal(submitted.authorization, "Bearer staff");
  assert.equal(submitted.body.expectedRevision, 7);
  assert.equal(submitted.body.startAt, "2027-01-03T14:00:00+08:00");
  assert.equal(screen.queryByLabelText("Arrival date - item-two"), null);
  assert.ok(screen.getByText(/original schedule remains active/));
});
test("closed production workspace explains why no assisted reschedule can be created", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ...fixture, rescheduleEnabled: false }),
  });
  view();
  await waitFor(() =>
    assert.equal(
      screen.getAllByText(/Reschedule requests are closed/).length,
      2,
    ),
  );
  assert.equal(
    screen.queryByText("Request a schedule change for this room"),
    null,
  );
});
