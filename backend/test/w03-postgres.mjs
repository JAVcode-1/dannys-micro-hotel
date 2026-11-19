import { URL } from "node:url";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkout, monitoredStays } from "../dist/stay-monitoring.js";
import { createWalkInBooking, recordWalkInPayment } from "../dist/walkins.js";
export async function w03Postgres(
  t,
  pool,
  { actor, item, onlineItem, onlineStay },
) {
  await t.test(
    "W03 PostgreSQL: atomic checkout, concurrent retries, unpaid exceptions, buffer and multi-room isolation",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261119001000_room_checkout.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const denied = (
        await pool.query(`select c.relrowsecurity as rls,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon,
   has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated
   from pg_class c where c.oid='staytrack.room_checkouts'::regclass`)
      ).rows[0];
      assert.deepEqual(denied, {
        rls: true,
        anon: false,
        authenticated: false,
      });
      await pool.query(
        "update staytrack.operational_settings set checkout_warning_minutes=array[30,15,5]",
      );
      assert.deepEqual(
        (await monitoredStays(pool)).warningMinutes,
        [30, 15, 5],
      );
      const schedules = async () =>
        (
          await pool.query(
            "select id,start_at,end_at,pricing_snapshot,total_centavos,status from staytrack.room_bookings order by id",
          )
        ).rows;
      const before = await schedules();
      const originalClaim = (
        await pool.query(
          "select i.* from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id where b.id=$1",
          [item.id],
        )
      ).rows[0];
      const snapshot = async () =>
        (
          await pool.query(
            `select i.state,rm.operational_state,(select count(*)::int from staytrack.room_checkouts) as departures,
    (select count(*)::int from staytrack.room_blocks where reason='Checkout cleaning buffer') as buffers
    from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id
    join staytrack.rooms rm on rm.id=i.room_id where b.id=$1`,
            [item.id],
          )
        ).rows[0];
      const stateBefore = await snapshot();
      const input = {
        requestKey: "w03-paid-checkout-retry",
        exceptionReason: null,
      };
      await pool.query(`create function staytrack.w03_audit_fail() returns trigger language plpgsql as $$ begin
    if new.action like 'room.checked_out%' then raise exception 'W03 audit failure'; end if; return new; end $$;
    create trigger w03_audit_fail before insert on staytrack.staff_audit for each row execute function staytrack.w03_audit_fail()`);
      await assert.rejects(
        checkout(actor, item.id, input, pool),
        /W03 audit failure/,
      );
      assert.deepEqual(await snapshot(), stateBefore);
      await pool.query(
        "drop trigger w03_audit_fail on staytrack.staff_audit; drop function staytrack.w03_audit_fail()",
      );
      const results = await Promise.all([
        checkout(actor, item.id, input, pool),
        checkout(actor, item.id, input, pool),
        checkout(actor, item.id, input, pool),
      ]);
      assert.ok(
        results.every((r) => +r.checked_out_at === +results[0].checked_out_at),
      );
      assert.equal(results[0].balance_centavos, "0");
      assert.equal((await snapshot()).operational_state, "cleaning");
      assert.equal((await snapshot()).state, "released");
      await assert.rejects(
        checkout(
          actor,
          item.id,
          { ...input, exceptionReason: "changed" },
          pool,
        ),
        /different request/,
      );
      const buffer = (
        await pool.query("select * from staytrack.room_blocks where id=$1", [
          results[0].cleaning_block_id,
        ])
      ).rows[0];
      assert.equal(+buffer.start_at, +results[0].checked_out_at);
      assert.ok(+buffer.end_at >= +originalClaim.buffered_end_at);
      assert.ok(
        +buffer.end_at >=
          +buffer.start_at + originalClaim.buffer_minutes * 60000,
      );
      await assert.rejects(
        pool.query("delete from staytrack.room_blocks where id=$1", [
          buffer.id,
        ]),
        /protected/,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.room_checkouts set exception_reason=$2 where room_booking_id=$1",
          [item.id, "changed"],
        ),
        /immutable/,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.inventory_claims set state='confirmed' where id=$1",
          [originalClaim.id],
        ),
        /protected/,
      );
      assert.deepEqual(await schedules(), before);
      assert.equal(
        (
          await pool.query(
            "select operational_state from staytrack.rooms where id=$1",
            [onlineStay.room_id],
          )
        ).rows[0].operational_state,
        "occupied",
      );
      assert.equal(
        (
          await pool.query(
            "select checkout_at from staytrack.room_check_ins where room_booking_id=$1",
            [onlineItem.id],
          )
        ).rows[0].checkout_at.toISOString(),
        onlineStay.checkout_at.toISOString(),
      );

      // A disposable fixture room, never a hotel identifier or hosted seed.
      const room = (
        await pool.query(`insert into staytrack.rooms(category_id,code,operational_state,active)
    select id,'W03-SYNTHETIC-ONLY','ready',true from staytrack.room_categories where code='double_standard' returning id`)
      ).rows[0];
      const conflicts =
        await pool.query(`select i.id,i.state,rm.code,p.reason,p.start_at,p.end_at,
        i.start_at as claim_start,i.buffered_end_at as claim_end
        from staytrack.inventory_claims i join staytrack.rooms rm on rm.id=i.room_id
        join staytrack.room_blocks p on p.room_id=i.room_id
        where i.state not in ('released','expired') and tstzrange(i.start_at,i.buffered_end_at,'[)') && tstzrange(p.start_at,p.end_at,'[)')`);
      assert.deepEqual(
        conflicts.rows,
        [],
        "Existing fixture capacity must be feasible before the W03 cart",
      );
      const start = new Date(
        Math.ceil((Date.now() + 100 * 86400000) / 60000) * 60000,
      ).toISOString();
      const booking = await createWalkInBooking(
        actor,
        "w03-unpaid-booking-fixture",
        "SYNTHETIC W03",
        [
          {
            category: "double_standard",
            startAt: start,
            blocks: [180],
            adults: 1,
            children: 0,
            extraBed: false,
          },
          {
            category: "family_executive",
            startAt: new Date(Date.parse(start) + 86400000).toISOString(),
            blocks: [360],
            adults: 2,
            children: 0,
            extraBed: false,
          },
        ],
        pool,
      );
      await recordWalkInPayment(
        actor,
        booking.booking.id,
        {
          method: "cash",
          amountCentavos: booking.booking.minimumCentavos,
          requestKey: "w03-half-payment-fixture",
        },
        pool,
      );
      const unpaid = booking.booking.items[0];
      await pool.query(
        `update staytrack.inventory_claims set room_id=$2,start_at=current_timestamp-interval '4 hours',
        end_at=current_timestamp-interval '1 hour',buffered_end_at=current_timestamp-interval '1 hour'+buffer_minutes*interval '1 minute'
        where id=(select claim_id from staytrack.room_bookings where id=$1)`,
        [unpaid.id, room.id],
      );
      await pool.query(
        `insert into staytrack.room_check_ins(room_booking_id,room_id,actor_auth_user_id,request_key,checked_in_at,checkout_at)
        values ($1,$2,$3,'w03-overdue-checkin-fixture',clock_timestamp()-interval '4 hours',clock_timestamp()-interval '1 hour')`,
        [unpaid.id, room.id, actor],
      );
      await pool.query(
        "update staytrack.rooms set operational_state='occupied' where id=$1",
        [room.id],
      );
      const ledgerBefore = (
        await pool.query(
          "select count(*)::int as n from staytrack.walkin_ledger",
        )
      ).rows[0].n;
      const monitor = await monitoredStays(pool);
      const overdue = monitor.items.find((row) => row.id === unpaid.id);
      assert.ok(+overdue.checkout_at < +monitor.serverNow);
      assert.equal(overdue.checked_out_at, null);
      assert.equal(overdue.operational_state, "occupied");
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.walkin_ledger",
          )
        ).rows[0].n,
        ledgerBefore,
      );
      const future = await createWalkInBooking(
        actor,
        "w03-future-claim-fixture",
        "SYNTHETIC FUTURE",
        [
          {
            category: "double_standard",
            startAt: new Date(
              Math.ceil((Date.now() + 5 * 60000) / 60000) * 60000,
            ).toISOString(),
            blocks: [180],
            adults: 1,
            children: 0,
            extraBed: false,
          },
        ],
        pool,
      );
      const futureSnapshot = async () =>
        (
          await pool.query(
            `select b.*,i.state as claim_state,i.start_at as claim_start,i.end_at as claim_end,i.buffered_end_at,i.room_id
        from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1`,
            [future.booking.items[0].id],
          )
        ).rows[0];
      const futureBefore = await futureSnapshot();
      assert.equal(futureBefore.room_id, room.id);
      const peer = (
        await pool.query(
          `select b.*,i.state as claim_state,i.start_at as claim_start,i.end_at as claim_end from staytrack.room_bookings b
    join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1`,
          [booking.booking.items[1].id],
        )
      ).rows[0];
      await assert.rejects(
        checkout(
          actor,
          unpaid.id,
          { requestKey: "w03-no-exception-fixture" },
          pool,
        ),
        /Settle/,
      );
      await pool.query(
        "update staytrack.staff_accounts set active=false where auth_user_id=$1",
        [actor],
      );
      await assert.rejects(
        checkout(
          actor,
          unpaid.id,
          {
            requestKey: "w03-exception-fixture",
            exceptionReason: "Synthetic documented unpaid departure",
          },
          pool,
        ),
        /Staff access denied/,
      );
      await pool.query(
        "update staytrack.staff_accounts set active=true where auth_user_id=$1",
        [actor],
      );
      const exception = {
        requestKey: "w03-exception-fixture",
        exceptionReason: "Synthetic documented unpaid departure",
      };
      const races = await Promise.allSettled([
        checkout(actor, unpaid.id, exception, pool),
        checkout(
          actor,
          unpaid.id,
          { ...exception, requestKey: "w03-competing-checkout" },
          pool,
        ),
      ]);
      assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        races.filter((r) => r.status === "rejected" && r.reason.status === 409)
          .length,
        1,
      );
      const departed = races.find((r) => r.status === "fulfilled").value;
      assert.equal(
        Number(departed.balance_centavos),
        booking.booking.totalCentavos - booking.booking.minimumCentavos,
      );
      assert.ok(departed.exception_reason);
      assert.deepEqual(await futureSnapshot(), futureBefore);
      const lateBlock = (
        await pool.query("select * from staytrack.room_blocks where id=$1", [
          departed.cleaning_block_id,
        ])
      ).rows[0];
      assert.ok(+lateBlock.end_at > +futureBefore.claim_start);
      assert.ok(+lateBlock.end_at >= +departed.checked_out_at + 15 * 60000);
      const settled = await recordWalkInPayment(
        actor,
        booking.booking.id,
        {
          method: "cash",
          amountCentavos: Number(departed.balance_centavos),
          requestKey: "w03-collect-after-departure",
        },
        pool,
      );
      assert.equal(settled.booking.balanceCentavos, 0);
      assert.equal(
        Number(
          (
            await pool.query(
              "select balance_centavos from staytrack.room_checkouts where room_booking_id=$1",
              [unpaid.id],
            )
          ).rows[0].balance_centavos,
        ),
        Number(departed.balance_centavos),
      );

      assert.deepEqual(
        (
          await pool.query(
            `select b.*,i.state as claim_state,i.start_at as claim_start,i.end_at as claim_end from staytrack.room_bookings b
    join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1`,
            [peer.id],
          )
        ).rows[0],
        peer,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.staff_audit where action='room.checked_out_unpaid_exception'",
          )
        ).rows[0].n,
        1,
      );

      // Overdue is derived from immutable time; reading never checks out or charges.
      const amounts = (
        await pool.query(
          "select count(*)::int as n from staytrack.walkin_ledger",
        )
      ).rows[0].n;
      await pool.query(
        `insert into staytrack.room_blocks(room_id,start_at,end_at,reason)
    values ($1,clock_timestamp()+interval '1 minute',clock_timestamp()+interval '1 hour','W03 FUTURE PROTECTION')`,
        [onlineStay.room_id],
      );
      const online = await checkout(
        actor,
        onlineItem.id,
        { requestKey: "w03-online-checkout-fixture" },
        pool,
      );
      assert.equal(online.balance_centavos, "0");
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.walkin_ledger",
          )
        ).rows[0].n,
        amounts,
      );
      assert.deepEqual(await futureSnapshot(), futureBefore);
      assert.equal(
        (await monitoredStays(pool)).items.find((r) => r.id === unpaid.id)
          .operational_state,
        "cleaning",
      );
    },
  );
}
