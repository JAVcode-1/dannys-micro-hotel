import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseReservationSearch,
  reservationState,
} from "../dist/reservation-workspace.js";
import { registerReservationWorkspace } from "../dist/reservation-workspace.js";
import express from "express";
/* global fetch */

test("operational dashboard requires staff and exposes only aggregate queue counts", async () => {
  const app = express();
  registerReservationWorkspace(
    app,
    (req, res, next) => {
      if (req.headers.authorization !== "Bearer staff") {
        res.status(403).end();
        return;
      }
      next();
    },
    {
      query: async () => ({
        rows: [
          {
            arrivals: 2,
            paymentReviews: 1,
            occupied: 3,
            overdue: 1,
            needsCleaning: 2,
            maintenance: 0,
          },
        ],
      }),
    },
  );
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/staff/dashboard`;
    assert.equal((await fetch(url)).status, 403);
    const response = await fetch(url, {
      headers: { Authorization: "Bearer staff" },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).arrivals, 2);
  } finally {
    server.close();
  }
});

test("reservation search is bounded and held proof review remains protected", () => {
  assert.deepEqual(parseReservationSearch({ q: "  Guest  ", page: "2" }), {
    q: "Guest",
    page: 2,
  });
  for (const query of [
    { page: "-1" },
    { page: "1.5" },
    { q: ["guest"] },
    { q: "x".repeat(121) },
  ])
    assert.throws(() => parseReservationSearch(query));
  assert.equal(
    reservationState({
      state: "proof_pending_review",
      checkedInAt: null,
      checkedOutAt: null,
    }),
    "Awaiting staff payment review",
  );
  assert.equal(
    reservationState({ state: "held", checkedInAt: null, checkedOutAt: null }),
    "Payment hold",
  );
  assert.equal(
    reservationState({
      state: "confirmed",
      checkedInAt: "2026-11-21",
      checkedOutAt: null,
    }),
    "Checked in",
  );
});
