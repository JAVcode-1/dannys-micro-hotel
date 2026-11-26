/* global document, Response, sessionStorage */
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
const { render, screen, cleanup, fireEvent, waitFor, within, act } =
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

for (const committed of [false, true]) {
  test(`W03 reconciles an interrupted checkout ${committed ? "that committed" : "before retrying"}`, async (t) => {
    const item = {
      id: "synthetic-room-item",
      reservation_id: "synthetic-reservation",
      channel: "walk_in",
      category_code: "double_standard",
      room_code: "Synthetic room",
      checked_in_at: "2026-11-25T00:00:00Z",
      checkout_at: "2026-11-25T03:00:00Z",
      balance_centavos: 0,
      operational_state: "occupied",
    };
    const departed = {
      ...item,
      checked_out_at: "2026-11-25T03:30:00Z",
      operational_state: "cleaning",
    };
    const attempts = [];
    let outage = false;
    let hasDeparted = false;
    let finishInterruptedCheckout;
    let finishStaleRead;
    t.mock.method(globalThis, "fetch", async (url, options) => {
      if (url.endsWith("/staff/stays")) {
        const response = outage
          ? new Response(null, { status: 500 })
          : Response.json({
              items: [hasDeparted ? departed : item],
              warningMinutes: [],
              serverNow: "2026-11-25T03:30:00Z",
              enabled: true,
            });
        if (finishInterruptedCheckout && !outage && !finishStaleRead) {
          return new Promise((resolve) => {
            finishStaleRead = () => resolve(response);
          });
        }
        return response;
      }
      assert.ok(url.endsWith(`/staff/stays/${item.id}/checkout`));
      assert.equal(options.method, "POST");
      attempts.push(JSON.parse(options.body));
      if (attempts.length === 1) {
        if (committed) {
          outage = true;
          hasDeparted = true;
          throw new TypeError("Failed to fetch");
        }
        return new Promise((resolve) => {
          finishInterruptedCheckout = () => {
            outage = true;
            resolve(new Response(null, { status: 500 }));
          };
        });
      }
      hasDeparted = true;
      return Response.json(departed);
    });

    render(createElement(App, { token: "synthetic-staff-token" }));
    const checkout = await screen.findByRole("button", {
      name: "Record checkout · Synthetic room",
    });
    fireEvent.click(checkout);
    if (!committed) {
      fireEvent.focus(dom.window);
      finishInterruptedCheckout();
    }
    await screen.findByText(/Checkout could not be confirmed/);
    if (!committed) await act(async () => finishStaleRead());
    assert.equal(checkout.disabled, true);
    assert.equal(attempts.length, 1);
    assert.ok(
      within(screen.getByLabelText("Active stays")).getByRole("heading", {
        name: /Synthetic room/,
      }),
    );

    outage = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Retry synchronization" }),
    );
    if (!committed) {
      await waitFor(() => assert.equal(checkout.disabled, false));
      assert.equal(attempts.length, 1);
      assert.ok(attempts[0].requestKey);
      fireEvent.click(checkout);
    }
    await within(screen.getByLabelText("Completed stays")).findByText(
      /Checkout recorded/,
    );
    assert.equal(attempts.length, committed ? 1 : 2);
    if (!committed) assert.deepEqual(attempts[1], attempts[0]);
  });
}
