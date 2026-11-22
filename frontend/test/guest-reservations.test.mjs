import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/reservations",
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
const { default: GuestReservations } =
  await import("../src/GuestReservations.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
const fixture = {
  id: "d3a00000-0000-4000-8000-000000000001",
  primaryName: "Verified guest",
  totalCentavos: 20000,
  createdAt: "2027-01-01T00:00:00Z",
  items: [
    {
      id: "room-1",
      category: "double_standard",
      startAt: "2027-01-01T06:00:00Z",
      endAt: "2027-01-01T09:00:00Z",
      totalCentavos: 20000,
      adults: 2,
      children: 0,
      state: "confirmed",
      confirmationAt: "2027-01-01T00:00:00Z",
      checkedInAt: "2027-01-01T06:00:00Z",
      blocks: [180],
    },
  ],
};
test("reservation history paginates and links to owned detail", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () =>
        Array.from({ length: 20 }, (_, i) => ({ ...fixture, id: `id-${i}` })),
    };
  };
  render(createElement(GuestReservations, { token: "token" }));
  await waitFor(() =>
    assert.equal(
      screen.getAllByRole("link", { name: "View booking" }).length,
      20,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() =>
    assert.ok(requests.some((url) => url.includes("offset=20"))),
  );
});
test("owned reservation detail shows money and prevents checked-in cancellation and reschedule", async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => fixture });
  render(
    createElement(GuestReservations, {
      token: "token",
      reservationId: fixture.id,
    }),
  );
  await waitFor(() =>
    assert.ok(screen.getByRole("heading", { name: "Reservation details" })),
  );
  await waitFor(() => assert.ok(screen.getByText("Verified guest")));
  assert.ok(screen.getByText(/This room has checked in/));
  assert.equal(
    screen.queryByRole("button", { name: /Request cancellation/i }),
    null,
  );
  assert.equal(screen.queryByText("Request a schedule change"), null);
  assert.equal(
    screen.queryByText(/confirmation is unavailable in this preview/),
    null,
  );
});

test("Hall-only detail shows item refunds and submits staff-approved extension without room mutations", async () => {
  const calls = [];
  const hall = {
    id: "hall-one",
    setup: "room",
    attendees: 12,
    startAt: "2027-03-01T00:00:00Z",
    endAt: "2027-03-01T03:00:00Z",
    totalCentavos: 300000,
    status: "confirmed",
    state: "confirmed",
    proofDeadlineAt: "2027-02-28T00:00:00Z",
    confirmationAt: new Date().toISOString(),
    refundDueCentavos: 10000,
    refundedCentavos: 5000,
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () =>
        url.endsWith("/change")
          ? { status: "requested" }
          : url.includes("cancellations")
            ? []
            : { ...fixture, items: [], hall, totalCentavos: 300000 },
    };
  };
  render(
    createElement(GuestReservations, {
      token: "guest-token",
      reservationId: fixture.id,
    }),
  );
  await waitFor(() =>
    assert.ok(
      screen.getByRole("heading", { name: /Function Hall.*Room Type/ }),
    ),
  );
  assert.match(
    screen.getByText(/Hall refund due:/).textContent,
    /100.00.*50.00/,
  );
  fireEvent.click(screen.getByText("Change hall booking"));
  fireEvent.change(screen.getByLabelText("Change type"), {
    target: { value: "extend" },
  });
  fireEvent.change(screen.getByLabelText("Additional full hours"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("Change reason"), {
    target: { value: "Longer event" },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Send request" })
      .closest("form"),
  );
  await waitFor(() =>
    assert.ok(screen.getByText(/Request sent for staff approval/)),
  );
  const change = calls.find((call) => call.url.endsWith("/change"));
  assert.equal(change.options.headers.Authorization, "Bearer guest-token");
  assert.equal(JSON.parse(change.options.body).kind, "extend");
  assert.equal(JSON.parse(change.options.body).hours, 2);
  assert.equal(
    calls.some((call) => call.url.includes("/guest/items/")),
    false,
  );
});
