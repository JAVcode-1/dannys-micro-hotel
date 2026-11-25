import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/book",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, waitFor, cleanup, within } =
  await import("@testing-library/react");
const {
  default: BookingPlanner,
  hotelTime,
  bookingRequestKey,
} = await import("../src/BookingPlanner.tsx");
function roomField(label, number) {
  return within(
    screen.getByRole("region", { name: `Room ${number}` }),
  ).getByLabelText(label);
}
const originalFetch = globalThis.fetch;
const { GuestSessionProvider } = await import("../src/GuestSession.tsx");
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  dom.window.sessionStorage.clear();
});
test("lost booking responses recover the same command across reload without storing contact data", async () => {
  const body = JSON.stringify({
    primaryName: "Private Name",
    contact: { phone: "09170000000" },
    expectedTotalCentavos: 20000,
  });
  const first = await bookingRequestKey(
    "guest-one",
    body,
    dom.window.sessionStorage,
  );
  const recovered = await bookingRequestKey(
    "guest-one",
    body,
    dom.window.sessionStorage,
  );
  assert.equal(first, recovered);
  assert.doesNotMatch(
    dom.window.sessionStorage.getItem("staytrack.booking-command.v1"),
    /Private Name|09170000000|guest-one/,
  );
  assert.notEqual(
    await bookingRequestKey("guest-two", body, dom.window.sessionStorage),
    first,
  );
  assert.notEqual(
    await bookingRequestKey(
      "guest-one",
      body.replace("20000", "30000"),
      dom.window.sessionStorage,
    ),
    first,
  );
});
test("verified guest submits reviewed server price, contact, acknowledgement and retries the same hold", async () => {
  const holds = [];
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "guest-token" } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  };
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/guest/me"))
      return {
        ok: true,
        json: async () => ({
          id: "verified-guest",
          email: "guest@example.test",
        }),
      };
    if (url.endsWith("/guest/booking-status"))
      return {
        ok: true,
        json: async () => ({
          enabled: true,
          policy: { version: "booking-v1", text: "Synthetic disclosed policy" },
        }),
      };
    if (url.endsWith("/catalog"))
      return {
        ok: true,
        json: async () => [
          {
            code: "double_standard",
            name: "Double Standard",
            duration_minutes: 180,
            price_centavos: 20000,
          },
        ],
      };
    const body = JSON.parse(options.body);
    if (url.endsWith("/availability"))
      return {
        ok: true,
        json: async () => ({
          available: true,
          quote: {
            items: body.items.map((item) => ({
              ...item,
              endAt: "2027-01-01T09:00:00Z",
              baseCentavos: 20000,
              extraBedCentavos: 0,
              totalCentavos: 20000,
            })),
            totalCentavos: 20000,
          },
        }),
      };
    if (url.endsWith("/guest/reservations")) {
      holds.push({ body, authorization: options.headers.Authorization });
      throw new Error("Lost response: retry to recover");
    }
    throw new Error("Unexpected request " + url);
  };
  render(
    createElement(
      GuestSessionProvider,
      { authClient: client },
      createElement(BookingPlanner),
    ),
  );
  await waitFor(() => assert.ok(screen.getByLabelText("Primary guest name")));
  fireEvent.change(roomField("Arrival date", 1), {
    target: { value: "2027-01-01" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Check availability & price" }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText("₱200.00", { selector: "p.text-3xl" })),
  );
  const policySection = screen.getByRole("region", {
    name: "Booking policies",
  });
  const policiesToggle = within(policySection).getByRole("button", {
    name: /^Show/,
  });
  assert.equal(policiesToggle.getAttribute("aria-expanded"), "false");
  const policiesContent = globalThis.document.getElementById(
    policiesToggle.getAttribute("aria-controls"),
  );
  assert.equal(policiesContent.hidden, true);
  fireEvent.click(policiesToggle);
  assert.equal(policiesContent.hidden, false);
  fireEvent.click(within(policySection).getByRole("button", { name: /^Hide/ }));
  assert.equal(policiesContent.hidden, true);
  fireEvent.change(screen.getByLabelText("Primary guest name"), {
    target: { value: "Synthetic Guest" },
  });
  fireEvent.change(screen.getByLabelText("Contact number"), {
    target: { value: "09170000000" },
  });
  fireEvent.click(
    screen.getByLabelText("I have read and acknowledge the booking policies."),
  );
  const submit = screen.getByRole("button", {
    name: "Continue to GCash payment",
  });
  fireEvent.submit(submit.closest("form"));
  await waitFor(() => assert.equal(holds.length, 1));
  await waitFor(() => assert.equal(submit.disabled, false));
  fireEvent.submit(submit.closest("form"));
  await waitFor(() => assert.equal(holds.length, 2));
  assert.equal(holds[0].authorization, "Bearer guest-token");
  assert.equal(holds[0].body.expectedTotalCentavos, 20000);
  assert.deepEqual(holds[0].body.contact, {
    phone: "09170000000",
    policyVersion: "booking-v1",
    policyAcknowledged: true,
  });
  assert.equal(holds[0].body.requestKey, holds[1].body.requestKey);
});

