/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateOccupants } from "../dist/occupants.js";
import { validSettings, saveSettings } from "../dist/operational-settings.js";
import { createApp } from "../dist/app.js";

test("occupancy is advisory and Family-only extra bed charges once", () => {
  assert.equal(
    evaluateOccupants("double_standard", {
      adults: 2,
      children: 0,
      extraBed: true,
    }),
    null,
  );
  assert.equal(
    evaluateOccupants("family_executive", {
      adults: 3,
      children: 2,
      extraBed: true,
    }).extraBedCentavos,
    10000,
  );
  assert.match(
    evaluateOccupants("family_executive", {
      adults: 3,
      children: 2,
      extraBed: true,
    }).advisory,
    /staff review/,
  );
  assert.equal(
    evaluateOccupants("double_standard", {
      adults: 5,
      children: 0,
      extraBed: false,
    }).legalLimitVerified,
    false,
  );
  assert.equal(
    evaluateOccupants("family_executive", {
      adults: 0,
      children: 0,
      extraBed: false,
    }),
    null,
  );
});

test("settings keep unknown values nullable and reject public QR URLs", () => {
  const blank = {
    cleaningBufferMinutes: null,
    checkoutAlertMinutes: null,
    gcashQrObjectKey: null,
    gcashPayeeLabel: null,
    cancellationDisplayText: null,
  };
  assert.equal(validSettings(blank), true);
  assert.equal(
    validSettings({ ...blank, gcashQrObjectKey: "https://public.example/qr" }),
    false,
  );
  assert.equal(validSettings({ ...blank, cleaningBufferMinutes: -1 }), false);
});

test("operational settings and actor audit commit together", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push([sql, params]);
      return { rowCount: 1, rows: [{ hasLegacyReminders: true }] };
    },
    release() {},
  };
  const blank = {
    cleaningBufferMinutes: null,
    checkoutAlertMinutes: null,
    gcashQrObjectKey: null,
    gcashPayeeLabel: null,
    cancellationDisplayText: null,
  };
  assert.equal(
    await saveSettings("staff-1", blank, { connect: async () => client }),
    true,
  );
  assert.deepEqual(
    calls.map(([sql]) => sql.trim().split(/\s+/)[0].toLowerCase()),
    ["begin", "select", "update", "update", "insert", "commit"],
  );
  assert.deepEqual(calls[2][1].at(-1), "staff-1");
  assert.match(calls[3][0], /set checkout_warning_minutes=null/);
  assert.deepEqual(calls[4][1], ["staff-1"]);
});

test("operational settings API denies guest and anonymous callers", async () => {
  const app = createApp(
    async () => {},
    async () => null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}/staff/settings`;
    for (const method of ["GET", "PUT"]) {
      assert.equal((await fetch(url, { method })).status, 401);
      assert.equal(
        (
          await fetch(url, {
            method,
            headers: { Authorization: "Bearer guest" },
          })
        ).status,
        403,
      );
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
