import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { allocateRooms } from "../dist/availability.js";
import { recordHousekeeping, staffRooms } from "../dist/rooms.js";
import { checkIn } from "../dist/check-in.js";
import { checkout } from "../dist/stay-monitoring.js";
import { createWalkInBooking, recordWalkInPayment } from "../dist/walkins.js";

export async function h01Postgres(t, pool) {
  const actor = "33333333-3333-4333-8333-333333333333";
  let n = 0;
  const key = () => `h01-synthetic-request-${++n}`;
  await t.test(
    "H01 migration rolls back and denies browser table/function access",
    async () => {
      const sql = readFileSync(
        new URL(
          "../../supabase/migrations/20261120001400_housekeeping_ready.sql",
          import.meta.url,
        ),
        "utf8",
      );
      const db = await pool.connect();
      try {
        await db.query("begin");
        await db.query(sql);
        await db.query("rollback");
        assert.equal(
          (
            await db.query(
              "select to_regclass('staytrack.housekeeping_events') as t",
            )
          ).rows[0].t,
          null,
        );
      } finally {
        await db.query("rollback");
        db.release();
      }
      await pool.query(sql);
      assert.deepEqual(
        (
          await pool.query(
            "select relrowsecurity as rls,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as anon,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as authenticated from pg_class where oid='staytrack.housekeeping_events'::regclass",
          )
        ).rows[0],
        { rls: true, anon: false, authenticated: false },
      );
      for (const fn of [
        "guard_housekeeping_event",
        "apply_housekeeping_event",
        "guard_physical_readiness",
      ])
        assert.equal(
          (
            await pool.query(
              "select has_function_privilege('authenticated',$1,'EXECUTE') as allowed",
              [`staytrack.${fn}()`],
            )
          ).rows[0].allowed,
          false,
        );
    },
  );

  async function make(expired = false) {
    const start =
      Math.ceil((Date.now() + (20000 + n * 4) * 86400000) / 60000) * 60000;
    const result = await createWalkInBooking(
      actor,
      key(),
      "SYNTHETIC H01 ONLY",
      [0, 1].map((i) => ({
        category: "double_standard",
        startAt: new Date(start + i * 86400000).toISOString(),
        blocks: [180],
        adults: 1,
        children: 0,
        extraBed: false,
      })),
      pool,
    );
    const items = (
      await pool.query(
        "select * from staytrack.room_bookings where reservation_id=$1 order by item_index",
        [result.booking.id],
      )
    ).rows;
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
    const room = (
      await pool.query(
        "insert into staytrack.rooms(category_id,code,operational_state,active) select category_id,$1,'ready',true from staytrack.inventory_claims where id=$2 returning id",
        ["H01-SYNTHETIC-" + n, items[0].claim_id],
      )
    ).rows[0].id;
    if (!expired) {
      await checkIn(actor, items[0].id, String(room), key(), pool);
      await checkout(actor, items[0].id, { requestKey: key() }, pool);
    } else {
      // A historical checkout fixture exercises expiry without editing any protected history or advancing the host clock.
      const db = await pool.connect();
      try {
        await db.query("begin");
        await db.query(
          "update staytrack.inventory_claims set room_id=$2,start_at=t.instant-interval '4 hours',end_at=t.instant-interval '1 hour',buffered_end_at=t.instant-interval '1 hour'+buffer_minutes*interval '1 minute' from (select clock_timestamp() as instant) t where id=$1",
          [items[0].claim_id, room],
        );
        await db.query(
          "update staytrack.rooms set operational_state='occupied' where id=$1",
          [room],
        );
        await db.query(
          "insert into staytrack.room_check_ins(room_booking_id,room_id,actor_auth_user_id,request_key,checked_in_at,checkout_at) select $1,room_id,$2,$3,start_at,end_at from staytrack.inventory_claims where id=$4",
          [items[0].id, actor, key(), items[0].claim_id],
        );
        const block = (
          await db.query(
            "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) values($1,clock_timestamp()-interval '50 minutes',clock_timestamp()-interval '30 minutes','Checkout cleaning buffer') returning *",
            [room],
          )
        ).rows[0];
        await db.query(
          "insert into staytrack.room_checkouts(room_booking_id,actor_auth_user_id,request_key,checked_out_at,balance_centavos,cleaning_block_id) select $1,$2,$3,start_at,0,id from staytrack.room_blocks where id=$4",
          [items[0].id, actor, key(), block.id],
        );
        await db.query(
          "update staytrack.inventory_claims set state='released' where id=$1",
          [items[0].claim_id],
        );
        await db.query(
          "update staytrack.rooms set operational_state='cleaning' where id=$1",
          [room],
        );
        await db.query("commit");
      } finally {
        await db.query("rollback");
        db.release();
      }
    }
    return { room: String(room), item: items[0], sibling: items[1] };
  }
  const input = (x, action) => ({
    checkoutId: x.item.id,
    action,
    requestKey: key(),
    ...(action === "ready" ? { checksConfirmed: true } : {}),
  });
  const snapshot = async (x) =>
    (
      await pool.query(
        "select b.*,to_jsonb(i) as claim from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1",
        [x.sibling.id],
      )
    ).rows[0];
  const board = async (x) =>
    (await staffRooms(pool)).find((r) => r.id === x.room);

  await t.test(
    "H01 T21 expired dirty room rejects check-in until explicit Ready; concurrent retries and sibling isolation",
    async () => {
      const x = await make(true);
      const before = await snapshot(x);
      assert.equal((await board(x)).operational_state, "cleaning");
      assert.equal((await board(x)).turnover_until, null);
      const future = Date.now() + 86400000;
      assert.deepEqual(
        allocateRooms(
          [{ id: Number(x.room), category: "double_standard", ready: false }],
          [],
          [],
          [
            {
              id: "h01-future",
              category: "double_standard",
              roomId: null,
              start: future,
              end: future + 3600000,
              bufferMinutes: 15,
            },
          ],
        ),
        [Number(x.room)],
      );
      await assert.rejects(
        checkIn(actor, x.sibling.id, x.room, key(), pool),
        /Ready room/,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.rooms set operational_state='ready' where id=$1",
          [x.room],
        ),
        /Explicit housekeeping/,
      );
      await assert.rejects(
        recordHousekeeping(actor, x.room, input(x, "finish"), pool),
        (e) => e.status === 409,
      );
      const start = input(x, "start");
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          recordHousekeeping(actor, x.room, start, pool),
        ),
      );
      assert.ok(results.every((r) => r.id === results[0].id));
      assert.equal(results[0].actor_auth_user_id, actor);
      await assert.rejects(
        recordHousekeeping(actor, x.room, input(x, "start"), pool),
        (e) => e.status === 409,
      );
      await assert.rejects(
        recordHousekeeping(actor, x.room, input(x, "ready"), pool),
        (e) => e.status === 409,
      );
      await recordHousekeeping(actor, x.room, input(x, "finish"), pool);
      assert.equal((await board(x)).operational_state, "cleaning");
      await assert.rejects(
        checkIn(actor, x.sibling.id, x.room, key(), pool),
        /Ready room/,
      );
      const ready = input(x, "ready");
      const contenders = await Promise.allSettled([
        recordHousekeeping(actor, x.room, ready, pool),
        recordHousekeeping(actor, x.room, input(x, "ready"), pool),
      ]);
      assert.equal(
        contenders.filter((r) => r.status === "fulfilled").length,
        1,
      );
      assert.equal((await board(x)).operational_state, "ready");
      assert.equal((await board(x)).available_now, true);
      assert.deepEqual(await snapshot(x), before);
      const events = (
        await pool.query(
          "select * from staytrack.housekeeping_events where checkout_id=$1 order by id",
          [x.item.id],
        )
      ).rows;
      assert.deepEqual(
        events.map((e) => e.action),
        ["start", "finish", "ready"],
      );
      assert.ok(
        events.every(
          (e, i) => !i || e.occurred_at >= events[i - 1].occurred_at,
        ),
      );
      for (const event of events)
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as n from staytrack.staff_audit a join staytrack.housekeeping_events e on a.actor_auth_user_id=e.actor_auth_user_id and a.action='room.housekeeping.'||e.action and a.occurred_at=e.occurred_at where e.id=$1",
              [event.id],
            )
          ).rows[0].n,
          1,
        );
      await assert.rejects(
        pool.query(
          "update staytrack.housekeeping_events set action='start' where checkout_id=$1",
          [x.item.id],
        ),
        /immutable/i,
      );
      await assert.rejects(
        pool.query(
          "delete from staytrack.housekeeping_events where checkout_id=$1",
          [x.item.id],
        ),
        /immutable/i,
      );
      // A new actual stay may enter the same physical room only now. No sibling schedule is rewritten.
      await checkIn(actor, x.sibling.id, x.room, key(), pool);
      assert.equal((await board(x)).operational_state, "occupied");
      await checkout(actor, x.sibling.id, { requestKey: key() }, pool);
      await assert.rejects(
        recordHousekeeping(actor, x.room, input(x, "start"), pool),
        (e) => e.status === 409,
      );
    },
  );

  await t.test(
    "H01 Ready preserves turnover boundaries; active staff, maintenance conflicts and audit rollback",
    async () => {
      const x = await make();
      const before = await snapshot(x);
      const start = input(x, "start");
      await assert.rejects(
        recordHousekeeping(
          "11111111-1111-4111-8111-111111111119",
          x.room,
          start,
          pool,
        ),
        (e) => e.status === 403,
      );
      await pool.query(
        "update staytrack.staff_accounts set active=false where auth_user_id=$1",
        [actor],
      );
      try {
        await assert.rejects(
          recordHousekeeping(actor, x.room, start, pool),
          (e) => e.status === 403,
        );
      } finally {
        await pool.query(
          "update staytrack.staff_accounts set active=true where auth_user_id=$1",
          [actor],
        );
      }
      await pool.query(
        "update staytrack.rooms set operational_state='maintenance' where id=$1",
        [x.room],
      );
      await assert.rejects(
        recordHousekeeping(actor, x.room, start, pool),
        (e) => e.status === 409,
      );
      await pool.query(
        "update staytrack.rooms set operational_state='cleaning' where id=$1",
        [x.room],
      );
      const block = (
        await pool.query(
          "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) values($1,clock_timestamp(),null,'H01 SYNTHETIC maintenance') returning id",
          [x.room],
        )
      ).rows[0].id;
      await assert.rejects(
        recordHousekeeping(actor, x.room, start, pool),
        (e) => e.status === 409,
      );
      assert.equal((await board(x)).maintenance_now, true);
      await pool.query("delete from staytrack.room_blocks where id=$1", [
        block,
      ]);
      await recordHousekeeping(actor, x.room, start, pool);
      await recordHousekeeping(actor, x.room, input(x, "finish"), pool);
      await pool.query(
        "create function staytrack.h01_audit_failure() returns trigger language plpgsql as $$ begin if new.action='room.housekeeping.ready' then raise exception 'H01 audit injection' using errcode='XX000'; end if; return new; end $$; create trigger h01_audit_failure before insert on staytrack.staff_audit for each row execute function staytrack.h01_audit_failure()",
      );
      const ready = input(x, "ready");
      await assert.rejects(
        recordHousekeeping(actor, x.room, ready, pool),
        /H01 audit injection/,
      );
      assert.equal((await board(x)).operational_state, "cleaning");
      assert.equal((await board(x)).housekeeping.length, 2);
      await pool.query(
        "drop trigger h01_audit_failure on staytrack.staff_audit; drop function staytrack.h01_audit_failure()",
      );
      await recordHousekeeping(actor, x.room, ready, pool);
      const r = await board(x);
      assert.equal(r.operational_state, "ready");
      assert.ok(r.turnover_until);
      assert.equal(r.available_now, false);
      await assert.rejects(
        checkIn(actor, x.sibling.id, x.room, key(), pool),
        /overlaps|turnover/i,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.rooms set operational_state='occupied' where id=$1",
          [x.room],
        ),
        /turnover/,
      );
      const boundary = (
        await pool.query(
          "select tstzrange(b.start_at,b.end_at,'[)') @> (b.end_at-interval '1 microsecond') as before,tstzrange(b.start_at,b.end_at,'[)') @> b.end_at as at_end from staytrack.room_blocks b join staytrack.room_checkouts o on o.cleaning_block_id=b.id where o.room_booking_id=$1",
          [x.item.id],
        )
      ).rows[0];
      assert.deepEqual(boundary, { before: true, at_end: false });
      await assert.rejects(
        pool.query(
          "update staytrack.room_blocks set end_at=clock_timestamp() where id=(select cleaning_block_id from staytrack.room_checkouts where room_booking_id=$1)",
          [x.item.id],
        ),
        /protected/,
      );
      await assert.rejects(
        recordHousekeeping(
          actor,
          x.room,
          { ...ready, action: "start", checksConfirmed: false },
          pool,
        ),
        (e) => e.status === 409,
      );
      assert.deepEqual(await snapshot(x), before);
    },
  );
  await t.test(
    "H01 waits for concurrent maintenance and rejects its committed block without events",
    async () => {
      const x = await make(true);
      const gate = await pool.connect();
      let pending;
      try {
        await gate.query("begin");
        // Maintenance writers follow the shared category-before-block lock order.
        await gate.query(
          "select pg_advisory_xact_lock(category_id) from staytrack.rooms where id=$1",
          [x.room],
        );
        const pid = (await gate.query("select pg_backend_pid() as pid")).rows[0]
          .pid;
        await gate.query(
          "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) values($1,clock_timestamp(),null,'H01 SYNTHETIC concurrent maintenance')",
          [x.room],
        );
        pending = recordHousekeeping(
          actor,
          x.room,
          input(x, "start"),
          pool,
        ).then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        let observed = false;
        for (let i = 0; i < 200; i++) {
          const result = await pool.query(
            "select exists(select 1 from pg_stat_activity where datname=current_database() and $1=any(pg_blocking_pids(pid))) as blocked",
            [pid],
          );
          if (result.rows[0].blocked) {
            observed = true;
            break;
          }
          await delay(10);
        }
        assert.equal(
          observed,
          true,
          "Housekeeping must wait for the actual maintenance transaction",
        );
        await gate.query("commit");
        assert.equal((await pending).error?.status, 409);
        assert.equal((await board(x)).housekeeping.length, 0);
        assert.equal((await board(x)).maintenance_now, true);
      } finally {
        await gate.query("rollback");
        gate.release();
        if (pending) await pending;
      }
    },
  );
  await t.test(
    "Ready releases turnover for existing and new confirmations",
    async () => {
      const alreadyReady = await make();
      const awaitingReady = await make();
      for (const room of [alreadyReady, awaitingReady]) {
        await recordHousekeeping(actor, room.room, input(room, "start"), pool);
        await recordHousekeeping(actor, room.room, input(room, "finish"), pool);
        assert.ok((await board(room)).turnover_until);
        assert.equal((await board(room)).available_now, false);
      }
      await recordHousekeeping(
        actor,
        alreadyReady.room,
        input(alreadyReady, "ready"),
        pool,
      );
      const originalDeadlines = await Promise.all(
        [alreadyReady, awaitingReady].map(
          async (room) => (await board(room)).turnover_until,
        ),
      );
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261124002900_release_turnover_on_ready.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      assert.ok((await board(awaitingReady)).turnover_until);
      await recordHousekeeping(
        actor,
        awaitingReady.room,
        input(awaitingReady, "ready"),
        pool,
      );
      for (const [index, room] of [alreadyReady, awaitingReady].entries()) {
        const ready = await board(room);
        assert.equal(ready.turnover_until, null);
        assert.equal(ready.available_now, true);
        const block = (
          await pool.query(
            "select b.planned_turnover_end_at from staytrack.room_blocks b join staytrack.room_checkouts o on o.cleaning_block_id=b.id where o.room_booking_id=$1",
            [room.item.id],
          )
        ).rows[0];
        assert.deepEqual(
          block.planned_turnover_end_at,
          originalDeadlines[index],
        );
        await checkIn(actor, room.sibling.id, room.room, key(), pool);
      }
    },
  );
}
