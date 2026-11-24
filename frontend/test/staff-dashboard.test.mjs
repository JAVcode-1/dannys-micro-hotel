import assert from "node:assert/strict";
/* global window */
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { MemoryRouter, Routes, Route, useOutletContext } from "react-router";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, waitFor, cleanup, fireEvent } =
  await import("@testing-library/react");
const { StaffDashboard } = await import("../src/StaffReservations.tsx");
const { default: StaffWorkspaceLayout } =
  await import("../src/StaffWorkspaceLayout.tsx");
const originalFetch = globalThis.fetch;
const originalMatchMedia = window.matchMedia;
const { default: StaffMobileNavigation } =
  await import("../src/StaffMobileNavigation.tsx");
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.matchMedia = originalMatchMedia;
});

test("mobile navigation keeps Today centered and closes accessible fan actions on Escape and scrim", () => {
  window.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
  const groups = [
    "Front desk",
    "Property",
    "Booking changes",
    "Management",
  ].map((label) => ({
    label,
    icon: "rooms",
    entries: [{ path: "/staff/rooms", label: "Rooms", icon: "rooms" }],
  }));
  render(
    createElement(
      MemoryRouter,
      null,
      createElement(StaffMobileNavigation, { groups }),
    ),
  );
  assert.deepEqual(
    Array.from(globalThis.document.querySelector(".staff-bottom-bar").children)
      .slice(0, 5)
      .map((node) => node.textContent),
    ["Front desk", "Property", "Today", "Changes", "Management"],
  );
  assert.equal(screen.queryByRole("link", { name: "Overview" }), null);
  const trigger = screen.getByRole("button", {
    name: "Open Today navigation actions",
  });
  fireEvent.click(trigger);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(
    screen.getByRole("link", { name: "Overview" }).getAttribute("href"),
    "/staff",
  );
  assert.ok(screen.getByRole("link", { name: "Check-in" }));
  assert.ok(screen.getByRole("link", { name: "Walk-in" }));
  fireEvent.keyDown(window, { key: "Escape" });
  assert.ok(globalThis.document.activeElement === trigger);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(screen.queryByRole("link", { name: "Overview" }), null);
  assert.equal(
    globalThis.document.querySelector('.staff-mobile-action[href="/staff"]')
      .tabIndex,
    -1,
  );
  fireEvent.click(trigger);
  fireEvent.click(
    screen.getByRole("button", { name: "Close navigation actions" }),
  );
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("link", { name: "Overview" }));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("mobile overflow keeps every permitted destination and sign-out reachable", async () => {
  window.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
  let signOuts = 0;
  const groups = [
    "Front desk",
    "Property",
    "Booking changes",
    "Management",
  ].map((label) => ({
    label,
    icon: "settings",
    entries:
      label === "Management"
        ? ["analytics", "audit", "settings/catalog", "settings"].map(
            (path) => ({
              path: `/staff/${path}`,
              label: path,
              icon: "settings",
            }),
          )
        : [],
  }));
  render(
    createElement(
      MemoryRouter,
      null,
      createElement(StaffMobileNavigation, {
        groups,
        identity: "Test staff",
        onSignOut: () => signOuts++,
      }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Management" }));
  fireEvent.click(screen.getByRole("button", { name: "All options" }));
  assert.ok(screen.getByRole("link", { name: "settings/catalog" }));
  assert.ok(screen.getByRole("link", { name: "settings" }));
  assert.equal(screen.queryByRole("link", { name: "Reviews" }), null);
  assert.ok(
    globalThis.document.activeElement ===
      screen.getByRole("link", { name: "analytics" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  assert.ok(
    globalThis.document.activeElement ===
      screen.getByRole("button", { name: "All options" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "All options" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => assert.equal(signOuts, 1));
  assert.equal(
    screen
      .getByRole("button", { name: "Management" })
      .getAttribute("aria-expanded"),
    "false",
  );
});

function view(hallEnabled = false) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(StaffDashboard, { token: "test-staff", hallEnabled }),
    ),
  );
}

test("dashboard keeps loading distinct from zero and hides disabled Hall navigation", () => {
  globalThis.fetch = () => new Promise(() => {});
  view();
  assert.ok(screen.getByText("Loading operational summary…"));
  assert.equal(
    screen.queryByRole("link", { name: /Function Hall operations/ }),
    null,
  );
  assert.ok(screen.getByText("15 physical rooms"));
  assert.equal(screen.queryByText("0"), null);
});

test("dashboard presents authoritative counts and actionable queue links", async () => {
  let authorization;
  globalThis.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    return {
      ok: true,
      json: async () => ({
        arrivals: 2,
        paymentReviews: 3,
        occupied: 4,
        overdue: 1,
        needsCleaning: 2,
        maintenance: 0,
      }),
    };
  };
  view(true);
  await waitFor(() => assert.ok(screen.getByText(/Last updated/)));
  assert.equal(authorization, "Bearer test-staff");
  assert.equal(
    screen
      .getByRole("link", { name: /Review GCash payments/ })
      .getAttribute("href"),
    "/staff/payments",
  );
  assert.equal(
    screen
      .getByRole("link", { name: /Review overdue stays/ })
      .getAttribute("href"),
    "/staff/stays",
  );
  assert.ok(screen.getByRole("link", { name: /Function Hall operations/ }));
  assert.ok(
    screen.getByText(/Screenshot submission is not payment verification/),
  );
});

test("dashboard failure retains working queue links without fabricated counts", async () => {
  globalThis.fetch = async () => ({ ok: false });
  view();
  await waitFor(() => assert.ok(screen.getByText(/Live summary unavailable/)));
  assert.equal(screen.queryByText("0"), null);
  assert.equal(screen.queryByText(/Last updated/), null);
  assert.ok(screen.getByRole("link", { name: /Review GCash payments/ }));
});

test("staff shell preserves outlet context, capability gates and menu controls", async () => {
  let signOutCalls = 0;
  function Page() {
    const { token } = useOutletContext();
    return createElement("p", null, `Outlet token: ${token}`);
  }
  const pages = [
    { path: "/staff", label: "Today", component: Page },
    { path: "/staff/reservations", label: "Reservations", component: Page },
    { path: "/staff/rooms", label: "Rooms", component: Page },
    { path: "/staff/hall", label: "Function Hall", component: Page },
    { path: "/staff/reviews", label: "Review moderation", component: Page },
  ];
  render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/staff"] },
      createElement(
        Routes,
        null,
        createElement(
          Route,
          {
            element: createElement(StaffWorkspaceLayout, {
              authClient: {
                auth: {
                  signOut: async () => {
                    signOutCalls++;
                    return {
                      error: new Error("Synthetic unavailable service"),
                    };
                  },
                },
              },
              identity: "Test staff",
              token: "test-staff",
              pages,
              hallEnabled: false,
              reviewsEnabled: false,
              notice: "",
            }),
          },
          ...pages.map((page) =>
            createElement(Route, {
              key: page.path,
              path: page.path,
              element: createElement(Page),
            }),
          ),
        ),
      ),
    ),
  );
  assert.ok(screen.getByText("Outlet token: test-staff"));
  assert.equal(screen.queryByRole("link", { name: "Function Hall" }), null);
  assert.equal(screen.queryByRole("link", { name: "Review moderation" }), null);
  assert.equal(
    screen.getByRole("link", { name: "Today" }).getAttribute("aria-current"),
    "page",
  );
  const frontDesk = screen.getByRole("button", { name: "Front desk" });
  assert.ok(
    screen.getByRole("link", { name: "Today" }).closest(".staff-nav-group") ===
      null,
  );
  assert.equal(frontDesk.querySelectorAll("svg").length, 2);
  assert.equal(frontDesk.getAttribute("aria-expanded"), "true");
  fireEvent.click(frontDesk);
  assert.equal(frontDesk.getAttribute("aria-expanded"), "false");
  assert.equal(screen.queryByRole("link", { name: "Reservations" }), null);
  const children = globalThis.document.getElementById(
    frontDesk.getAttribute("aria-controls"),
  );
  assert.ok(children.hasAttribute("inert"));
  assert.equal(children.getAttribute("aria-hidden"), "true");
  fireEvent.click(frontDesk);
  fireEvent.click(frontDesk);
  fireEvent.click(frontDesk);
  assert.equal(frontDesk.getAttribute("aria-expanded"), "true");
  assert.equal(children.hasAttribute("inert"), false);
  assert.ok(screen.getByRole("link", { name: "Reservations" }));
  const property = screen.getByRole("button", { name: "Property" });
  assert.equal(property.getAttribute("aria-expanded"), "false");
  fireEvent.click(property);
  assert.equal(property.getAttribute("aria-expanded"), "true");
  assert.equal(frontDesk.getAttribute("aria-expanded"), "false");
  assert.equal(screen.queryByRole("link", { name: "Reservations" }), null);
  fireEvent.keyDown(property, { key: "ArrowDown" });
  assert.equal(
    globalThis.document.activeElement,
    screen.getByRole("link", { name: "Rooms" }),
  );
  fireEvent.keyDown(globalThis.document.activeElement, { key: "ArrowUp" });
  assert.equal(globalThis.document.activeElement, property);
  fireEvent.click(frontDesk);
  assert.equal(property.getAttribute("aria-expanded"), "false");
  assert.equal(frontDesk.getAttribute("aria-expanded"), "true");
  fireEvent.click(screen.getByRole("button", { name: "Open staff menu" }));
  fireEvent.keyDown(
    screen.getByRole("navigation", { name: "Staff navigation" }),
    { key: "Escape" },
  );
  assert.equal(
    globalThis.document.activeElement,
    screen.getByRole("button", { name: "Open staff menu" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Open staff menu" }));
  fireEvent.click(screen.getByRole("link", { name: "Reservations" }));
  assert.equal(
    screen
      .getByRole("button", { name: "Open staff menu" })
      .getAttribute("aria-expanded"),
    "false",
  );
  assert.ok(screen.getByRole("heading", { name: "Staff workspace" }));
  assert.equal(
    globalThis.document.querySelector(".staff-page-title").textContent,
    "Reservations",
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    assert.ok(screen.getByText("Sign-out failed. Please try again.")),
  );
  assert.equal(signOutCalls, 1);
});