test("booking selections survive verification navigation and reload without trusting a saved quote", async () => {
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith("/catalog")
        ? [
            {
              code: "double_standard",
              name: "Double Standard",
              duration_minutes: 180,
              price_centavos: 20000,
            },
          ]
        : { enabled: false },
  });
  const view = render(createElement(BookingPlanner));
  await waitFor(() =>
    assert.equal(roomField("How long will you stay?", 1).value, "180"),
  );
  fireEvent.change(roomField("Arrival date", 1), {
    target: { value: "2027-02-01" },
  });
  fireEvent.change(roomField("Adults", 1), {
    target: { value: "4" },
  });
  view.unmount();
  render(createElement(BookingPlanner));
  await waitFor(() =>
    assert.equal(roomField("Arrival date", 1).value, "2027-02-01"),
  );
  assert.equal(roomField("Adults", 1).value, "4");
  assert.equal(screen.queryByText("₱200.00"), null);
});

test("new rooms use an active package when Standard is unavailable", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        code: "family_executive",
        name: "Family Executive",
        duration_minutes: 360,
        price_centavos: 60000,
      },
    ],
  });
  render(createElement(BookingPlanner));
  await waitFor(() =>
    assert.equal(roomField("How long will you stay?", 1).value, "360"),
  );
  fireEvent.click(screen.getByRole("button", { name: "+ Add room" }));
  assert.equal(roomField("Room type", 2).value, "family_executive");
  assert.equal(roomField("How long will you stay?", 2).value, "360");
});

test("landing room choice selects a matching active package on arrival", async () => {
  dom.window.history.replaceState(null, "", "/book?category=family_executive");
  globalThis.fetch = async () => ({
    ok: true,
    json: async () =>
      [
        ["double_standard", "Double Standard", 180, 20000],
        ["family_executive", "Family Executive", 720, 90000],
        ["family_executive", "Family Executive", 360, 60000],
      ].map(([code, name, duration_minutes, price_centavos]) => ({
        code,
        name,
        duration_minutes,
        price_centavos,
      })),
  });
  try {
    render(createElement(BookingPlanner));
    await waitFor(() => {
      assert.equal(roomField("Room type", 1).value, "family_executive");
      assert.equal(roomField("How long will you stay?", 1).value, "360");
    });
  } finally {
    dom.window.history.replaceState(null, "", "/book");
  }
});

test("hotel display converts UTC to Manila and always includes AM/PM", () => {
  assert.match(hotelTime("2027-01-01T17:00:00Z"), /Jan 2, 2027.*1:00 AM/);
});

test("guest can add independently scheduled Family room, repeat blocks and receive server quote", async () => {
  let submitted;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/catalog"))
      return {
        ok: true,
        json: async () => [
          {
            code: "double_standard",
            name: "Double Standard",
            duration_minutes: 180,
            price_centavos: 20000,
          },
          {
            code: "family_executive",
            name: "Family Executive",
            duration_minutes: 1440,
            price_centavos: 120000,
          },
        ],
      };
    if (url.endsWith("/guest/booking-status"))
      return { ok: true, json: async () => ({ enabled: false }) };
    assert.ok(url.endsWith("/availability"));
    submitted = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        available: true,
        quote: {
          items: submitted.items.map((item, index) => ({
            ...item,
            endAt: index ? "2027-01-04T06:00:00Z" : "2027-01-01T09:00:00Z",
            baseCentavos: index ? 240000 : 20000,
            extraBedCentavos: index ? 10000 : 0,
            totalCentavos: index ? 250000 : 20000,
          })),
          totalCentavos: 270000,
        },
      }),
    };
  };
  render(createElement(BookingPlanner));
  await waitFor(() =>
    assert.equal(roomField("How long will you stay?", 1).value, "180"),
  );
  fireEvent.change(roomField("Arrival date", 1), {
    target: { value: "2027-01-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "+ Add room" }));
  fireEvent.change(roomField("Room type", 2), {
    target: { value: "family_executive" },
  });
  fireEvent.change(roomField("Arrival date", 2), {
    target: { value: "2027-01-02" },
  });
  assert.equal(
    roomField("How long will you stay?", 2).querySelectorAll("option").length,
    1,
  );
  assert.doesNotMatch(
    roomField("How long will you stay?", 2).textContent,
    /3 hours/,
  );
  fireEvent.click(screen.getAllByRole("button", { name: "+ Add time" })[1]);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Check availability & price" }),
  );
  await waitFor(() => assert.ok(screen.getByText("₱2,700.00")));
  assert.equal(submitted.items[0].startAt, "2027-01-01T14:00:00+08:00");
  assert.equal(submitted.items[1].startAt, "2027-01-02T14:00:00+08:00");
  assert.deepEqual(submitted.items[1].blocks, [1440, 1440]);
  assert.equal(submitted.items[1].extraBed, true);
  assert.equal(
    screen.getByRole("button", { name: "Booking not open" }).disabled,
    true,
  );
  fireEvent.change(roomField("Adults", 1), {
    target: { value: "3" },
  });
  assert.equal(screen.queryByText("₱2,700.00"), null);
});

