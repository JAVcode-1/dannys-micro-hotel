/* global fetch, Response, sessionStorage */
import assert from "node:assert/strict";
import { test } from "node:test";
import { btoa } from "node:buffer";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
const dom = new JSDOM("", { url: "http://localhost/staff/hall" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup, waitFor } =
  await import("@testing-library/react");
const { default: HallDesk } = await import("../src/HallDesk.tsx");
const { pendingHallCommand } = await import("../src/hall-command-state.ts");

test("a held Hall slot stays visible after staff mark the hall clean and ready", async () => {
  const original = fetch;
  const originalConfirm = globalThis.confirm;
  const originalFormData = globalThis.FormData;
  globalThis.confirm = () => true;
  globalThis.FormData = dom.window.FormData;
  let ready = false;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/actions/ready")) {
      ready = true;
      return Response.json({});
    }
    if (String(url).includes("reservations?"))
      return Response.json({
        entries: [],
        hall: {
          ready,
          occupied: false,
          reserved: true,
          reservedUntil: "2026-11-24T19:30:00.000Z",
        },
      });
    return Response.json({ noShowGrace: 60, reminder: 15 });
  };
  try {
    render(
      createElement(
        MemoryRouter,
        null,
        createElement(HallDesk, { token: "invalid" }),
      ),
    );
    await screen.findByText("Hall needs cleaning or setup");
    assert.ok(screen.getByText(/Current time slot is held until.*3:30 AM/i));
    fireEvent.click(
      screen.getByRole("button", { name: "Mark clean and ready" }),
    );
    await screen.findByText("Hall is clean and ready");
    assert.ok(screen.getByText(/Current time slot is held until.*3:30 AM/i));
    assert.ok(!screen.queryByRole("button", { name: "Mark clean and ready" }));
  } finally {
    cleanup();
    globalThis.fetch = original;
    globalThis.confirm = originalConfirm;
    globalThis.FormData = originalFormData;
  }
});

