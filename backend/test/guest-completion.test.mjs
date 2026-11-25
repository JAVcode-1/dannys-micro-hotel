import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookingPolicy,
  parseBookingContact,
  guestReservations,
} from "../dist/guest-booking.js";
import { guestPaymentSession } from "../dist/payment-proofs.js";
import { cancellationRows } from "../dist/cancellations.js";

test("booking contact requires disclosed current policy and rejects control characters", () => {
  assert.deepEqual(
    parseBookingContact({
      phone: " +63 917 000 0000 ",
      policyVersion: bookingPolicy.version,
      policyAcknowledged: true,
    }),
    {
      phone: "+63 917 000 0000",
      policyVersion: bookingPolicy.version,
      policyAcknowledged: true,
    },
  );
  for (const value of [
    undefined,
    {},
    { phone: "09170000000", policyVersion: "old", policyAcknowledged: true },
    {
      phone: "09170000000",
      policyVersion: bookingPolicy.version,
      policyAcknowledged: false,
    },
    {
      phone: "0917\n0000000",
      policyVersion: bookingPolicy.version,
      policyAcknowledged: true,
    },
  ])
    assert.throws(() => parseBookingContact(value));
});
test("reservation pagination and detail retain identity and email ownership", async () => {
  let selected;
  const pool = {
    query: async (sql, args) => {
      if (sql.includes("to_regclass")) return { rows: [{ installed: false }] };
      selected = { sql, args };
      return { rows: [] };
    },
  };
  const guest = {
    id: "d3a00000-0000-4000-8000-000000000001",
    email: "Guest@Example.test",
  };
  await guestReservations(guest, pool, { limit: 10, offset: 20 });
  assert.match(
    selected.sql,
    /owner_auth_user_id = \$1 and r.verified_email = \$2/,
  );
  assert.deepEqual(selected.args, [
    guest.id,
    "guest@example.test",
    10,
    20,
    null,
  ]);
  await assert.rejects(
    guestReservations(guest, pool, { limit: 5000 }),
    /pagination/i,
  );
  await assert.rejects(
    guestReservations(guest, pool, { reservationId: "not-an-id" }),
    /not found/i,
  );
});
test("verified confirmed payment is displayed as confirmed after the old proof deadline", async () => {
  const pool = {
    query: async (sql) =>
      sql.includes("select total_centavos")
        ? {
            rows: [
              {
                total_centavos: "20000",
                confirmation_at: "2026-11-20T00:00:00Z",
              },
            ],
          }
        : sql.includes("from staytrack.verified_online_payments")
          ? { rows: [{ amount: 20000 }] }
          : {
              rows: [
                {
                  state: "confirmed",
                  proof_deadline_at: new Date("2026-11-20T00:00:00Z"),
                  now: new Date("2026-11-21T00:00:00Z"),
                },
              ],
            },
  };
  const result = await guestPaymentSession(
    { id: "guest", email: "guest@example.test" },
    "d3a00000-0000-4000-8000-000000000001",
    pool,
    {},
  );
  assert.equal(result.status, "confirmed");
  assert.equal(result.qrUrl, null);
  assert.equal(result.receivedAmountCentavos, 20000);
});

test("verified payment remains verified after one room is released by checkout or cancellation", async () => {
  const pool = {
    query: async (sql) =>
      sql.includes("select total_centavos")
        ? {
            rows: [
              {
                total_centavos: "40000",
                confirmation_at: "2026-11-20T00:00:00Z",
              },
            ],
          }
        : sql.includes("from staytrack.verified_online_payments")
          ? { rows: [{ amount: 40000 }] }
          : {
              rows: ["released", "confirmed"].map((state) => ({
                state,
                proof_deadline_at: new Date("2026-11-20T00:00:00Z"),
                now: new Date("2026-11-21T00:00:00Z"),
              })),
            },
  };
  const result = await guestPaymentSession(
    { id: "guest", email: "guest@example.test" },
    "d3a00000-0000-4000-8000-000000000001",
    pool,
    {},
  );
  assert.equal(result.status, "confirmed");
  assert.equal(result.qrUrl, null);
  assert.equal(result.receivedAmountCentavos, 40000);
});
test("refund detail filters one reservation inside the owned query", async () => {
  let query;
  const pool = {
    query: async (sql, args) => {
      query = { sql, args };
      return { rows: [] };
    },
  };
  const id = "d3a00000-0000-4000-8000-000000000001";
  await cancellationRows(
    { id: "guest", email: "Guest@example.test" },
    pool,
    0,
    id,
  );
  assert.deepEqual(query.args, ["guest", "guest@example.test", 0, id]);
  assert.match(query.sql, /r.id=\$4::uuid/);
  await assert.rejects(
    cancellationRows(
      { id: "guest", email: "guest@example.test" },
      pool,
      0,
      "bad",
    ),
    /reservation/i,
  );
});