test("explicit Hall setup entry overrides saved room and Hall selections", async () => {
  dom.window.history.replaceState(null, "", "/book?service=hall&setup=room");
  dom.window.sessionStorage.setItem(
    "staytrack.hall-selections.v1",
    JSON.stringify({
      setup: "theater",
      date: "2027-03-01",
      hour: "8",
      minute: "00",
      period: "AM",
      minutes: 180,
      attendees: 3,
      requests: "",
    }),
  );
  dom.window.sessionStorage.setItem(
    "staytrack.booking-selections.v1",
    JSON.stringify([
      {
        id: 1,
        category: "double_standard",
        date: "2027-03-01",
        hour: "2",
        minute: "00",
        period: "PM",
        blocks: [180],
        adults: 2,
        children: 0,
        extraBed: false,
      },
    ]),
  );
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith("/catalog")
        ? [
            {
              code: "double_standard",
              name: "Double Standard",
              duration_minutes: 180,
              price_centavos: 20000,
            },
          ]
        : { enabled: false },
  });
  try {
    render(createElement(BookingPlanner, { hallEnabled: true }));
    await waitFor(() =>
      assert.equal(screen.getByLabelText("Hall setup").value, "room"),
    );
    assert.equal(screen.queryByRole("region", { name: "Room 1" }), null);
  } finally {
    dom.window.history.replaceState(null, "", "/book");
  }
});

test("Hall-only quote sends independent schedule and renders combined authoritative price", async () => {
  dom.window.history.replaceState(null, "", "/book?service=hall&setup=theater");
  let payload;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/catalog"))
      return {
        ok: true,
        json: async () => [
          {
            code: "double_standard",
            name: "Double Standard",
            duration_minutes: 180,
            price_centavos: 20000,
          },
        ],
      };
    if (url.endsWith("/guest/booking-status"))
      return { ok: true, json: async () => ({ enabled: false }) };
    if (url.endsWith("/guest/hall-status"))
      return { ok: true, json: async () => ({ status: "available" }) };
    assert.ok(url.endsWith("/availability"));
    payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        available: true,
        hallAvailable: true,
        quote: {
          items: [],
          hall: {
            setup: "theater",
            attendees: 1,
            minutes: 180,
            start: "2027-03-01T00:00:00Z",
            end: "2027-03-01T03:00:00Z",
            base: 300000,
            additional: 0,
            total: 300000,
          },
          totalCentavos: 300000,
        },
      }),
    };
  };
  try {
    render(createElement(BookingPlanner, { hallEnabled: true }));
    fireEvent.change(screen.getByLabelText("Event date"), {
      target: { value: "2027-03-01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Check availability & price" }),
    );
    await waitFor(() =>
      assert.ok(screen.getByText("₱3,000.00", { selector: "p.text-3xl" })),
    );
    assert.deepEqual(payload.items, []);
    assert.equal(payload.hall.start, "2027-03-01T08:00");
    assert.equal(payload.hall.setup, "theater");
    fireEvent.change(screen.getByLabelText("Number of attendees"), {
      target: { value: "2" },
    });
    assert.equal(
      screen.queryByText("₱3,000.00", { selector: "p.text-3xl" }),
      null,
    );
  } finally {
    dom.window.history.replaceState(null, "", "/book");
  }
});
