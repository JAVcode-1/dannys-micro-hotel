import assert from "node:assert/strict";
import { staffReservationDetail } from "../dist/reservation-workspace.js";
import { readFileSync } from "node:fs";
import { checkIn, checkInItems, recordNoShow } from "../dist/check-in.js";
import { inspectLegacyRoom, staffRooms } from "../dist/rooms.js";
import { administerRoom } from "../dist/rooms.js";
import {
  recordMaintenance,
  reassignMaintenanceBooking,
} from "../dist/maintenance.js";
import { createClaims } from "../dist/inventory-claims.js";
import { createWalkInBooking, recordWalkInPayment } from "../dist/walkins.js";
import { requestExtension, decideExtension } from "../dist/extensions.js";
import {
  recordStayReceipt,
  allocateStayReceipt,
} from "../dist/stay-finance.js";
import { URL } from "node:url";

export async function staffOperationalPostgres(t, pool) {
  await t.test(
    "C01/C02/C06 inspection and approved early arrival are persisted, private and duration safe",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261121002100_staff_operational_corrections.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const actor = (
        await pool.query(
          "select auth_user_id from staytrack.staff_accounts where active limit 1",
        )
      ).rows[0].auth_user_id;
      const room = (
        await pool.query(
          "insert into staytrack.rooms(category_id,code,operational_state,active) select id,'STAFF-OPS-SYNTHETIC','unverified',true from staytrack.room_categories where code='double_standard' returning id::text",
        )
      ).rows[0].id;
      const input = {
        checksConfirmed: true,
        note: "Synthetic current room inspection; no fabricated history",
        requestKey: "staff-inspection-fixture-001",
      };
      await assert.rejects(
        inspectLegacyRoom(
          actor,
          room,
          { ...input, checksConfirmed: false },
          pool,
        ),
        /Confirm current/,
      );
      await inspectLegacyRoom(actor, room, input, pool);
      await inspectLegacyRoom(actor, room, input, pool);
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.room_inspections where room_id=$1",
            [room],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        inspectLegacyRoom(actor, room, { ...input, note: "changed" }, pool),
        /conflicts/,
      );
      assert.equal(
        (
          await pool.query(
            "select staytrack.room_is_physically_ready($1) as ready",
            [room],
          )
        ).rows[0].ready,
        true,
      );
      const available = (await checkInItems(pool)).filter(
        (x) =>
          x.channel === "online" &&
          !x.checked_in_at &&
          Date.parse(x.start_at) > Date.now() &&
          x.category === "double_standard",
      );
      const item = available.find(
        (x) => !x.no_show_review || x.no_show_review.decision !== "no_show",
      );
      assert.ok(item, "fixture must retain a future confirmed online booking");
      await assert.rejects(
        checkIn(actor, item.id, room, "staff-early-fixture-001", pool),
        /Explicit early/,
      );
      const stay = await checkIn(
        actor,
        item.id,
        room,
        "staff-early-fixture-001",
        pool,
        "Synthetic approved early arrival",
      );
      assert.equal(
        +stay.checkout_at - +stay.checked_in_at,
        Date.parse(item.end_at) - Date.parse(item.start_at),
      );
      assert.equal(
        (
          await pool.query(
            "select reason from staytrack.early_check_in_approvals where room_booking_id=$1",
            [item.id],
          )
        ).rows[0].reason,
        "Synthetic approved early arrival",
      );
      assert.equal(
        (
          await pool.query(
            "select staytrack.room_is_physically_ready($1) as ready",
            [room],
          )
        ).rows[0].ready,
        false,
      );
      await assert.rejects(
        inspectLegacyRoom(
          actor,
          room,
          { ...input, requestKey: "staff-inspection-fixture-002" },
          pool,
        ),
        /conflicts/,
      );
      await assert.rejects(
        recordNoShow(
          actor,
          item.id,
          {
            decision: "no_show",
            note: "Synthetic denied after arrival",
            requestKey: "staff-no-show-fixture-001",
          },
          pool,
        ),
        /Only unarrived/,
      );
      assert.ok((await staffRooms(pool)).find((x) => x.id === room));
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261124003000_cash_for_checked_in_stays.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const cash = await recordStayReceipt(
        actor,
        item.id,
        {
          requestKey: "staff-online-stay-cash-fixture",
          reason: "Synthetic cash received after online guest checked in.",
          method: "cash",
          cashReceived: true,
          amountCentavos: 100,
          receivedAt: new Date().toISOString(),
        },
        pool,
      );
      assert.deepEqual(
        (
          await pool.query(
            "select method,cash_received,normalized_reference from staytrack.stay_receipts where id=$1",
            [cash.id],
          )
        ).rows[0],
        { method: "cash", cash_received: true, normalized_reference: null },
      );
      const tables = (
        await pool.query(
          "select relname,relrowsecurity as rls,has_table_privilege('anon',oid,'select,insert,update,delete') as anon,has_table_privilege('authenticated',oid,'select,insert,update,delete') as authenticated from pg_class where oid in ('staytrack.room_inspections'::regclass,'staytrack.early_check_in_approvals'::regclass,'staytrack.accommodation_no_show_reviews'::regclass)",
        )
      ).rows;
      assert.equal(tables.length, 3);
      assert.ok(tables.every((x) => x.rls && !x.anon && !x.authenticated));
      assert.equal(
        (await staffRooms(pool, true)).find((x) => x.id === room)
          .housekeeping_enabled,
        true,
      );
      assert.equal(
        (await staffRooms(pool, true)).find((x) => x.id === room).maintenance
          .enabled,
        true,
      );
    },
  );
  await t.test(
    "C06 no-show ordering uses recorded decision time and staff mutation locks before insert",
    async () => {
      const actor = (
        await pool.query(
          "select auth_user_id from staytrack.staff_accounts where active limit 1",
        )
      ).rows[0].auth_user_id;
      const start = Date.now() - 2 * 3600000,
        end = Date.now() + 3600000;
      const claim = await createClaims(
        "staff-no-show-synthetic-claim",
        [{ category: "double_standard", start, end, bufferMinutes: 15 }],
        pool,
      );
      assert.equal(claim.status, "created");
      const reservation = (
        await pool.query(
          "insert into staytrack.reservations(owner_auth_user_id,verified_email,primary_name,idempotency_key,request_hash,total_centavos) values($1,'synthetic@example.test','SYNTHETIC NO SHOW','staff-no-show-synthetic-claim',repeat('a',64),20000) returning id",
          [actor],
        )
      ).rows[0].id;
      const item = (
        await pool.query(
          'insert into staytrack.room_bookings(reservation_id,item_index,claim_id,category_code,start_at,end_at,adult_count,child_count,base_centavos,extra_bed_centavos,total_centavos,pricing_snapshot,status) values($1,0,$2,\'double_standard\',$3,$4,1,0,20000,0,20000,\'[{"id":1,"version":1,"durationMinutes":180,"priceCentavos":20000}]\',\'confirmed\') returning id',
          [reservation, claim.ids[0], new Date(start), new Date(end)],
        )
      ).rows[0].id;
      await pool.query(
        "update staytrack.inventory_claims set state='confirmed' where id=$1",
        [claim.ids[0]],
      );
      await pool.query(
        "insert into staytrack.accommodation_no_show_reviews(id,room_booking_id,actor_auth_user_id,request_key,decision,note) overriding system value values(900001,$1,$2,'staff-synthetic-high-id-001','no_show','Synthetic first decision')",
        [item, actor],
      );
      await pool.query(
        "insert into staytrack.accommodation_no_show_reviews(id,room_booking_id,actor_auth_user_id,request_key,decision,note) overriding system value values(900000,$1,$2,'staff-synthetic-low-id-001','expected','Synthetic later reopening')",
        [item, actor],
      );
      assert.equal(
        (await checkInItems(pool)).find((x) => x.id === item).no_show_review
          .decision,
        "expected",
      );
      const decision = {
        decision: "no_show",
        note: "Synthetic manual review",
        requestKey: "staff-no-show-replay-001",
      };
      const rows = await Promise.all([
        recordNoShow(actor, item, decision, pool),
        recordNoShow(actor, item, decision, pool),
      ]);
      assert.equal(String(rows[0].id), String(rows[1].id));
      assert.equal(
        (await checkInItems(pool)).find((x) => x.id === item).no_show_review
          .decision,
        "no_show",
      );
      assert.equal(
        (
          await pool.query(
            "select state from staytrack.inventory_claims where id=$1",
            [claim.ids[0]],
          )
        ).rows[0].state,
        "confirmed",
      );
    },
  );
  await t.test(
    "C02 current inspection reconciles historical departure without inventing cleaning events",
    async () => {
      const actor = (
        await pool.query(
          "select auth_user_id from staytrack.staff_accounts where active limit 1",
        )
      ).rows[0].auth_user_id;
      const room = (
        await pool.query(
          "insert into staytrack.rooms(category_id,code,active,operational_state) select id,'STAFF-HISTORICAL-SYNTHETIC',true,'ready' from staytrack.room_categories where code='double_standard' returning id::text",
        )
      ).rows[0];
      const start = Date.now() - 6 * 3600000,
        end = start + 3 * 3600000;
      const claim = await createClaims(
        "staff-historical-synthetic-claim",
        [{ category: "double_standard", start, end, bufferMinutes: 15 }],
        pool,
      );
      assert.equal(claim.status, "created");
      await pool.query(
        "update staytrack.inventory_claims set room_id=$2,state='confirmed' where id=$1",
        [claim.ids[0], room.id],
      );
      const reservation = (
        await pool.query(
          "insert into staytrack.reservations(owner_auth_user_id,verified_email,primary_name,idempotency_key,request_hash,total_centavos) values($1,'synthetic@example.test','SYNTHETIC HISTORICAL DEPARTURE','staff-historical-synthetic-claim',repeat('a',64),20000) returning id",
          [actor],
        )
      ).rows[0].id;
      const item = (
        await pool.query(
          'insert into staytrack.room_bookings(reservation_id,item_index,claim_id,category_code,start_at,end_at,adult_count,child_count,base_centavos,extra_bed_centavos,total_centavos,pricing_snapshot,status) values($1,0,$2,\'double_standard\',$3,$4,1,0,20000,0,20000,\'[{"id":1,"version":1,"durationMinutes":180,"priceCentavos":20000}]\',\'confirmed\') returning id',
          [reservation, claim.ids[0], new Date(start), new Date(end)],
        )
      ).rows[0].id;
      await pool.query(
        "insert into staytrack.room_check_ins(room_booking_id,room_id,actor_auth_user_id,request_key,checked_in_at,checkout_at) values($1,$2,$3,'staff-historical-checkin-001',$4,$5)",
        [item, room.id, actor, new Date(start), new Date(end)],
      );
      const block = (
        await pool.query(
          "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) values($1,$2,$3,'Synthetic historical protected checkout buffer') returning id",
          [room.id, new Date(end), new Date(end + 15 * 60000)],
        )
      ).rows[0].id;
      await pool.query(
        "insert into staytrack.room_checkouts(room_booking_id,actor_auth_user_id,request_key,checked_out_at,balance_centavos,exception_reason,cleaning_block_id) values($1,$2,'staff-historical-checkout-001',$3,20000,'Synthetic documented unpaid historical departure',$4)",
        [item, actor, new Date(end), block],
      );
      await pool.query(
        "update staytrack.inventory_claims set state='released' where id=$1",
        [claim.ids[0]],
      );
      assert.equal(
        (
          await pool.query(
            "select staytrack.room_is_physically_ready($1) as ready",
            [room.id],
          )
        ).rows[0].ready,
        false,
      );
      const before = (
        await pool.query(
          "select count(*)::int as n from staytrack.housekeeping_events where room_id=$1",
          [room.id],
        )
      ).rows[0].n;
      await inspectLegacyRoom(
        actor,
        room.id,
        {
          checksConfirmed: true,
          note: "Synthetic current inspection after historical departure",
          requestKey: "staff-historical-inspection-001",
        },
        pool,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.housekeeping_events where room_id=$1",
            [room.id],
          )
        ).rows[0].n,
        before,
      );
      assert.equal(
        (
          await pool.query(
            "select staytrack.room_is_physically_ready($1) as ready",
            [room.id],
          )
        ).rows[0].ready,
        true,
      );
    },
  );
  await t.test(
    "C08/C09 maintenance reassignment preserves booking money and room administration refuses active capacity",
    async (subtest) => {
      const actor = (
        await pool.query(
          "select auth_user_id from staytrack.staff_accounts where active limit 1",
        )
      ).rows[0].auth_user_id;
      const item = (
        await pool.query(
          "select b.id,b.claim_id,i.room_id::text as room_id,b.pricing_snapshot,b.total_centavos from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id join staytrack.rooms rm on rm.id=i.room_id where i.state='confirmed' and i.start_at>clock_timestamp() and rm.operational_state not in ('occupied','maintenance') and not exists(select 1 from staytrack.room_blocks bl where bl.room_id=rm.id and tstzrange(bl.start_at,bl.end_at,'[)') @> clock_timestamp()) and not exists(select 1 from staytrack.room_check_ins ci where ci.room_booking_id=b.id) order by i.start_at limit 1",
        )
      ).rows[0];
      assert.ok(item);
      const target = (
        await pool.query(
          "insert into staytrack.rooms(category_id,code,operational_state,active) select category_id,'STAFF-REASSIGN-SYNTHETIC','unverified',true from staytrack.inventory_claims where id=$1 returning id::text",
          [item.claim_id],
        )
      ).rows[0].id;
      await inspectLegacyRoom(
        actor,
        target,
        {
          checksConfirmed: true,
          note: "Synthetic inspected replacement",
          requestKey: "staff-reassignment-inspection-001",
        },
        pool,
      );
      await inspectLegacyRoom(
        actor,
        item.room_id,
        {
          checksConfirmed: true,
          note: "Synthetic current source inspection before repair",
          requestKey: "staff-reassignment-source-inspection-001",
        },
        pool,
      );
      await recordMaintenance(
        actor,
        item.room_id,
        {
          action: "open",
          note: "Synthetic maintenance recovery",
          requestKey: "staff-reassignment-maintenance-001", // gitleaks:allow -- synthetic retry identifier, not a credential.
        },
        pool,
      );
      const input = {
        itemId: item.id,
        targetRoomId: target,
        note: "Synthetic approved same-category transfer",
        requestKey: "staff-reassignment-command-001",
      };
      await reassignMaintenanceBooking(actor, item.room_id, input, pool);
      await reassignMaintenanceBooking(actor, item.room_id, input, pool);
      assert.equal(
        String(
          (
            await pool.query(
              "select room_id from staytrack.inventory_claims where id=$1",
              [item.claim_id],
            )
          ).rows[0].room_id,
        ),
        target,
      );
      const after = (
        await pool.query(
          "select pricing_snapshot,total_centavos from staytrack.room_bookings where id=$1",
          [item.id],
        )
      ).rows[0];
      assert.deepEqual(after, {
        pricing_snapshot: item.pricing_snapshot,
        total_centavos: item.total_centavos,
      });
      const maintenance = (
        await pool.query(
          "select block_id from staytrack.maintenance_events where request_key='staff-reassignment-maintenance-001' and actor_auth_user_id=$1", // gitleaks:allow -- synthetic retry lookup, not a credential.
          [actor],
        )
      ).rows[0];
      await recordMaintenance(
        actor,
        item.room_id,
        {
          action: "clear",
          blockId: String(maintenance.block_id),
          note: "Synthetic repair completed after reassignment",
          requestKey: "staff-reassignment-maintenance-clear-001", // gitleaks:allow -- synthetic retry identifier, not a credential.
          restoreReady: true,
        },
        pool,
      );
      await subtest.test(
        "C01 forward readiness migration retains funded approved extensions",
        async () => {
          const actor = (
            await pool.query(
              "select auth_user_id from staytrack.staff_accounts where active limit 1",
            )
          ).rows[0].auth_user_id;
          const arrival = new Date(
            Math.ceil((Date.now() + 20 * 86400000) / 60000) * 60000,
          ).toISOString();
          const result = await createWalkInBooking(
            actor,
            "staff-extension-booking-001",
            "SYNTHETIC EXTENSION",
            [
              {
                category: "double_standard",
                startAt: arrival,
                blocks: [180],
                adults: 1,
                children: 0,
                extraBed: false,
              },
            ],
            pool,
          );
          const item = (
            await pool.query(
              "select id,claim_id from staytrack.room_bookings where reservation_id=$1",
              [result.booking.id],
            )
          ).rows[0];
          const room = (
            await pool.query(
              "insert into staytrack.rooms(category_id,code,operational_state,active) select category_id,'STAFF-EXTENSION-SYNTHETIC','unverified',true from staytrack.inventory_claims where id=$1 returning id::text",
              [item.claim_id],
            )
          ).rows[0].id;
          await inspectLegacyRoom(
            actor,
            room,
            {
              checksConfirmed: true,
              note: "Synthetic inspected extension room",
              requestKey: "staff-extension-inspection-001",
            },
            pool,
          );
          await recordWalkInPayment(
            actor,
            result.booking.id,
            {
              requestKey: "staff-extension-deposit-001",
              method: "cash",
              amountCentavos: Math.ceil(result.booking.totalCentavos / 2),
            },
            pool,
          );
          const stay = await checkIn(
            actor,
            item.id,
            room,
            "staff-extension-checkin-001",
            pool,
          );
          const request = await requestExtension(
            actor,
            item.id,
            {
              requestKey: "staff-extension-request-001",
              expectedRevision: 0,
              blocks: [180],
              reason: "Synthetic purchased extension",
            },
            pool,
          );
          const quote = (
            await pool.query(
              "select amount_centavos,new_end from staytrack.stay_extension_requests where id=$1",
              [request.id],
            )
          ).rows[0];
          const amount = Math.ceil(Number(quote.amount_centavos) / 2);
          const receipt = await recordStayReceipt(
            actor,
            item.id,
            {
              requestKey: "staff-extension-receipt-001",
              reason: "Synthetic cash received",
              method: "cash",
              cashReceived: true,
              amountCentavos: amount,
              receivedAt: new Date(Date.now() - 1000).toISOString(),
            },
            pool,
          );
          await allocateStayReceipt(
            actor,
            receipt.id,
            {
              requestKey: "staff-extension-allocate-001",
              reason: "Synthetic extension funding",
              extensionRequestId: request.id,
              amountCentavos: amount,
            },
            pool,
          );
          await decideExtension(
            actor,
            request.id,
            {
              requestKey: "staff-extension-approve-001",
              reason: "Synthetic staff approval",
              expectedRevision: 0,
              approved: true,
            },
            pool,
          );
          const live = (
            await pool.query(
              "select end_at from staytrack.inventory_claims where id=$1",
              [item.claim_id],
            )
          ).rows[0];
          assert.equal(+live.end_at, +quote.new_end);
          assert.equal(+live.end_at - +stay.checkout_at, 180 * 60000);
          const detail = await staffReservationDetail(result.booking.id, pool);
          assert.equal(
            +detail.items.find((row) => row.id === item.id).checkoutAt,
            +quote.new_end,
          );
        },
      );
      await assert.rejects(
        administerRoom(
          actor,
          target,
          {
            code: "STAFF-REASSIGN-SYNTHETIC",
            active: false,
            note: "Synthetic denied deactivation",
            requestKey: "staff-admin-denied-001",
          },
          pool,
        ),
        /Resolve active/,
      );
      const unused = (
        await pool.query(
          "insert into staytrack.rooms(category_id,code,operational_state,active) select id,'STAFF-ADMIN-SYNTHETIC','unverified',false from staytrack.room_categories where code='double_standard' returning id::text",
        )
      ).rows[0].id;
      await inspectLegacyRoom(
        actor,
        unused,
        {
          checksConfirmed: true,
          note: "Synthetic inactive room current inspection",
          requestKey: "staff-admin-inspection-001",
        },
        pool,
      );
      const admin = {
        code: "STAFF-ADMIN-VERIFIED-SYNTHETIC",
        active: true,
        note: "Synthetic confirmed test identifier",
        requestKey: "staff-admin-activation-001",
      };
      await administerRoom(actor, unused, admin, pool);
      await administerRoom(actor, unused, admin, pool);
      assert.equal(
        (
          await pool.query(
            "select code,active from staytrack.rooms where id=$1",
            [unused],
          )
        ).rows[0].active,
        true,
      );
    },
  );
}
