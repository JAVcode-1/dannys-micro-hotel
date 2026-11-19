import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import {
  createWalkInBooking,
  recordWalkInPayment,
  walkInBooking,
} from "../dist/walkins.js";
import { createGuestHold, guestReservations } from "../dist/guest-booking.js";
import { submitPaymentProof } from "../dist/payment-proofs.js";
import {
  decidePaymentReview,
  staffPaymentReviews,
} from "../dist/payment-review.js";
import { expireClaims } from "../dist/claim-holds.js";
import { revalidateClaim } from "../dist/inventory-claims.js";
import { checkIn, checkInItems } from "../dist/check-in.js";

export async function w01Postgres(t, pool) {
  await t.test(
    "W01 PostgreSQL: shared walk-in capacity, journal balances, verified mixed payments, cross-channel references, retries and rollback",
    async (w01) => {
      // O03 already asserted maintenance denial; remove only its deliberately conflicting test blocks.
      await pool.query(
        "delete from staytrack.room_blocks where reason='O03 TEST MAINTENANCE'",
      );
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261119000800_walkin_booking_ledger.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const actor = "33333333-3333-4333-8333-333333333333";
      const guest = {
        id: "11111111-1111-4111-8111-111111111111",
        email: "owner@example.test",
      };
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
        "base64",
      );
      const store = { async upload() {}, async remove() {} };
      let counter = 0;
      const cart = (offset) => {
        const start =
          Math.ceil((Date.now() + (500 + offset * 4) * 86400000) / 60000) *
          60000;
        return [
          {
            category: "double_standard",
            startAt: new Date(start).toISOString(),
            blocks: [360],
            adults: 2,
            children: 0,
            extraBed: false,
          },
          {
            category: "family_executive",
            startAt: new Date(start + 86400000).toISOString(),
            blocks: [360],
            adults: 3,
            children: 1,
            extraBed: true,
          },
        ];
      };
      async function make() {
        counter++;
        const items = cart(counter).map((item) => ({
          ...item,
          totalCentavos: 1,
          priceCentavos: 1,
        }));
        const key = `w01-booking-fixture-${String(counter).padStart(4, "0")}`;
        const result = await createWalkInBooking(
          actor,
          key,
          "W01 TEST GUEST",
          items,
          pool,
        );
        return { ...result, key, items };
      }
      const payment = (
        method,
        amountCentavos,
        reference,
        key = `w01-payment-${++counter}-request`,
      ) => ({
        method,
        amountCentavos,
        requestKey: key,
        ...(method === "gcash"
          ? {
              verification: {
                reference,
                recipient: "TEST PAYEE ONLY",
                receivedAt: new Date(Date.now() - 120000).toISOString(),
                ledgerChecked: true,
                receivingAccountChecked: true,
                timeChecked: true,
              },
            }
          : {}),
      });
      const collect = (record, input) =>
        recordWalkInPayment(actor, record.booking.id, input, pool);
      const rights =
        await pool.query(`select c.relrowsecurity as rls,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated from pg_class c
      where c.oid in ('staytrack.walkin_ledger'::regclass,'staytrack.gcash_reference_registry'::regclass)`);
      assert.equal(rights.rowCount, 2);
      assert.ok(rights.rows.every((r) => r.rls && !r.anon && !r.authenticated));
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.gcash_reference_registry",
          )
        ).rows[0].n,
        (
          await pool.query(
            "select count(*)::int as n from staytrack.verified_online_payments",
          )
        ).rows[0].n,
      );
      const record = await make();
      const id = record.booking.id;
      assert.equal(record.booking.totalCentavos, 110000);
      assert.equal(record.booking.collectedCentavos, 0);
      assert.equal(record.booking.minimumCentavos, 55000);
      assert.equal(record.booking.normalCheckInEligible, false);
      assert.equal(record.booking.ledger.length, 2);
      assert.ok(
        record.booking.items.every(
          (item) => item.claimState === "walkin_reserved",
        ),
      );
      assert.deepEqual(
        (
          await pool.query(
            "select owner_auth_user_id,verified_email,created_by,channel,online_confirmation_at from staytrack.reservations where id=$1",
            [id],
          )
        ).rows,
        [
          {
            owner_auth_user_id: null,
            verified_email: null,
            created_by: actor,
            channel: "walk_in",
            online_confirmation_at: null,
          },
        ],
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.payment_reminders where reservation_id=$1",
            [id],
          )
        ).rows[0].n,
        0,
      );
      assert.ok(
        !(await guestReservations(guest, pool)).some((row) => row.id === id),
      );
      const replay = await createWalkInBooking(
        actor,
        record.key,
        "W01 TEST GUEST",
        record.items,
        pool,
      );
      assert.equal(replay.booking.id, id);
      assert.equal(replay.replayed, true);
      await assert.rejects(
        createWalkInBooking(actor, record.key, "CHANGED", record.items, pool),
        /different walk-in/,
      );
      await assert.rejects(
        createWalkInBooking(
          actor,
          "w01-overlap-reserve-001",
          "Other",
          record.items,
          pool,
        ),
        /no longer available/,
      );
      const storedBefore = (
        await pool.query(
          "select id,start_at,end_at,pricing_snapshot,total_centavos from staytrack.room_bookings where reservation_id=$1 order by item_index",
          [id],
        )
      ).rows;
      const under = payment("cash", 54999);
      await collect(record, under);
      assert.equal((await walkInBooking(id, pool)).paymentMinimumMet, false);
      const atMinimum = await collect(record, payment("cash", 1));
      assert.equal(atMinimum.booking.normalCheckInEligible, true);
      await assert.rejects(
        collect(record, {
          ...payment("gcash", 55000, "UNVERIFIED"),
          verification: null,
        }),
        /Verify actual GCash/,
      );
      await assert.rejects(
        collect(record, payment("gcash", 55000, "O03-REF-001")),
        /already collected/,
      );
      const gcash = payment("gcash", 55000, "W01-MIXED-REF");
      const paid = await collect(record, gcash);
      assert.equal(paid.booking.collectedCentavos, 110000);
      assert.equal(paid.booking.balanceCentavos, 0);
      assert.equal((await collect(record, gcash)).replayed, true);
      await assert.rejects(
        collect(record, { ...gcash, amountCentavos: 1 }),
        /different payment/,
      );
      assert.equal(
        paid.booking.ledger.filter((row) => row.kind === "payment").length,
        3,
      );
      assert.deepEqual(
        (
          await pool.query(
            "select id,start_at,end_at,pricing_snapshot,total_centavos from staytrack.room_bookings where reservation_id=$1 order by item_index",
            [id],
          )
        ).rows,
        storedBefore,
      );
      assert.ok(
        paid.booking.ledger.every(
          (row) => row.actorId === actor && row.recordedAt,
        ),
      );
      await expireClaims(Date.now() + 90 * 60000, pool);
      assert.ok(
        (await walkInBooking(id, pool)).items.every(
          (item) => item.claimState === "walkin_reserved",
        ),
      );
      const provisional = (
        await pool.query(
          "select i.* from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id where b.reservation_id=$1 order by i.id",
          [id],
        )
      ).rows[0];
      assert.equal(
        await revalidateClaim(
          Number(provisional.id),
          {
            start: provisional.start_at.getTime(),
            end: provisional.end_at.getTime(),
            bufferMinutes: provisional.buffer_minutes,
            roomId: Number(provisional.room_id),
            state: "confirmed",
          },
          pool,
        ),
        false,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.walkin_ledger set amount_centavos=amount_centavos where reservation_id=$1",
          [id],
        ),
        /immutable/,
      );
      await assert.rejects(
        pool.query(
          "delete from staytrack.gcash_reference_registry where normalized_reference='W01MIXEDREF'",
        ),
        /immutable/,
      );

      const concurrent = await make();
      const contenders = await Promise.allSettled([
        collect(concurrent, payment("cash", 60000)),
        collect(concurrent, payment("cash", 60000)),
      ]);
      assert.equal(
        contenders.filter((row) => row.status === "fulfilled").length,
        1,
      );
      assert.equal(
        contenders.filter(
          (row) => row.status === "rejected" && row.reason.status === 409,
        ).length,
        1,
      );
      assert.equal(
        (await walkInBooking(concurrent.booking.id, pool)).collectedCentavos,
        60000,
      );
      const same = await make();
      const retry = payment("cash", 55000);
      const retries = await Promise.all([
        collect(same, retry),
        collect(same, retry),
      ]);
      assert.equal(retries.filter((row) => row.replayed).length, 1);
      assert.equal(
        (await walkInBooking(same.booking.id, pool)).collectedCentavos,
        55000,
      );
      await collect(same, payment("gcash", 55000, "W01-T11-MIXED"));
      const mixed = await walkInBooking(same.booking.id, pool);
      assert.deepEqual(
        mixed.ledger
          .filter((entry) => entry.kind === "payment")
          .map((entry) => [entry.method, entry.amountCentavos])
          .sort(),
        [
          ["cash", 55000],
          ["gcash", 55000],
        ],
      );
      assert.equal(mixed.collectedCentavos, 110000);
      assert.equal(mixed.balanceCentavos, 0);

      async function online(reference) {
        counter++;
        const hold = await createGuestHold(
          guest,
          `w01-online-booking-${counter}`,
          "W01 ONLINE TEST",
          cart(counter),
          pool,
        );
        const receivedAt = new Date(Date.now() - 120000).toISOString();
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as n from staytrack.payment_reminders where reservation_id=$1",
              [hold.id],
            )
          ).rows[0].n,
          2,
        );
        await submitPaymentProof(
          guest,
          hold.id,
          reference,
          png,
          "image/png",
          pool,
          store,
        );
        const submission = (
          await pool.query(
            "select id from staytrack.payment_submissions where reservation_id=$1",
            [hold.id],
          )
        ).rows[0];
        return {
          id: submission.id,
          holdId: hold.id,
          input: {
            decision: "confirmed",
            expectedVersion: 0,
            requestKey: `w01-online-review-${counter}`,
            note: "W01 synthetic ledger verification",
            verification: {
              ledgerChecked: true,
              receivingAccountChecked: true,
              timeChecked: true,
              reference,
              recipient: "TEST PAYEE ONLY",
              amountCentavos: 110000,
              receivedAt,
            },
          },
        };
      }
      const duplicatedOnline = await online("w01 mixed ref");
      assert.equal(
        (await staffPaymentReviews(pool)).find(
          (row) => row.id === duplicatedOnline.id,
        ).duplicateReference,
        true,
      );
      await assert.rejects(
        decidePaymentReview(
          actor,
          duplicatedOnline.id,
          duplicatedOnline.input,
          pool,
        ),
        /already verified/,
      );
      const raceWalkIn = await make();
      const raceOnline = await online("W01-CROSS-RACE");
      const cross = await Promise.allSettled([
        collect(raceWalkIn, payment("gcash", 55000, "w01 cross race")),
        decidePaymentReview(actor, raceOnline.id, raceOnline.input, pool),
      ]);
      assert.equal(cross.filter((row) => row.status === "fulfilled").length, 1);
      assert.equal(
        cross.filter(
          (row) => row.status === "rejected" && row.reason.status === 409,
        ).length,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.gcash_reference_registry where normalized_reference='W01CROSSRACE'",
          )
        ).rows[0].n,
        1,
      );
      const verifiedOnline = await online("W01-ONLINE-FIRST");
      await decidePaymentReview(
        actor,
        verifiedOnline.id,
        verifiedOnline.input,
        pool,
      );
      const afterOnline = await make();
      await assert.rejects(
        collect(afterOnline, payment("gcash", 55000, "w01 online first")),
        /already collected/,
      );

      const failure = await make();
      const failedPayment = payment("gcash", 55000, "W01-ROLLBACK-REF");
      const counts = async () =>
        (
          await pool.query(`select (select count(*) from staytrack.reservations)::int as reservations,
      (select count(*) from staytrack.inventory_claims)::int as claims,(select count(*) from staytrack.walkin_ledger)::int as entries,
      (select count(*) from staytrack.staff_audit)::int as audits,(select count(*) from staytrack.gcash_reference_registry)::int as refs`)
        ).rows[0];
      const countBefore = await counts();
      await pool.query(`create function staytrack.w01_test_audit_fail() returns trigger language plpgsql as $$ begin
      if new.action like 'walkin.%' then raise exception 'W01 audit failure'; end if; return new; end $$;
      create trigger w01_test_audit_fail before insert on staytrack.staff_audit for each row execute function staytrack.w01_test_audit_fail()`);
      await assert.rejects(
        collect(failure, failedPayment),
        /W01 audit failure/,
      );
      counter++;
      await assert.rejects(
        createWalkInBooking(
          actor,
          `w01-failed-booking-${counter}`,
          "Test rollback",
          cart(counter),
          pool,
        ),
        /W01 audit failure/,
      );
      assert.deepEqual(await counts(), countBefore);
      await pool.query(
        "drop trigger w01_test_audit_fail on staytrack.staff_audit; drop function staytrack.w01_test_audit_fail()",
      );
      assert.equal(
        (await collect(failure, failedPayment)).booking.collectedCentavos,
        55000,
      );
      await pool.query(
        "update staytrack.staff_accounts set active=false where auth_user_id=$1",
        [actor],
      );
      await assert.rejects(
        collect(failure, payment("cash", 1)),
        /Staff access denied/,
      );
      await pool.query(
        "update staytrack.staff_accounts set active=true where auth_user_id=$1",
        [actor],
      );
      const released = await make();
      await pool.query(
        "update staytrack.inventory_claims set state='released' where id in (select claim_id from staytrack.room_bookings where reservation_id=$1)",
        [released.booking.id],
      );
      assert.equal(
        (await walkInBooking(released.booking.id, pool)).normalCheckInEligible,
        false,
      );
      await assert.rejects(
        collect(released, payment("cash", 1)),
        /Capacity requires reconciliation/,
      );
      // Deliberate maintenance conflict is last so it cannot invalidate earlier shared allocations.
      counter++;
      const blockedCart = cart(counter);
      const room = (
        await pool.query(
          "select id from staytrack.rooms where code='DS-TEST-V02'",
        )
      ).rows[0];
      await pool.query(
        "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) values ($1,$2,$3,'W01 TEST BLOCK')",
        [
          room.id,
          blockedCart[0].startAt,
          new Date(
            Date.parse(blockedCart[0].startAt) + 360 * 60000,
          ).toISOString(),
        ],
      );
      await assert.rejects(
        createWalkInBooking(
          actor,
          `w01-blocked-booking-${counter}`,
          "Blocked",
          blockedCart,
          pool,
        ),
        /no longer available/,
      );
      await w01.test(
        "W02 check-in rejects unpaid and dirty stays, preserves online checkout and serializes room occupancy",
        async () => {
          await pool.query(
            readFileSync(
              new URL(
                "../../supabase/migrations/20261119000900_room_check_in.sql",
                import.meta.url,
              ),
              "utf8",
            ),
          );
          const item = same.booking.items[0];
          const key = "w02-fixture-retry";
          await assert.rejects(
            checkIn(actor, afterOnline.booking.items[0].id, room.id, key, pool),
            /50% payment minimum/,
          );
          await pool.query(
            "update staytrack.rooms set operational_state='cleaning' where id=$1",
            [room.id],
          );
          await assert.rejects(
            checkIn(actor, item.id, room.id, key, pool),
            /Ready room/,
          );
          await pool.query(
            "update staytrack.rooms set operational_state='ready' where id=$1",
            [room.id],
          );
          const block = (
            await pool.query(
              `insert into staytrack.room_blocks(room_id,start_at,end_at,reason)
          values ($1,clock_timestamp()-interval '1 minute',null,'W02 TEST BLOCK') returning id`,
              [room.id],
            )
          ).rows[0];
          await assert.rejects(
            checkIn(actor, item.id, room.id, key, pool),
            /Maintenance overlaps/,
          );
          await pool.query("delete from staytrack.room_blocks where id=$1", [
            block.id,
          ]);
          const results = await Promise.allSettled([
            checkIn(actor, item.id, room.id, key, pool),
            checkIn(actor, item.id, room.id, "w02-other-attempt", pool),
          ]);
          assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1,
          );
          const stay = results.find(
            (result) => result.status === "fulfilled",
          ).value;
          assert.equal(+stay.checkout_at - +stay.checked_in_at, 360 * 60000);
          assert.deepEqual(
            await checkIn(actor, item.id, room.id, stay.request_key, pool),
            stay,
          );
          const occupied = await pool.query(
            "select operational_state from staytrack.rooms where id=$1",
            [room.id],
          );
          assert.equal(occupied.rows[0].operational_state, "occupied");

          const onlineItem = (
            await pool.query(
              `select b.id,i.room_id from staytrack.room_bookings b
          join staytrack.inventory_claims i on i.id=b.claim_id
          where b.reservation_id=$1 and b.category_code='family_executive'`,
              [verifiedOnline.holdId],
            )
          ).rows[0];
          const checkout = new Date(Date.now() + 3 * 3600000);
          await pool.query(
            "update staytrack.room_bookings set start_at=$2,end_at=$3 where id=$1",
            [onlineItem.id, new Date(Date.now() - 61 * 60000), checkout],
          );
          assert.equal(
            (await checkInItems(pool)).find((row) => row.id === onlineItem.id)
              .late,
            true,
          );
          assert.equal(
            (
              await pool.query(
                `select i.state from staytrack.inventory_claims i
            join staytrack.room_bookings b on b.claim_id=i.id where b.id=$1`,
                [onlineItem.id],
              )
            ).rows[0].state,
            "confirmed",
          );
          await pool.query(
            "update staytrack.room_bookings set start_at=$2,end_at=$3 where id=$1",
            [onlineItem.id, new Date(Date.now() - 45 * 60000), checkout],
          );
          const onlineStay = await checkIn(
            actor,
            onlineItem.id,
            onlineItem.room_id,
            "w02-online-fixture",
            pool,
          );
          assert.equal(+onlineStay.checkout_at, +checkout);
        },
      );
    },
  );
}
