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
const { render, screen, fireEvent, waitFor, cleanup } =
  await import("@testing-library/react");
const { default: BookingPlanner, hotelTime } =
  await import("../src/BookingPlanner.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
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
    assert.equal(screen.getByLabelText("Package 1 — room 1").value, "360"),
  );
  fireEvent.click(screen.getByRole("button", { name: "+ Add room" }));
  assert.equal(
    screen.getByLabelText("Category — room 2").value,
    "family_executive",
  );
  assert.equal(screen.getByLabelText("Package 1 — room 2").value, "360");
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
      assert.equal(
        screen.getByLabelText("Category — room 1").value,
        "family_executive",
      );
      assert.equal(screen.getByLabelText("Package 1 — room 1").value, "360");
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
    submitted = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        items: submitted.items.map((item, index) => ({
          ...item,
          endAt: index ? "2027-01-04T06:00:00Z" : "2027-01-01T09:00:00Z",
          baseCentavos: index ? 240000 : 20000,
          extraBedCentavos: index ? 10000 : 0,
          totalCentavos: index ? 250000 : 20000,
        })),
        totalCentavos: 270000,
      }),
    };
  };
  render(createElement(BookingPlanner));
  await waitFor(() =>
    assert.equal(screen.getByLabelText("Package 1 — room 1").value, "180"),
  );
  fireEvent.change(screen.getByLabelText("Arrival date — room 1"), {
    target: { value: "2027-01-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "+ Add room" }));
  fireEvent.change(screen.getByLabelText("Category — room 2"), {
    target: { value: "family_executive" },
  });
  fireEvent.change(screen.getByLabelText("Arrival date — room 2"), {
    target: { value: "2027-01-02" },
  });
  assert.equal(
    screen.getByLabelText("Package 1 — room 2").querySelectorAll("option")
      .length,
    1,
  );
  assert.doesNotMatch(
    screen.getByLabelText("Package 1 — room 2").textContent,
    /3 hours/,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "+ Add package block to room 2" }),
  );
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Calculate server quote" }),
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
  fireEvent.change(screen.getByLabelText("Adults — room 1"), {
    target: { value: "3" },
  });
  assert.equal(screen.queryByText("₱2,700.00"), null);
});
