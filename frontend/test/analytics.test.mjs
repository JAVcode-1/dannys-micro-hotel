import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("", { url: "http://localhost/staff/analytics" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup, within } =
  await import("@testing-library/react");
const { default: StaffAnalytics } = await import("../src/StaffAnalytics.tsx");

test("analytics displays loading, applies Manila filters, and clears a pending view on session change", async () => {
  const originalFetch = globalThis.fetch;
  const originalForm = globalThis.FormData;
  const requests = [];
  const zero = { gross: "0", refunds: "0", net: "0" };
  globalThis.FormData = dom.window.FormData;
  globalThis.fetch = (url, options) =>
    new Promise((resolve) => requests.push({ url, options, resolve }));
  const finish = (request) =>
    request.resolve({
      ok: true,
      json: async () => ({
        overall: zero,
        trends: [],
        categories: [],
        packages: [],
      }),
    });
  try {
    const { rerender } = render(
      createElement(StaffAnalytics, { token: "one", key: "one" }),
    );
    assert.ok(screen.getByRole("status"));
    finish(requests[0]);
    await screen.findByText("Completed refunds");
    assert.equal(screen.getAllByText(/No activity/).length, 3);
    fireEvent.change(screen.getByLabelText("Trend"), {
      target: { value: "week" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    assert.match(requests[1].url, /grain=week/);
    rerender(createElement(StaffAnalytics, { token: "two", key: "two" }));
    assert.equal(requests[1].options.signal.aborted, true);
    assert.equal(screen.queryByText("Completed refunds"), null);
    finish(requests[1]);
    finish(requests[2]);
    await screen.findByText("Completed refunds");
    assert.equal(requests[2].options.headers.Authorization, "Bearer two");
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalForm;
  }
});

test("Analytics charts show signed net collections and rank original purchases separately from extensions", async (t) => {
  t.after(cleanup);
  const zero = { gross: "0", refunds: "0", net: "0" };
  const receipt = { gross: "12000", refunds: "0", net: "12000" };
  const refund = { gross: "0", refunds: "2500", net: "-2500" };
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      overall: { gross: "12000", refunds: "2500", net: "9500" },
      trends: [
        { period: "2026-11-24", ...receipt },
        { period: "2026-11-26", ...refund },
      ],
      categories: [
        {
          name: null,
          ...refund,
          packages: zero,
          additional: zero,
          unclassified: refund,
        },
        {
          name: "double_standard",
          ...receipt,
          packages: receipt,
          additional: zero,
          unclassified: zero,
        },
      ],
      packages: [
        {
          id: "standard-old",
          category: "double_standard",
          version: 1,
          duration: 180,
          price: "20000",
          originals: 1,
          extensions: 6,
          ...zero,
        },
        {
          id: "standard-new",
          category: "double_standard",
          version: 2,
          duration: 180,
          price: "22000",
          originals: 4,
          extensions: 1,
          ...receipt,
        },
      ],
    }),
  }));
  render(createElement(StaffAnalytics, { token: "sample-staff" }));

  const trend = await screen.findByRole("region", {
    name: "Net collections by period",
  });
  assert.ok(within(trend).getByLabelText("2026-11-26: −₱25.00"));
  assert.equal(trend.querySelectorAll("li").length, 2);
  const categories = screen.getByRole("list", {
    name: "Net collections by room category",
  });
  assert.match(categories.firstElementChild.textContent, /Double Standard/);
  assert.match(
    categories.lastElementChild.textContent,
    /Unattributed.*−₱25.00/,
  );
  const packages = screen.getByRole("list", {
    name: "Packages ranked by original purchases",
  });
  assert.match(
    packages.firstElementChild.textContent,
    /Double Standard · 3 hours · v2/,
  );
  assert.match(
    packages.lastElementChild.textContent,
    /Double Standard · 3 hours · v1/,
  );
  assert.ok(within(packages).getByText("4 original purchases, 1 extension"));

  const panel = screen.getByRole("region", { name: "Collection trends" });
  const disclosure = within(panel).getByText("View data").closest("details");
  assert.equal(disclosure.open, false);
  fireEvent.click(within(panel).getByText("View data"));
  assert.equal(disclosure.open, true);
  assert.match(
    within(panel).getByRole("table").textContent,
    /2026-11-26.*₱25.00.*−₱25.00/,
  );
});

test("Analytics opens the Function Hall report with its existing date filters and authorization", async () => {
  const originalFetch = globalThis.fetch;
  const originalForm = globalThis.FormData;
  const requests = [];
  const zero = { gross: "0", refunds: "0", net: "0" };
  globalThis.FormData = dom.window.FormData;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () =>
        String(url).includes("/staff/hall/reports")
          ? {
              ...zero,
              days: [{ day: "2026-11-24", ...zero }],
              utilization: {
                bookings: 1,
                scheduled_minutes: 180,
                actual_minutes: 150,
                preparation_minutes: 30,
                cleanup_minutes: 30,
              },
            }
          : { overall: zero, trends: [], categories: [], packages: [] },
    };
  };
  try {
    render(
      createElement(StaffAnalytics, { token: "test-staff", hallEnabled: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Function Hall" }));
    assert.equal(
      requests.some(({ url }) => url.includes("/staff/hall/reports")),
      false,
    );
    fireEvent.change(screen.getByLabelText("From (Manila)"), {
      target: { value: "2026-11-24" },
    });
    fireEvent.change(screen.getByLabelText("Through (Manila)"), {
      target: { value: "2026-11-25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "View report" }));
    const chart = await screen.findByRole("region", {
      name: "Daily Hall net collections",
    });
    assert.ok(within(chart).getByLabelText("2026-11-24: ₱0.00"));
    const panel = screen.getByRole("region", {
      name: "Daily Hall collections",
    });
    fireEvent.click(within(panel).getByText("View data"));
    assert.ok(
      within(panel).getByRole("table", { name: "Daily Hall collections" }),
    );
    assert.match(
      screen.getByText(/actual occupied minutes/).textContent,
      /150 actual occupied minutes/,
    );
    const hall = requests.find(({ url }) =>
      url.includes("/staff/hall/reports"),
    );
    assert.match(hall.url, /from=2026-11-24&to=2026-11-25/);
    assert.equal(hall.options.headers.Authorization, "Bearer test-staff");
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalForm;
  }
});
