import assert from "node:assert/strict";
import { staffAudit, parseAuditFilters } from "../dist/audit.js";

export async function h03AuditPostgres(t, pool) {
  await t.test(
    "H03-A audit projects authorized fields and pages precise Manila-filtered events",
    async () => {
      const actor = "33333333-3333-4333-8333-333333333333";
      const input = {
        actor,
        action: "synthetic.audit_fixture",
        from: "2026-12-01",
        to: "2026-12-01",
        limit: "1",
      };
      const inserted = (
        await pool.query(
          `insert into staytrack.staff_audit(actor_auth_user_id,action,occurred_at)
      select $1,'synthetic.audit_fixture',value::timestamptz from unnest(array[
        '2026-11-30 15:59:59.999999Z','2026-11-30 16:00:00.000001Z','2026-11-30 16:00:00.000002Z',
        '2026-11-30 16:00:00.000002Z','2026-12-01 16:00:00Z']) value returning id`,
          [actor],
        )
      ).rows;
      const first = await staffAudit(parseAuditFilters(input), pool);
      const second = await staffAudit(
        parseAuditFilters({ ...input, cursor: first.nextCursor }),
        pool,
      );
      const third = await staffAudit(
        parseAuditFilters({ ...input, cursor: second.nextCursor }),
        pool,
      );
      assert.deepEqual(
        new Set([first, second, third].map((page) => page.entries[0].id)),
        new Set(inserted.slice(1, 4).map((row) => "audit:" + row.id)),
      );
      assert.equal(third.nextCursor, null);
      assert.equal(first.entries[0].occurredAt, "2026-11-30T16:00:00.000002Z");
      assert.equal(third.entries[0].occurredAt, "2026-11-30T16:00:00.000001Z");
      assert.equal(first.entries[0].subjectType, null);
      assert.equal(first.entries[0].subjectId, null);
      assert.deepEqual(
        (
          await staffAudit(
            parseAuditFilters({
              ...input,
              actor: "11111111-1111-4111-8111-111111111111",
            }),
            pool,
          )
        ).entries,
        [],
      );
      const event = (
        await pool.query(
          "select room_booking_id,reason,request_key from staytrack.stay_charge_entries where kind='waiver_record' and actor_auth_user_id=$1 limit 1",
          [actor],
        )
      ).rows[0];
      const waiver = await staffAudit(
        parseAuditFilters({
          actor,
          action: "stay.waiver_record",
          subjectType: "room_item",
          subjectId: event.room_booking_id,
        }),
        pool,
      );
      assert.ok(waiver.entries.length);
      for (const row of waiver.entries) {
        assert.deepEqual(Object.keys(row).sort(), [
          "action",
          "actorId",
          "id",
          "occurredAt",
          "subjectId",
          "subjectType",
        ]);
        assert.equal(row.subjectId, event.room_booking_id);
      }
      assert.equal(JSON.stringify(waiver).includes(event.reason), false);
      assert.equal(JSON.stringify(waiver).includes(event.request_key), false);
      const maintenance = await staffAudit(
        parseAuditFilters({
          actor,
          action: "room.maintenance.open",
          subjectType: "room",
        }),
        pool,
      );
      assert.ok(maintenance.entries.length);
      assert.ok(
        maintenance.entries.every((row) =>
          row.id.startsWith("maintenance_events:"),
        ),
      );
      const housekeeping = await staffAudit(
        parseAuditFilters({
          actor,
          action: "room.housekeeping.ready",
          subjectType: "room",
        }),
        pool,
      );
      assert.ok(housekeeping.entries.length);
      const payment = await staffAudit(
        parseAuditFilters({ subjectType: "payment_submission" }),
        pool,
      );
      assert.ok(payment.entries.length);
      assert.ok(payment.entries.every((row) => Object.keys(row).length === 6));
    },
  );
}
