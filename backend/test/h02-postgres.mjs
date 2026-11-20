import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { recordMaintenance } from "../dist/maintenance.js";
import { staffRooms, recordHousekeeping } from "../dist/rooms.js";
import { createWalkInBooking, recordWalkInPayment } from "../dist/walkins.js";
import { chooseRescheduleRoom } from "../dist/rescheduling.js";
import { checkIn } from "../dist/check-in.js";
import { checkout } from "../dist/stay-monitoring.js";

export async function h02Postgres(t, pool) {
  await t.test(
    "H02 T20/T22: transactional maintenance, protected bookings, audit and H01 clearance",
    async () => {
      const migration = readFileSync(
        new URL(
          "../../supabase/migrations/20261120001500_room_maintenance.sql",
          import.meta.url,
        ),
        "utf8",
      );
      const db = await pool.connect();
      try {
        await db.query("begin");
        await db.query(migration);
        await db.query("rollback");
        assert.equal(
          (
            await db.query(
              "select to_regclass('staytrack.maintenance_events') as table_name",
            )
          ).rows[0].table_name,
          null,
        );
      } finally {
        await db.query("rollback");
        db.release();
      }
      await pool.query(migration);
      for (const role of ["anon", "authenticated"])
        assert.deepEqual(
          (
            await pool.query(
              `select
        has_table_privilege($1,'staytrack.maintenance_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as tbl,
        has_function_privilege($1,'staytrack.record_maintenance(uuid,bigint,text,bigint,text,text,boolean)','EXECUTE') as fn`,
              [role],
            )
          ).rows[0],
          { tbl: false, fn: false },
        );
      const actor = "33333333-3333-4333-8333-333333333333";
      let sequence = 0;
      const key = () => "h02-fixture-action-" + ++sequence;
      const bookingStart =
        Math.ceil((Date.now() + 40000 * 86400000) / 60000) * 60000;
      const room = (
        await pool.query(`insert into staytrack.rooms(category_id,code,operational_state,active)
        select id,'H02 synthetic room','ready',true from staytrack.room_categories where code='double_standard' returning id`)
      ).rows[0].id;
      await pool.query(
        `insert into staytrack.room_blocks(room_id,start_at,end_at,reason)
        select r.id,$2::timestamptz,$2::timestamptz+interval '6 hours','H02 synthetic fixture allocation'
        from staytrack.rooms r join staytrack.room_categories c on c.id=r.category_id
        where r.id<>$1 and c.code='double_standard'`,
        [room, new Date(bookingStart)],
      );
      const result = await createWalkInBooking(
        actor,
        key(),
        "Synthetic H02",
        [0, 1].map((i) => ({
          category: "double_standard",
          startAt: new Date(bookingStart + i * 86400000).toISOString(),
          blocks: [180],
          adults: 1,
          children: 0,
          extraBed: false,
        })),
        pool,
      );
      await recordWalkInPayment(
        actor,
        result.booking.id,
        {
          requestKey: key(),
          method: "cash",
          amountCentavos: result.booking.totalCentavos,
        },
        pool,
      );
      const items = (
        await pool.query(
          "select * from staytrack.room_bookings where reservation_id=$1 order by item_index",
          [result.booking.id],
        )
      ).rows;
      const claim = async (i) =>
        (
          await pool.query(
            "select * from staytrack.inventory_claims where id=$1",
            [items[i].claim_id],
          )
        ).rows[0];
      await pool.query(
        "delete from staytrack.room_blocks where reason='H02 synthetic fixture allocation'",
      );
      const before = await Promise.all([claim(0), claim(1)]);
      assert.equal(before[0].room_id, room);
      const board = async () =>
        (await staffRooms(pool)).find((r) => r.id === room);
      const post = (action, extra = {}) => ({
        action,
        note: "Synthetic repair inspection",
        requestKey: key(),
        ...extra,
      });
      const act = (input) => recordMaintenance(actor, room, input, pool);
      const deny = (error) => error.status === 409;
      await pool.query(
        "update staytrack.staff_accounts set active=false where auth_user_id=$1",
        [actor],
      );
      try {
        await assert.rejects(
          act(post("open")),
          (error) => error.status === 403,
        );
      } finally {
        await pool.query(
          "update staytrack.staff_accounts set active=true where auth_user_id=$1",
          [actor],
        );
      }
      const opening = post("open");
      const opened = await Promise.all([
        act(opening),
        act(opening),
        act(opening),
      ]);
      assert.ok(opened.every((event) => event.id === opened[0].id));
      await assert.rejects(act(post("open")), deny);
      const blockId = opened[0].block_id;
      const active = await board();
      assert.equal(active.operational_state, "maintenance");
      assert.equal(active.available_now, false);
      assert.equal(active.maintenance.activeBlockId, blockId);
      assert.deepEqual(
        active.maintenance.affected.map(({ itemId, paid }) => ({
          itemId,
          paid,
        })),
        [{ itemId: items[0].id, paid: true }],
      );
      const block = (
        await pool.query("select * from staytrack.room_blocks where id=$1", [
          blockId,
        ])
      ).rows[0];
      const candidates = [
        { id: Number(room), category: "double_standard", ready: false },
      ];
      const target = {
        id: items[1].id,
        category: "double_standard",
        start: +before[1].start_at,
        end: +before[1].end_at,
        bufferMinutes: before[1].buffer_minutes,
        roomId: null,
      };
      assert.equal(
        chooseRescheduleRoom(candidates, [], [], target),
        Number(room),
      );
      assert.equal(
        chooseRescheduleRoom(
          candidates,
          [],
          [{ roomId: Number(room), start: +block.start_at, end: null }],
          target,
        ),
        null,
      );
      assert.deepEqual(await Promise.all([claim(0), claim(1)]), before);
      await assert.rejects(act(post("progress", { blockId: "9999999" })), deny);
      await act(post("progress", { blockId }));
      await assert.rejects(act(post("clear", { blockId })), deny);
      const clear = post("clear", { blockId, restoreReady: true });
      await pool.query(`create function staytrack.h02_audit_failure() returns trigger language plpgsql as $$
      begin if new.action='room.maintenance.clear' then raise exception 'H02 audit injection' using errcode='XX000'; end if; return new; end $$;
      create trigger h02_audit_failure before insert on staytrack.staff_audit for each row execute function staytrack.h02_audit_failure()`);
      try {
        await assert.rejects(act(clear), /H02 audit injection/);
        assert.equal((await board()).maintenance.activeBlockId, blockId);
        assert.equal((await board()).operational_state, "maintenance");
      } finally {
        await pool.query(
          "drop trigger h02_audit_failure on staytrack.staff_audit; drop function staytrack.h02_audit_failure()",
        );
      }
      const cleared = await act(clear);
      assert.deepEqual(await act(clear), cleared);
      assert.equal((await board()).operational_state, "ready");
      assert.equal((await board()).maintenance.activeBlockId, null);
      await assert.rejects(
        pool.query("delete from staytrack.maintenance_events where id=$1", [
          cleared.id,
        ]),
        /immutable/i,
      );
      const audit = (
        await pool.query(
          `select count(*)::int as total from staytrack.staff_audit a join staytrack.maintenance_events e
      on a.actor_auth_user_id=e.actor_auth_user_id and a.occurred_at=e.occurred_at and a.action='room.maintenance.'||e.action
      where e.block_id=$1`,
          [blockId],
        )
      ).rows[0].total;
      assert.equal(audit, 3);
      const [maintenanceRace, checkInRace] = await Promise.allSettled([
        act(post("open")),
        checkIn(actor, items[0].id, room, key(), pool),
      ]);
      if (maintenanceRace.status === "fulfilled") {
        assert.equal(checkInRace.status, "rejected");
        assert.equal(checkInRace.reason.status, 409);
        await act(
          post("clear", {
            blockId: maintenanceRace.value.block_id,
            restoreReady: true,
          }),
        );
        await checkIn(actor, items[0].id, room, key(), pool);
      } else {
        assert.equal(maintenanceRace.reason.status, 409);
        assert.equal(checkInRace.status, "fulfilled");
      }
      await assert.rejects(act(post("open")), deny);
      await checkout(actor, items[0].id, { requestKey: key() }, pool);
      const dirty = await act(post("open"));
      await assert.rejects(
        act(post("clear", { blockId: dirty.block_id, restoreReady: true })),
        deny,
      );
      await act(post("clear", { blockId: dirty.block_id }));
      const cleaning = await board();
      assert.equal(cleaning.operational_state, "cleaning");
      assert.ok(cleaning.turnover_until);
      assert.equal(cleaning.housekeeping.length, 0);
      await recordHousekeeping(
        actor,
        room,
        { checkoutId: items[0].id, action: "start", requestKey: key() },
        pool,
      );
      assert.equal((await board()).housekeeping[0].action, "start");
      assert.deepEqual(await claim(1), before[1]);
    },
  );
}
