import { URL } from "node:url";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
export async function x03Postgres(t, pool) {
  await t.test(
    "X03 candidate rollback, private roles and immutable event schema",
    async () => {
      const sql = readFileSync(
        new URL(
          "../../supabase/migrations/20261119001300_item_extensions_and_charges.sql",
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
              "select to_regclass('staytrack.stay_extension_requests') as t",
            )
          ).rows[0].t,
          null,
        );
      } finally {
        await db.query("rollback");
        db.release();
      }
      await pool.query(sql);
      const tables = [
        "stay_extension_requests",
        "stay_extension_decisions",
        "stay_charge_reviews",
        "stay_charge_entries",
        "stay_receipts",
        "stay_receipt_allocations",
        "stay_charge_policy_versions",
        "reservation_charge_disclosures",
      ];
      for (const name of tables) {
        const r = (
          await pool.query(
            "select c.relrowsecurity as rls,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as anon,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as authenticated from pg_class c where c.oid=$1::regclass",
            ["staytrack." + name],
          )
        ).rows[0];
        assert.deepEqual(r, { rls: true, anon: false, authenticated: false });
      }
    },
  );
}
import { createWalkInBooking, recordWalkInPayment } from "../dist/walkins.js";
import { checkIn } from "../dist/check-in.js";
import { checkout, monitoredStays } from "../dist/stay-monitoring.js";
import {
  requestExtension,
  decideExtension,
  stayChangeRows,
} from "../dist/extensions.js";
import {
  recordStayReceipt,
  allocateStayReceipt,
  releaseStayAllocation,
  recordStayReview,
  decideStayReview,
  creditStayCharge,
} from "../dist/stay-finance.js";
import { setTimeout as delay } from "node:timers/promises";
export async function x03Behavior(t, pool) {
  await t.test(
    "X03 T03/T16/T23 integrated funding, immutable clocks, policy, races and rollback",
    async () => {
      const actor = "33333333-3333-4333-8333-333333333333";
      let n = 0;
      const key = () => `x03-synthetic-request-${++n}`;
      const reason = "SYNTHETIC isolated X03 evidence";
      async function make(late = false, disclosures = [], family = false) {
        const start =
          Math.ceil((Date.now() + (8000 + n * 3) * 86400000) / 60000) * 60000;
        const result = await createWalkInBooking(
          actor,
          key(),
          "SYNTHETIC X03 ONLY",
          [
            {
              category: family ? "family_executive" : "double_standard",
              startAt: new Date(start).toISOString(),
              blocks: family ? [360] : [180],
              adults: 1,
              children: 0,
              extraBed: family,
            },
            {
              category: "double_standard",
              startAt: new Date(start + 86400000).toISOString(),
              blocks: [360],
              adults: 1,
              children: 0,
              extraBed: false,
            },
          ],
          pool,
          disclosures,
        );
        const reservation = result.booking.id;
        const items = (
          await pool.query(
            "select * from staytrack.room_bookings where reservation_id=$1 order by item_index",
            [reservation],
          )
        ).rows;
        const item = items[0];
        await recordWalkInPayment(
          actor,
          reservation,
          {
            requestKey: key(),
            method: "cash",
            amountCentavos: Math.ceil(result.booking.totalCentavos / 2),
          },
          pool,
        );
        const room = (
          await pool.query(
            "insert into staytrack.rooms(category_id,code,operational_state,active) select category_id,$1,'ready',true from staytrack.inventory_claims where id=$2 returning id",
            ["X03-SYNTHETIC-" + n, item.claim_id],
          )
        ).rows[0].id;
        if (!late) await checkIn(actor, item.id, String(room), key(), pool);
        else {
          const db = await pool.connect();
          try {
            await db.query("begin");
            await db.query(
              "update staytrack.inventory_claims set room_id=$2,start_at=t.instant-interval '195 minutes',end_at=t.instant-interval '15 minutes',buffered_end_at=t.instant-interval '15 minutes'+buffer_minutes*interval '1 minute' from (select clock_timestamp() as instant) t where id=$1",
              [item.claim_id, room],
            );
            await db.query(
              "insert into staytrack.room_check_ins(room_booking_id,room_id,actor_auth_user_id,request_key,checked_in_at,checkout_at) select $1,room_id,$2,$3,start_at,end_at from staytrack.inventory_claims where id=$4",
              [item.id, actor, key(), item.claim_id],
            );
            await db.query(
              "update staytrack.rooms set operational_state='occupied' where id=$1",
              [room],
            );
            await db.query("commit");
          } finally {
            await db.query("rollback");
            db.release();
          }
        }
        return { item, reservation, sibling: items[1], room };
      }
      const snap = async (id) =>
        (
          await pool.query(
            "select b.*,i.start_at as claim_start,i.end_at as claim_end,i.room_id,i.buffer_minutes from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id where b.id=$1",
            [id],
          )
        ).rows[0];
      const finance = async (id) =>
        (
          await pool.query(
            "select * from staytrack.reservation_financials where reservation_id=$1",
            [id],
          )
        ).rows[0];
      const req = async (f, blocks = [180]) => {
        const input = {
          requestKey: key(),
          reason,
          expectedRevision: Number(
            (await snap(f.item.id)).stay_extension_revision,
          ),
          blocks,
        };
        const e = await requestExtension(actor, f.item.id, input, pool);
        assert.deepEqual(
          await requestExtension(actor, f.item.id, input, pool),
          e,
        );
        return e;
      };
      const receipt = async (f, amount) =>
        recordStayReceipt(
          actor,
          f.item.id,
          {
            requestKey: key(),
            reason,
            method: "cash",
            cashReceived: true,
            amountCentavos: amount,
            receivedAt: new Date(Date.now() - 1000).toISOString(),
          },
          pool,
        );
      const allocate = async (f, q, r, amount) =>
        allocateStayReceipt(
          actor,
          r.id,
          {
            requestKey: key(),
            reason,
            extensionRequestId: q.id,
            amountCentavos: amount,
          },
          pool,
        );
      const decision = (q, approved = true) => ({
        requestKey: key(),
        reason,
        expectedRevision: q.revision ?? 0,
        approved,
      });
      const f = await make(true),
        before = await snap(f.item.id),
        sibling = await snap(f.sibling.id),
        financialBefore = await finance(f.reservation);
      const q = await req(f);
      const quote = (
        await pool.query(
          "select * from staytrack.stay_extension_requests where id=$1",
          [q.id],
        )
      ).rows[0];
      assert.equal(+quote.new_end - +quote.old_end, 180 * 60000);
      assert.ok(+quote.old_end < Date.now());
      await assert.rejects(
        decideExtension(actor, q.id, decision(q), pool),
        (e) => e.status === 409,
      );
      const minimum = Math.ceil(Number(quote.amount_centavos) / 2),
        r = await receipt(f, minimum + 100);
      await allocate(f, q, r, minimum - 1);
      await assert.rejects(
        decideExtension(actor, q.id, decision(q), pool),
        (e) => e.status === 409,
      );
      await allocate(f, q, r, 1);
      const pending = await finance(f.reservation);
      assert.equal(
        pending.settlement_due_centavos,
        financialBefore.settlement_due_centavos,
      );
      assert.equal(Number(pending.pending_extension_funds_centavos), minimum);
      assert.equal(Number(pending.unallocated_x03_centavos), 100);
      assert.equal(
        pending.refund_due_centavos,
        financialBefore.refund_due_centavos,
      );
      const input = decision(q);
      const approved = await decideExtension(actor, q.id, input, pool).catch(
        (e) => {
          throw e.cause ?? e;
        },
      );
      assert.deepEqual(
        await decideExtension(actor, q.id, input, pool),
        approved,
      );
      const after = await snap(f.item.id);
      assert.equal(+after.claim_end, +quote.new_end);
      assert.equal(after.id, before.id);
      assert.equal(after.claim_id, before.claim_id);
      assert.equal(+after.end_at, +before.end_at);
      assert.deepEqual(after.pricing_snapshot, before.pricing_snapshot);
      assert.deepEqual(await snap(f.sibling.id), sibling);
      const actual = (
        await pool.query(
          "select checkout_at from staytrack.room_check_ins where room_booking_id=$1",
          [f.item.id],
        )
      ).rows[0];
      assert.equal(+actual.checkout_at, +quote.old_end);
      assert.equal(
        Number((await finance(f.reservation)).settlement_due_centavos),
        Number(financialBefore.settlement_due_centavos) +
          Number(quote.amount_centavos) -
          minimum,
      );
      await assert.rejects(
        checkout(actor, f.item.id, { requestKey: key() }, pool),
        /balance|settle|payment/i,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.inventory_claims set end_at=end_at+interval '1 minute',buffered_end_at=buffered_end_at+interval '1 minute' where id=$1",
          [f.item.claim_id],
        ),
        /protected/,
      );
      const q2 = await req(f);
      const quote2 = (
        await pool.query(
          "select * from staytrack.stay_extension_requests where id=$1",
          [q2.id],
        )
      ).rows[0];
      assert.equal(+quote2.old_end, +quote.new_end);
      const r2 = await receipt(f, Number(quote2.amount_centavos));
      await allocate(f, q2, r2, Number(quote2.amount_centavos));
      await decideExtension(
        actor,
        q2.id,
        { ...decision(q2), expectedRevision: 1 },
        pool,
      );
      const views = await stayChangeRows(actor, 0, pool);
      const row = views.find((x) => x.id === f.item.id);
      assert.ok(row);
      assert.equal(Date.parse(row.effectiveCheckoutAt), +quote2.new_end);
      const monitored = (await monitoredStays(pool)).items.find(
        (x) => x.id === f.item.id,
      );
      assert.equal(+monitored.checkout_at, +quote2.new_end);
      const review = await recordStayReview(
        actor,
        f.item.id,
        { requestKey: key(), reason, kind: "smoking" },
        pool,
      );
      await assert.rejects(
        decideStayReview(
          actor,
          review.id,
          { requestKey: key(), reason, action: "charge" },
          pool,
        ),
        (e) => e.status === 409,
      );
      await decideStayReview(
        actor,
        review.id,
        { requestKey: key(), reason, action: "waive" },
        pool,
      );
      await assert.rejects(
        decideStayReview(
          actor,
          review.id,
          { requestKey: key(), reason, action: "waive" },
          pool,
        ),
        (e) => e.status === 409,
      );
      await assert.rejects(
        creditStayCharge(
          actor,
          (
            await pool.query(
              "select id from staytrack.stay_charge_entries where room_booking_id=$1 and kind='extension_debit' limit 1",
              [f.item.id],
            )
          ).rows[0].id,
          { requestKey: key(), reason, amountCentavos: 1 },
          pool,
        ),
        (e) => e.status === 409,
      );
      await assert.rejects(
        recordStayReceipt(
          "11111111-1111-4111-8111-111111111111",
          f.item.id,
          {
            requestKey: key(),
            reason,
            method: "cash",
            cashReceived: true,
            amountCentavos: 1,
            receivedAt: new Date().toISOString(),
          },
          pool,
        ),
        (e) => e.status === 403,
      );
      // Immutable events and client roles are actual SQL denials.
      await assert.rejects(
        pool.query("delete from staytrack.stay_receipts where id=$1", [r.id]),
        /immutable|history/i,
      );
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("set local role authenticated");
        await assert.rejects(
          client.query("select * from staytrack.stay_extension_requests"),
          /permission denied/,
        );
      } finally {
        await client.query("rollback");
        client.release();
      }
      // Maintenance only in the new interval blocks approval; money remains recorded.
      const m = await make(),
        mq = await req(m),
        mr = await receipt(m, 50000);
      await allocate(m, mq, mr, 15000);
      const block = (
        await pool.query(
          "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select $1,new_end-interval '1 minute',new_end+interval '1 minute','X03 SYNTHETIC maintenance' from staytrack.stay_extension_requests where id=$2 returning id",
          [m.room, mq.id],
        )
      ).rows[0];
      await assert.rejects(
        decideExtension(actor, mq.id, decision(mq), pool),
        (e) => e.status === 409,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int as n from staytrack.stay_receipts where id=$1",
            [mr.id],
          )
        ).rows[0].n,
        1,
      );
      await pool.query("delete from staytrack.room_blocks where id=$1", [
        block.id,
      ]);
      // Two separately keyed approvals serialize: exactly one immutable approval/debit.
      const race = await Promise.allSettled([
        decideExtension(actor, mq.id, decision(mq), pool),
        decideExtension(actor, mq.id, decision(mq), pool),
      ]);
      assert.equal(race.filter((x) => x.status === "fulfilled").length, 1);
      // Rejected commitment releases exactly once; no payment is fabricated or refunded.
      const rejected = await make(),
        rq = await req(rejected),
        rr = await receipt(rejected, 15000),
        ra = await allocate(rejected, rq, rr, 15000);
      await decideExtension(actor, rq.id, decision(rq, false), pool);
      const releaseInput = { requestKey: key(), reason };
      const release = await releaseStayAllocation(
        actor,
        ra.id,
        releaseInput,
        pool,
      );
      assert.deepEqual(
        await releaseStayAllocation(actor, ra.id, releaseInput, pool),
        release,
      );
      await assert.rejects(
        releaseStayAllocation(
          actor,
          ra.id,
          { requestKey: key(), reason },
          pool,
        ),
        (e) => e.status === 409,
      );
      // Atomic audit rollback retains original schedule and funded commitment.
      const rollback = await make(),
        bq = await req(rollback),
        br = await receipt(rollback, 15000);
      await allocate(rollback, bq, br, 15000);
      const snapshot = await snap(rollback.item.id);
      await pool.query(
        "create function staytrack.x03_test_fail() returns trigger language plpgsql as $$ begin if new.action='stay.stay_extension_decisions' then raise exception 'X03 synthetic audit failure' using errcode='XX000'; end if; return new; end $$; create trigger x03_test_fail before insert on staytrack.staff_audit for each row execute function staytrack.x03_test_fail()",
      );
      try {
        await assert.rejects(
          decideExtension(actor, bq.id, decision(bq), pool),
          /synthetic audit failure/,
        );
        assert.deepEqual(await snap(rollback.item.id), snapshot);
        assert.equal(
          (
            await pool.query(
              "select count(*)::int as n from staytrack.stay_extension_decisions where request_id=$1",
              [bq.id],
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await pool.query(
          "drop trigger x03_test_fail on staytrack.staff_audit;drop function staytrack.x03_test_fail()",
        );
      }
      // Genuine booking-time policy evidence supports explicit charges, never retroactive decisions.
      const policy = (
        await pool.query(
          "insert into staytrack.stay_charge_policy_versions(kind,rate_centavos,unit,effective_from,disclosure_text,disclosure_version,owner_approval_evidence,approved_at) values('smoking',2500,'incident',clock_timestamp()-interval '1 day','SYNTHETIC disclosed policy only','synthetic-v1','SYNTHETIC TEST APPROVAL ONLY',clock_timestamp()-interval '1 minute') returning id",
        )
      ).rows[0];
      await assert.rejects(
        pool.query(
          "insert into staytrack.reservation_charge_disclosures(reservation_id,policy_version_id,acknowledgement) values($1,$2,'SYNTHETIC retroactive attempt')",
          [f.reservation, policy.id],
        ),
        /booking-time/,
      );
      const disclosed = await make(false, [
        {
          policyVersionId: policy.id,
          acknowledgement: "SYNTHETIC prior disclosure test",
        },
      ]);
      const disclosure = (
        await pool.query(
          "select id from staytrack.reservation_charge_disclosures where reservation_id=$1",
          [disclosed.reservation],
        )
      ).rows[0];
      const sr = await recordStayReview(
        actor,
        disclosed.item.id,
        {
          requestKey: key(),
          reason,
          kind: "smoking",
          policyVersionId: policy.id,
          disclosureId: disclosure.id,
        },
        pool,
      );
      const sc = await decideStayReview(
        actor,
        sr.id,
        { requestKey: key(), reason, action: "charge" },
        pool,
      );
      const money = await receipt(disclosed, 1000);
      await allocateStayReceipt(
        actor,
        money.id,
        { requestKey: key(), reason, chargeId: sc.id, amountCentavos: 1000 },
        pool,
      );
      await assert.rejects(
        creditStayCharge(
          actor,
          sc.id,
          { requestKey: key(), reason, amountCentavos: 1501 },
          pool,
        ),
        (e) => e.status === 409,
      );
      await creditStayCharge(
        actor,
        sc.id,
        { requestKey: key(), reason, amountCentavos: 1500 },
        pool,
      );
      await assert.rejects(
        creditStayCharge(
          actor,
          sc.id,
          { requestKey: key(), reason, amountCentavos: 1 },
          pool,
        ),
        (e) => e.status === 409,
      );
      const late = await make(true);
      const times = (
        await pool.query(
          "select checkout_at,checkout_at+interval '1 minute' as finish from staytrack.room_check_ins where room_booking_id=$1",
          [late.item.id],
        )
      ).rows[0];
      const ot = await recordStayReview(
        actor,
        late.item.id,
        {
          requestKey: key(),
          reason,
          kind: "overtime",
          startAt: new Date(+times.checkout_at + 1000).toISOString(),
          endAt: new Date(+times.finish + 1000).toISOString(),
        },
        pool,
      );
      await decideStayReview(
        actor,
        ot.id,
        { requestKey: key(), reason, action: "waive" },
        pool,
      );
      const overlap = await req(late),
        overlapMoney = await receipt(late, 15000);
      await allocate(late, overlap, overlapMoney, 15000);
      await assert.rejects(
        decideExtension(actor, overlap.id, decision(overlap), pool),
        (e) => e.status === 409,
      );
      // Quote versions are revalidated after actual receipt; money is retained, commitment is releasable.
      const stale = await make(),
        sq = await req(stale),
        srec = await receipt(stale, 15000),
        sa = await allocate(stale, sq, srec, 15000);
      await pool.query(
        "update staytrack.packages set version=version+1 where category_code='double_standard' and duration_minutes=180",
      );
      await assert.rejects(
        decideExtension(actor, sq.id, decision(sq), pool),
        (e) => e.status === 409,
      );
      await releaseStayAllocation(
        actor,
        sa.id,
        { requestKey: key(), reason },
        pool,
      );
      assert.equal(
        Number((await finance(stale.reservation)).unallocated_x03_centavos),
        15000,
      );
      // A historical maintenance interval does not intersect the added interval.
      const historical = await make(),
        hq = await req(historical),
        hr = await receipt(historical, 15000);
      await allocate(historical, hq, hr, 15000);
      await pool.query(
        "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select $1,old_end-interval '5 hours',old_end-interval '4 hours','X03 SYNTHETIC historical' from staytrack.stay_extension_requests where id=$2",
        [historical.room, hq.id],
      );
      await decideExtension(actor, hq.id, decision(hq), pool);
      // Independent checkout/approval ordering, with observed database lock waits.
      async function contend(reservation, firstAction, secondAction) {
        const gate = await pool.connect();
        let first, second;
        async function wait(count) {
          for (let i = 0; i < 200; i++) {
            const n = (
              await gate.query(
                "select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()",
              )
            ).rows[0].n;
            if (n >= count) return;
            await delay(10);
          }
          throw new Error("X03 contention barrier timed out");
        }
        try {
          await gate.query("begin");
          await gate.query(
            "select id from staytrack.reservations where id=$1 for update",
            [reservation],
          );
          first = firstAction().then(
            (v) => ({ v }),
            (e) => ({ e }),
          );
          await wait(1);
          second = secondAction().then(
            (v) => ({ v }),
            (e) => ({ e }),
          );
          await wait(2);
          await gate.query("commit");
          return await Promise.all([first, second]);
        } finally {
          await gate.query("rollback");
          gate.release();
          await Promise.allSettled([first, second].filter(Boolean));
        }
      }
      for (const checkoutFirst of [true, false]) {
        const racing = await make(),
          eq = await req(racing),
          er = await receipt(racing, 15000);
        await allocate(racing, eq, er, 15000);
        const approve = () => decideExtension(actor, eq.id, decision(eq), pool),
          depart = () =>
            checkout(
              actor,
              racing.item.id,
              { requestKey: key(), exceptionReason: reason },
              pool,
            );
        const result = await contend(
          racing.reservation,
          checkoutFirst ? depart : approve,
          checkoutFirst ? approve : depart,
        );
        assert.ok(result[0].v);
        if (checkoutFirst) assert.equal(result[1].e.status, 409);
        else assert.ok(result[1].v);
        const claim = (
          await pool.query(
            "select state from staytrack.inventory_claims where id=$1",
            [racing.item.claim_id],
          )
        ).rows[0];
        assert.equal(claim.state, "released");
      }
      // Original settlement debt still requires the existing explicit departure exception.
      await checkout(
        actor,
        f.item.id,
        { requestKey: key(), exceptionReason: reason },
        pool,
      );
      await assert.rejects(
        requestExtension(
          actor,
          f.item.id,
          { requestKey: key(), reason, expectedRevision: 2, blocks: [180] },
          pool,
        ),
        (e) => e.status === 409,
      );
      const postReview = await recordStayReview(
        actor,
        f.item.id,
        { requestKey: key(), reason, kind: "smoking" },
        pool,
      );
      await decideStayReview(
        actor,
        postReview.id,
        { requestKey: key(), reason, action: "waive" },
        pool,
      );
      // Independent connections: observe actual lock waits before releasing a reservation barrier.
      const concurrent = await make(),
        cq = await req(concurrent),
        cr = await receipt(concurrent, 15000);
      const gate = await pool.connect();
      let first, second;
      try {
        await gate.query("begin");
        await gate.query(
          "select id from staytrack.reservations where id=$1 for update",
          [concurrent.reservation],
        );
        first = allocate(concurrent, cq, cr, 15000).then(
          (v) => ({ v }),
          (e) => ({ e }),
        );
        second = allocate(concurrent, cq, cr, 15000).then(
          (v) => ({ v }),
          (e) => ({ e }),
        );
        let waiting = 0;
        for (let i = 0; i < 100; i++) {
          waiting = (
            await gate.query(
              "select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()",
            )
          ).rows[0].n;
          if (waiting >= 2) break;
          await delay(10);
        }
        assert.ok(waiting >= 2);
        await gate.query("commit");
        const outcomes = await Promise.all([first, second]);
        assert.equal(outcomes.filter((x) => x.v).length, 1);
      } finally {
        await gate.query("rollback");
        gate.release();
        await Promise.allSettled([first, second].filter(Boolean));
      }
      // Normal checkout requires all posted extension debt, without reusing original receipts.
      const full = await make(),
        base = await finance(full.reservation);
      await recordWalkInPayment(
        actor,
        full.reservation,
        {
          requestKey: key(),
          method: "cash",
          amountCentavos: Number(base.settlement_due_centavos),
        },
        pool,
      );
      const fq = await req(full),
        fr = await receipt(full, 30000);
      await allocate(full, fq, fr, 15000);
      await decideExtension(actor, fq.id, decision(fq), pool);
      await assert.rejects(
        checkout(actor, full.item.id, { requestKey: key() }, pool),
        /balance|settle|payment/i,
      );
      await allocate(full, fq, fr, 15000);
      await checkout(actor, full.item.id, { requestKey: key() }, pool);
      const departure = (
        await pool.query(
          "select * from staytrack.room_checkouts where room_booking_id=$1",
          [full.item.id],
        )
      ).rows[0];
      assert.equal(Number(departure.balance_centavos), 0);
      const activeAllocation = (
        await pool.query(
          "select id from staytrack.stay_receipt_allocations where extension_request_id=$1 limit 1",
          [fq.id],
        )
      ).rows[0];
      await assert.rejects(
        releaseStayAllocation(
          actor,
          activeAllocation.id,
          { requestKey: key(), reason },
          pool,
        ),
        (e) => e.status === 409,
      );
      const gcashInput = {
        requestKey: key(),
        reason,
        method: "gcash",
        amountCentavos: 1,
        receivedAt: new Date(Date.now() - 1000).toISOString(),
        verification: {
          reference: "X03-SYNTHETIC-GCASH-UNIQUE",
          recipient: "SYNTHETIC PAYEE ONLY",
          ledgerChecked: true,
          receivingAccountChecked: true,
          timeChecked: true,
        },
      };
      const gr = await recordStayReceipt(actor, full.item.id, gcashInput, pool);
      assert.deepEqual(
        await recordStayReceipt(
          actor,
          full.item.id,
          {
            ...gcashInput,
            verification: {
              timeChecked: true,
              recipient: "SYNTHETIC PAYEE ONLY",
              receivingAccountChecked: true,
              reference: "X03-SYNTHETIC-GCASH-UNIQUE",
              ledgerChecked: true,
            },
          },
          pool,
        ),
        gr,
      );
      await assert.rejects(
        recordStayReceipt(
          actor,
          full.item.id,
          { ...gcashInput, requestKey: key() },
          pool,
        ),
        (e) => e.status === 409,
      );
      const originalReference = (
        await pool.query(
          "select normalized_reference from staytrack.gcash_reference_registry where online_submission_id is not null limit 1",
        )
      ).rows[0].normalized_reference;
      await assert.rejects(
        recordStayReceipt(
          actor,
          full.item.id,
          {
            ...gcashInput,
            requestKey: key(),
            verification: {
              ...gcashInput.verification,
              reference: originalReference,
            },
          },
          pool,
        ),
        (e) => e.status === 409,
      );
      await assert.rejects(
        recordStayReceipt(
          actor,
          full.item.id,
          {
            requestKey: key(),
            reason,
            method: "cash",
            cashReceived: true,
            amountCentavos: Number.MAX_SAFE_INTEGER,
            receivedAt: new Date().toISOString(),
          },
          pool,
        ),
        (e) => e.status === 409,
      );
      assert.deepEqual(
        (
          await pool.query(
            "select * from staytrack.room_checkouts where room_booking_id=$1",
            [full.item.id],
          )
        ).rows[0],
        departure,
      );
      await assert.rejects(
        allocateStayReceipt(
          actor,
          gr.id,
          {
            requestKey: key(),
            reason,
            extensionRequestId: cq.id,
            amountCentavos: 1,
          },
          pool,
        ),
        (e) => e.status === 409,
      );
      // T03 Family continuous-stay extra bed is preserved across repeated extensions.
      const family = await make(false, [], true),
        familyBefore = await snap(family.item.id);
      for (let revision = 0; revision < 2; revision++) {
        const eq = await req(family, [360]),
          charge = Number(
            (
              await pool.query(
                "select amount_centavos from staytrack.stay_extension_requests where id=$1",
                [eq.id],
              )
            ).rows[0].amount_centavos,
          );
        const er = await receipt(family, Math.ceil(charge / 2));
        await allocate(family, eq, er, Math.ceil(charge / 2));
        await decideExtension(
          actor,
          eq.id,
          { ...decision(eq), expectedRevision: revision },
          pool,
        );
      }
      const familyAfter = await snap(family.item.id);
      assert.equal(Number(familyAfter.extra_bed_centavos), 10000);
      assert.deepEqual(
        familyAfter.pricing_snapshot,
        familyBefore.pricing_snapshot,
      );
      assert.equal(familyAfter.total_centavos, familyBefore.total_centavos);
      // Maintenance that follows activation must not obstruct the purchased extension.
      await assert.rejects(
        pool.query(
          "insert into staytrack.room_blocks(room_id,start_at,end_at,reason) select source_room_id,old_end,new_end,'X03 SYNTHETIC losing maintenance' from staytrack.stay_extension_requests where id=$1",
          [hq.id],
        ),
        /conflicts with purchased extension/,
      );
      // Configured zero-priced package has a zero funding threshold.
      await pool.query(
        "update staytrack.packages set price_centavos=0,version=version+1 where category_code='double_standard' and duration_minutes=180",
      );
      const free = await make(),
        freeq = await req(free);
      await decideExtension(actor, freeq.id, decision(freeq), pool);
      assert.equal(
        Number(
          (
            await pool.query(
              "select amount_centavos from staytrack.stay_charge_entries where extension_request_id=$1",
              [freeq.id],
            )
          ).rows[0].amount_centavos,
        ),
        0,
      );
      await pool.query(
        "update staytrack.packages set price_centavos=30000,version=version+1 where category_code='double_standard' and duration_minutes=180",
      );

      const functionACL = (
        await pool.query(
          "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='staytrack' and (p.proname like '%stay_%' or p.proname='guard_charge_disclosure') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))",
        )
      ).rows;
      assert.deepEqual(functionACL, []);
      await assert.rejects(
        pool.query(
          "insert into staytrack.stay_charge_reviews(room_booking_id,actor_auth_user_id,request_key,request_hash,reason,kind,start_at,end_at) values($1,$2,$3,repeat('a',64),$4,'overtime',clock_timestamp(),null)",
          [full.item.id, actor, key(), reason],
        ),
        /check constraint/,
      );
    },
  );
}