test("a deposit-funded walk-in can start and still collect its balance", async () => {
  const original = fetch;
  const now = Date.now();
  globalThis.fetch = async (url) => {
    if (String(url).includes("reservations?"))
      return Response.json({
        entries: [
          {
            id: "walk-in",
            organizer: "Function Hall booking",
            channel: "walk_in",
            status: "confirmed",
            ready: true,
            total: "500000",
            overtime: "0",
            collected: "250000",
            refunded: "0",
            balance: "250000",
            quote: {
              start: new Date(now - 60_000).toISOString(),
              end: new Date(now + 10_800_000).toISOString(),
            },
          },
        ],
      });
    return Response.json({ noShowGrace: 60, reminder: 15 });
  };
  try {
    render(
      createElement(
        MemoryRouter,
        null,
        createElement(HallDesk, { token: "invalid" }),
      ),
    );
    const startButton = await screen.findByRole("button", {
      name: "Start event",
    });
    assert.equal(startButton.disabled, false);
    assert.equal(
      screen.getByRole("button", { name: "Collect balance" }).disabled,
      false,
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});

for (const scenario of [
  "saved receipt",
  "missing receipt",
  "rejected start",
  "unavailable lookup",
])
  test(
    `Hall reload handles ${scenario} without manual recovery buttons`,
    { timeout: 5000 },
    async () => {
      const original = fetch;
      const token =
        "header." +
        btoa(JSON.stringify({ sub: "synthetic-staff" })) +
        ".signature";
      const command = {
        path:
          scenario === "rejected start" ? "actions/start" : "actions/receipt",
        key: "saved-cash-command-0001",
        payload: JSON.stringify({ id: "synthetic", amount: 150000 }),
      };
      pendingHallCommand(sessionStorage, token).save(command);
      const writes = [];
      let checks = 0;
      globalThis.fetch = async (url, options = {}) => {
        if (String(url).endsWith("/commands/" + command.key)) {
          checks++;
          if (scenario === "saved receipt")
            return Response.json({
              result: { id: "synthetic", receiptId: "cash-receipt" },
            });
          if (scenario === "unavailable lookup")
            return Response.json(
              { error: "Function Hall is unavailable." },
              { status: 503 },
            );
          return Response.json(
            {
              error: "No committed command found. Retry the original command.",
            },
            { status: 404 },
          );
        }
        if (options.method === "POST") {
          writes.push({ url, ...options });
          if (scenario === "rejected start")
            return Response.json(
              { error: "This event cannot start now." },
              { status: 409 },
            );
          return Response.json({ id: "synthetic", receiptId: "cash-receipt" });
        }
        if (String(url).includes("reservations?"))
          return Response.json({ entries: [] });
        return Response.json({ noShowGrace: 60, reminder: 15 });
      };
      try {
        render(
          createElement(MemoryRouter, null, createElement(HallDesk, { token })),
        );
        assert.ok(
          !screen.queryByRole("button", { name: "Check saved result" }),
          "result lookup should run without a button",
        );
        assert.ok(
          !screen.queryByRole("button", { name: "Retry original command" }),
          "retry should run without a button",
        );
        if (scenario === "unavailable lookup") {
          await screen.findByText(/Could not verify the previous Hall action/);
          assert.deepEqual(
            pendingHallCommand(sessionStorage, token).load(),
            command,
          );
        } else {
          await waitFor(() =>
            assert.equal(
              pendingHallCommand(sessionStorage, token).load(),
              undefined,
            ),
          );
        }
        assert.equal(checks, 1);
        if (scenario === "missing receipt" || scenario === "rejected start") {
          assert.equal(writes.length, 1);
          assert.equal(writes[0].body, command.payload);
          assert.equal(writes[0].headers["Idempotency-Key"], command.key);
          assert.ok(String(writes[0].url).endsWith("/" + command.path));
        } else {
          assert.equal(writes.length, 0);
        }
        if (scenario === "rejected start")
          assert.ok(screen.getByText("This event cannot start now."));
      } finally {
        cleanup();
        globalThis.fetch = original;
        sessionStorage.clear();
      }
    },
  );

test(
  "Manage refund advances after approval and resumes the pending refund",
  { timeout: 5000 },
  async () => {
    const original = fetch;
    const originalConfirm = globalThis.confirm;
    const originalFormData = globalThis.FormData;
    globalThis.confirm = () => true;
    globalThis.FormData = dom.window.FormData;
    let approvals = 0;
    let transferred = 0;
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith("/actions/approve_refund")) {
        assert.equal(JSON.parse(options.body).amount, 125000);
        approvals++;
        return Response.json({ id: "approval" });
      }
      if (String(url).endsWith("/actions/complete_refund")) {
        const action = JSON.parse(options.body);
        assert.equal(action.approval, "approval");
        assert.equal(action.amount, 25000);
        transferred += action.amount;
        return Response.json({ refundRemainingCentavos: 125000 - transferred });
      }
      if (String(url).endsWith("/finances"))
        return Response.json({
          id: "reservation",
          receipts: [],
          refunds: approvals
            ? [
                {
                  id: "approval",
                  amount: "125000",
                  transferredAmount: String(transferred),
                  remainingAmount: String(125000 - transferred),
                  reason: "Approved synthetic refund",
                  pending: true,
                  transfers: [],
                },
              ]
            : [],
        });
      if (String(url).includes("reservations?"))
        return Response.json({
          entries: [
            {
              id: "reservation",
              organizer: "Synthetic organizer",
              channel: "telephone",
              status: "cancelled",
              total: "300000",
              overtime: "0",
              collected: "150000",
              refunded: "0",
              balance: "150000",
              quote_input: { start: "2026-12-01T14:00" },
              quote: null,
            },
          ],
        });
      return Response.json({ noShowGrace: 60, reminder: 15 });
    };
    try {
      render(
        createElement(
          MemoryRouter,
          null,
          createElement(HallDesk, { token: "invalid" }),
        ),
      );
      const more = await screen.findByText("More actions");
      more.closest("details").open = true;
      assert.equal(
        screen.queryByRole("button", { name: "Approve refund" }),
        null,
      );
      assert.equal(
        screen.queryByRole("button", { name: "Record refund transfer" }),
        null,
      );
      fireEvent.click(screen.getByRole("button", { name: "Manage refund" }));
      const approve = await screen.findByRole("button", {
        name: "Approve refund",
      });
      fireEvent.change(screen.getByLabelText("Reason"), {
        target: { value: "Approved synthetic refund" },
      });
      fireEvent.change(screen.getByLabelText("Amount (PHP)"), {
        target: { value: "1250" },
      });
      fireEvent.click(approve);
      const selector = await screen.findByLabelText("Pending refund approval");
      assert.equal(selector.value, "approval");
      const record = screen.getByRole("button", {
        name: "Record refund transfer",
      });
      const amount = screen.getByLabelText("Amount sent (PHP)");
      await waitFor(() =>
        assert.match(
          selector.textContent,
          /1,250.00.*Approved synthetic refund/,
        ),
      );
      fireEvent.change(amount, { target: { value: "250" } });
      fireEvent.click(screen.getByRole("button", { name: "Use current time" }));
      fireEvent.change(screen.getByLabelText("Refund verification note"), {
        target: { value: "Verified synthetic transfer" },
      });
      fireEvent.click(
        screen.getByLabelText("I verified the amount actually sent."),
      );
      fireEvent.click(record);
      await screen.findByText(/Transfer recorded.*1,000.00 still due/);
      const remainingSelector = await screen.findByLabelText(
        "Pending refund approval",
      );
      assert.match(remainingSelector.textContent, /1,000.00 still due/);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(screen.getByRole("button", { name: "Manage refund" }));
      assert.equal(
        (await screen.findByLabelText("Pending refund approval")).value,
        "approval",
      );
      assert.equal(approvals, 1);
      assert.equal(transferred, 25000);
    } finally {
      cleanup();
      globalThis.fetch = original;
      globalThis.confirm = originalConfirm;
      globalThis.FormData = originalFormData;
    }
  },
);
