/* global fetch, Response, sessionStorage */
import assert from "node:assert/strict";
import { test } from "node:test";
import { btoa } from "node:buffer";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("", { url: "http://localhost/staff/hall" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup, waitFor } =
  await import("@testing-library/react");
const { default: HallDesk } = await import("../src/HallDesk.tsx");
const { pendingHallCommand } = await import("../src/hall-command-state.ts");

test(
  "Hall reload retries the original cash command with its original durable key",
  { timeout: 5000 },
  async () => {
    const original = fetch;
    const token =
      "header." +
      btoa(JSON.stringify({ sub: "synthetic-staff" })) +
      ".signature";
    const command = {
      path: "actions/receipt",
      key: "saved-cash-command-0001",
      payload: JSON.stringify({ id: "synthetic", amount: 150000 }),
    };
    pendingHallCommand(sessionStorage, token).save(command);
    const writes = [];
    globalThis.fetch = async (url, options = {}) => {
      if (options.method === "POST") {
        writes.push({ url, ...options });
        return Response.json({ id: "synthetic", receiptId: "cash-receipt" });
      }
      if (String(url).includes("reservations?"))
        return Response.json({ entries: [] });
      return Response.json({ noShowGrace: 60, reminder: 15 });
    };
    try {
      render(createElement(HallDesk, { token }));
      await screen.findByRole("region", { name: "Saved Hall command" });
      fireEvent.click(
        screen.getByRole("button", { name: "Retry original command" }),
      );
      await waitFor(() =>
        assert.equal(
          screen.queryByRole("region", { name: "Saved Hall command" }) !== null,
          false,
        ),
      );
      assert.equal(writes.length, 1);
      assert.equal(writes[0].body, command.payload);
      assert.equal(writes[0].headers["Idempotency-Key"], command.key);
      assert.equal(pendingHallCommand(sessionStorage, token).load(), undefined);
    } finally {
      cleanup();
      globalThis.fetch = original;
      sessionStorage.clear();
    }
  },
);

test(
  "Hall financial history exposes pending approvals for staff selection",
  { timeout: 5000 },
  async () => {
    const original = fetch;
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("/finances"))
        return Response.json({
          id: "reservation",
          receipts: [],
          refunds: [
            {
              id: "approval",
              amount: "125000",
              reason: "Approved synthetic refund",
              pending: true,
            },
          ],
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
      render(createElement(HallDesk, { token: "invalid" }));
      await screen.findByRole("button", { name: "Manage this reservation" });
      fireEvent.click(
        screen.getByRole("button", { name: "Manage this reservation" }),
      );
      fireEvent.change(screen.getByLabelText("Action"), {
        target: { value: "complete_refund" },
      });
      const selector = await screen.findByLabelText("Pending refund approval");
      await waitFor(() =>
        assert.match(
          selector.textContent,
          /1,250.00.*Approved synthetic refund/,
        ),
      );
    } finally {
      cleanup();
      globalThis.fetch = original;
    }
  },
);
