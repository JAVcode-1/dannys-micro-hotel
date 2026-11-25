/* global fetch */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { createIsolatedApp } from "../dist/isolated-composition.js";
import {
  FakeMailAdapter,
  enqueueMail,
  processOutbox,
  runScheduledJobs,
} from "../dist/notifications.js";
import {
  staffReservationIndex,
  staffReservationDetail,
} from "../dist/reservation-workspace.js";
import { configurePaymentQr } from "../dist/payment-proofs.js";
import { staffAudit, parseAuditFilters } from "../dist/audit.js";
import { Buffer } from "node:buffer";
import process from "node:process";
import { generateIsolatedTypes } from "../../scripts/generate-isolated-types.mjs";
import { writeFileSync } from "node:fs";
import { reviewDeliveryPostgres } from "./review-delivery-postgres.mjs";
import { sharedRequestLimit } from "../dist/request-limits.js";

export async function sprintPostgres(t, pool) {
  await t.test(
    "shared rate limits serialize across workers, reset at boundary and keep addresses private",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261121002500_request_limits.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const now = new Date();
      const results = await Promise.all(
        Array.from({ length: 40 }, () =>
          sharedRequestLimit(pool, "192.0.2.15", now),
        ),
      );
      assert.equal(results.filter((result) => result.allowed).length, 30);
      assert.equal(
        (await sharedRequestLimit(pool, "192.0.2.15", new Date(+now + 60000)))
          .allowed,
        true,
      );
      const keys = (
        await pool.query("select key_digest from staytrack.request_limits")
      ).rows;
      assert.ok(keys.every((row) => /^[a-f0-9]{64}$/.test(row.key_digest)));
    },
  );
  await t.test(
    "C12 outbox is private, transactional, bounded, leased and idempotent",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261121002000_notification_outbox.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const access = (
        await pool.query(
          "select relrowsecurity as rls,has_table_privilege('anon','staytrack.notification_outbox','select,insert,update,delete') as anon,has_table_privilege('authenticated','staytrack.notification_outbox','select,insert,update,delete') as authenticated from pg_class where oid='staytrack.notification_outbox'::regclass",
        )
      ).rows[0];
      assert.deepEqual(access, {
        rls: true,
        anon: false,
        authenticated: false,
      });
      const db = await pool.connect();
      try {
        await db.query("begin");
        await enqueueMail(
          db,
          "rolled-back",
          "guest@example.test",
          "reservation_created",
          {},
        );
        await db.query("rollback");
      } finally {
        db.release();
      }
      assert.equal(
        (
          await pool.query(
            "select 1 from staytrack.notification_outbox where dedupe_key='rolled-back'",
          )
        ).rowCount,
        0,
      );
      const adapter = new FakeMailAdapter();
      await enqueueMail(
        pool,
        "concurrent-message",
        "guest@example.test",
        "reservation_created",
        {},
      );
      await Promise.all([
        processOutbox(pool, adapter),
        processOutbox(pool, adapter),
      ]);
      assert.equal(adapter.messages.length, 1);
      await enqueueMail(
        pool,
        "failing-message",
        "guest@example.test",
        "reservation_created",
        {},
      );
      const failing = {
        deliver: async () => {
          throw new Error("private provider error");
        },
      };
      for (let n = 0; n < 5; n++) {
        await pool.query(
          "update staytrack.notification_outbox set due_at=clock_timestamp() where dedupe_key='failing-message'",
        );
        await processOutbox(pool, failing);
      }
      assert.deepEqual(
        (
          await pool.query(
            "select state,attempts from staytrack.notification_outbox where dedupe_key='failing-message'",
          )
        ).rows,
        [{ state: "failed", attempts: 5 }],
      );
      await runScheduledJobs(pool, adapter);
    },
  );
  await reviewDeliveryPostgres(t, pool);
  await t.test(
    "C04/C05/C07/C20 isolated HTTP booking to proof to actual staff confirmation and owned detail",
    async () => {
      const oldMode = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";
      const guest = {
        id: "c1111111-1111-4111-8111-111111111111",
        email: "integration@example.test",
      };
      const staff = {
        id: "33333333-3333-4333-8333-333333333333",
        email: "staff@example.test",
      };
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
        "base64",
      );
      const objects = new Map();
      const media = {
        upload: async (bucket, key, bytes) => {
          objects.set(bucket + "/" + key, bytes);
        },
        remove: async () => {},
        signedUrl: async () =>
          "data:image/png;base64," + png.toString("base64"),
      };
      await configurePaymentQr(
        staff.id,
        "SYNTHETIC TEST PAYEE",
        png,
        "image/png",
        pool,
        media,
      );
      const application = createIsolatedApp({
        pool,
        verifyStaff: async (token) => (token === "staff" ? staff : null),
        verifyGuest: async (token) =>
          token === "guest"
            ? guest
            : token === "foreign"
              ? { ...guest, id: "c2222222-2222-4222-8222-222222222222" }
              : null,
        media,
        delivery: {
          invitation: async () => {},
          generateOtp: async () => "123456",
          sendOtp: async () => {},
          verifyOtp: async () => guest,
        },
      });
      const server = application.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      const root = "http://127.0.0.1:" + server.address().port;
      const json = async (path, body, token = "guest") =>
        fetch(root + path, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      try {
        const start = new Date(
          Math.ceil((Date.now() + 400 * 86400000) / 60000) * 60000,
        ).toISOString();
        const items = [
          {
            category: "double_standard",
            startAt: start,
            blocks: [180],
            adults: 2,
            children: 0,
            extraBed: false,
          },
        ];
        const availability = await json("/availability", { items });
        assert.equal(availability.status, 200);
        const quote = await availability.json();
        assert.equal(quote.available, true);
        const bookingStatus = await fetch(root + "/guest/booking-status");
        assert.equal(bookingStatus.status, 200);
        const { policy } = await bookingStatus.json();
        const body = {
          requestKey: "sprint-http-hold-0001",
          primaryName: "SYNTHETIC HTTP GUEST",
          items,
          expectedTotalCentavos: quote.quote.totalCentavos,
          contact: {
            phone: "09170000000",
            policyVersion: policy.version,
            policyAcknowledged: true,
          },
        };
        const hold = await json("/guest/reservations", body);
        assert.equal(
          hold.status,
          200,
          JSON.stringify(await hold.clone().json()),
        );
        const { id } = await hold.json();
        assert.deepEqual(
          await (await json("/guest/reservations", body)).json(),
          { id, replayed: true },
        );
        assert.equal(
          (
            await fetch(root + "/guest/reservations/" + id, {
              headers: { Authorization: "Bearer foreign" },
            })
          ).status,
          404,
        );
        const proof = await fetch(root + "/guest/payments/" + id + "/proof", {
          method: "POST",
          headers: {
            Authorization: "Bearer guest",
            "Content-Type": "image/png",
            "X-Transaction-Reference": "6300000001",
          },
          body: png,
        });
        assert.equal(proof.status, 200);
        const submission = (
          await pool.query(
            "select id from staytrack.payment_submissions where reservation_id=$1",
            [id],
          )
        ).rows[0].id;
        // Explicit real-ledger checks are represented by synthetic test evidence only.
        const confirmation = await json(
          "/staff/payment-reviews/" + submission + "/decision",
          {
            decision: "confirmed",
            expectedVersion: 0,
            requestKey: "sprint-http-confirm-001",
            verification: {
              amountCentavos: quote.quote.totalCentavos,
              reference: "6300000001",
              recipient: "SYNTHETIC TEST PAYEE",
              receivedAt: new Date(Date.now() - 60000).toISOString(),
              ledgerChecked: true,
              receivingAccountChecked: true,
              timeChecked: true,
            },
            note: "SYNTHETIC TEST ONLY",
          },
          "staff",
        );
        assert.equal(
          confirmation.status,
          200,
          JSON.stringify(await confirmation.clone().json()),
        );
        const detail = await fetch(root + "/guest/reservations/" + id, {
          headers: { Authorization: "Bearer guest" },
        });
        assert.equal(detail.status, 200);
        assert.ok(
          (await detail.json()).items.every(
            (item) => item.state === "confirmed",
          ),
        );
        assert.equal(
          (
            await fetch(root + "/staff/reservations", {
              headers: { Authorization: "Bearer guest" },
            })
          ).status,
          403,
        );
        const found = await staffReservationIndex(
          { q: "SYNTHETIC HTTP GUEST" },
          pool,
        );
        assert.equal(found.reservations[0].id, id);
        const workspace = await staffReservationDetail(id, pool);
        assert.equal(workspace.payments.length, 1);
        assert.equal(workspace.financials.balanceCentavos, 0);
        const audit = await staffAudit(
          parseAuditFilters({ subjectType: "hall_reservation" }),
          pool,
        );
        assert.ok(
          audit.entries.every((entry) => entry.action.startsWith("hall.")),
        );
        const adapter = new FakeMailAdapter();
        await runScheduledJobs(pool, adapter);
        assert.ok(
          adapter.messages.some(
            (message) => message.kind === "reservation_confirmed",
          ),
        );
      } finally {
        await new Promise((resolve) => server.close(resolve));
        if (oldMode === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = oldMode;
      }
    },
  );
  const types = await generateIsolatedTypes(pool);
  writeFileSync(
    new URL("../../.quality/database.types.sprint.ts", import.meta.url),
    types,
  );
}
