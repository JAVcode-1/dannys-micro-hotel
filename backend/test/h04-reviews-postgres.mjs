import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import {
  createReviewGrant,
  finishReviewOtp,
  issueReviewInvitation,
  loadReviewEligibility,
  redeemReviewInvitation,
  startReviewOtp,
  startReviewPairing,
  withReviewTransaction,
} from "../dist/review-access.js";
import {
  publishedReviews,
  submitGuestReview,
  submitPrivateFeedback,
  withdrawGuestReview,
} from "../dist/reviews.js";
import { staffReviewAction } from "../dist/review-staff.js";

export async function h04ReviewsPostgres(t, pool) {
  await t.test(
    "H04 eligibility requires checkout and tables are private",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261120001600_verified_guest_reviews.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      assert.deepEqual(
        await loadReviewEligibility(
          pool,
          "00000000-0000-4000-8000-000000000000",
        ),
        { first_checkout: null, public_open: false },
      );
      const tables = [
        "guest_reviews",
        "review_contacts",
        "review_credentials",
        "private_feedback",
        "review_replies",
        "review_events",
      ];
      const { rows } = await pool.query(
        `select relname,relrowsecurity,
      has_table_privilege('anon',oid,'SELECT') anon_read,
      has_table_privilege('authenticated',oid,'INSERT') browser_write
      from pg_class where relnamespace='staytrack'::regnamespace and relname=any($1)`,
        [tables],
      );
      assert.equal(rows.length, tables.length);
      assert.ok(
        rows.every(
          (row) => row.relrowsecurity && !row.anon_read && !row.browser_write,
        ),
      );
    },
  );
  await t.test(
    "H04 public deadline uses first qualifying checkout and blocks a late rating",
    async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const {
          rows: [entry],
        } = await client.query(`
        select b.reservation_id id from staytrack.room_bookings b
        join staytrack.room_checkouts o on o.room_booking_id=b.id
        order by o.checked_out_at desc limit 1`);
        assert.ok(entry);
        // The harness has verified a disposable loopback target. Roll back all historical fixture edits.
        await client.query("set local session_replication_role=replica");
        await client.query(
          `update staytrack.room_check_ins i set checked_in_at=clock_timestamp()-interval '32 days'
        from staytrack.room_bookings b where b.id=i.room_booking_id and b.reservation_id=$1`,
          [entry.id],
        );
        await client.query(
          `update staytrack.room_checkouts o set checked_out_at=clock_timestamp()-interval '31 days'
        from staytrack.room_bookings b where b.id=o.room_booking_id and b.reservation_id=$1`,
          [entry.id],
        );
        await client.query("set local session_replication_role=origin");
        const eligibility = await loadReviewEligibility(client, entry.id);
        assert.ok(eligibility.first_checkout);
        assert.equal(eligibility.public_open, false);
        const review = await createReviewGrant(client, entry.id, "review");
        await assert.rejects(
          submitGuestReview(
            client,
            { token: review },
            {
              key: "late-rating-attempt",
              stars: 5,
              comment: null,
              consent: true,
            },
          ),
          { status: 410 },
        );
        const feedback = await createReviewGrant(client, entry.id, "feedback");
        const sent = await submitPrivateFeedback(
          client,
          { token: feedback },
          {
            key: "late-feedback-attempt",
            message: "Synthetic feedback after deadline",
            followUp: false,
          },
        );
        assert.ok(sent.id);
      } finally {
        await client.query("rollback");
        client.release();
      }
    },
  );
  await t.test(
    "H04 verified invitations, scoped OTP, concurrent one-star review, withdrawal and private feedback",
    async () => {
      const {
        rows: [fixture],
      } = await pool.query(`select r.id,r.verified_email, r.owner_auth_user_id,
      (select auth_user_id from staytrack.staff_accounts where active limit 1) actor
      from staytrack.reservations r join staytrack.room_bookings b on b.reservation_id=r.id
      join staytrack.room_checkouts o on o.room_booking_id=b.id
      order by o.checked_out_at desc limit 1`);
      assert.ok(fixture);
      const reservation = fixture.id;
      const address = fixture.verified_email ?? "h04-guest@example.test";
      const identity =
        fixture.owner_auth_user_id ?? "a3e9b04a-7534-483d-9686-3cfd9220677f";
      const invitationTokens = [];
      let nextCode = 123455;
      const delivery = {
        invitation: async (email, token) => {
          assert.equal(email, address);
          invitationTokens.push(token);
        },
        generateOtp: async () => String(++nextCode),
        sendOtp: async (email) => assert.equal(email, address),
        verifyOtp: async (email, code) =>
          /^12345\d$/.test(code) ? { email, id: identity } : null,
      };
      if (!fixture.verified_email) {
        const pairing = await startReviewPairing(
          pool,
          reservation,
          fixture.actor,
        );
        assert.ok(pairing);
        const enrollment = await startReviewOtp(
          pool,
          delivery,
          reservation,
          address,
          "enrollment",
          pairing,
          false,
        );
        assert.deepEqual(
          await finishReviewOtp(
            pool,
            delivery,
            enrollment,
            String(nextCode),
            true,
          ),
          { enrolled: true },
        );
      } else {
        await pool.query(
          "insert into staytrack.review_contacts(reservation_id,email,verified_auth_user_id,invitation_consent_at) values($1,$2,$3,clock_timestamp())",
          [reservation, address, identity],
        );
      }
      await issueReviewInvitation(pool, delivery, reservation);
      await issueReviewInvitation(pool, delivery, reservation);
      assert.equal(invitationTokens.length, 2);
      assert.equal(
        await withReviewTransaction(pool, (client) =>
          redeemReviewInvitation(client, invitationTokens[0]),
        ),
        null,
      );
      const redemption = await Promise.all(
        [1, 2].map(() =>
          withReviewTransaction(pool, (client) =>
            redeemReviewInvitation(client, invitationTokens[1]),
          ),
        ),
      );
      assert.equal(redemption.filter(Boolean).length, 1);
      const token = redemption.find(Boolean);
      const challenge = await startReviewOtp(
        pool,
        delivery,
        reservation,
        address,
        "feedback_otp",
        undefined,
        false,
      );
      const feedbackCode = String(nextCode);
      const other = await startReviewOtp(
        pool,
        delivery,
        reservation,
        address,
        "withdrawal_otp",
        undefined,
        false,
      );
      assert.equal(
        await finishReviewOtp(pool, delivery, other, feedbackCode, false),
        null,
      );
      const feedback = await finishReviewOtp(
        pool,
        delivery,
        challenge,
        feedbackCode,
        false,
      );
      assert.ok(feedback?.token);
      assert.equal(
        await finishReviewOtp(pool, delivery, challenge, feedbackCode, false),
        null,
      );
      const input = {
        key: "test-review-submit-01",
        stars: 1,
        comment: "Genuine criticism",
        consent: true,
      };
      await assert.rejects(
        withReviewTransaction(pool, (client) =>
          submitGuestReview(client, { token: feedback.token }, input),
        ),
        { status: 403 },
      );
      const race = await Promise.allSettled(
        [input, { ...input, key: "test-review-submit-02" }].map((data) =>
          withReviewTransaction(pool, (client) =>
            submitGuestReview(client, { token }, data),
          ),
        ),
      );
      assert.equal(
        race.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        race.find((result) => result.status === "rejected").reason.status,
        409,
      );
      const inserted = race.find(
        (result) => result.status === "fulfilled",
      ).value;
      await withReviewTransaction(pool, (client) =>
        submitPrivateFeedback(
          client,
          { token: feedback.token },
          {
            key: "test-feedback-submit",
            message: "synthetic private message",
            followUp: true,
          },
        ),
      );
      const published = await withReviewTransaction(pool, (client) =>
        publishedReviews(client, 1),
      );
      assert.equal(published.average, 1);
      assert.equal(published.distribution[0], 1);
      assert.doesNotMatch(
        JSON.stringify(published),
        /synthetic private message|reservation_id|follow_up_email/,
      );
      await assert.rejects(
        withReviewTransaction(pool, (client) =>
          staffReviewAction(
            client,
            fixture.actor,
            inserted.id,
            "test-moderate-rating",
            "hide",
            "low_rating",
            "One star",
          ),
        ),
        { status: 400 },
      );
      await withReviewTransaction(pool, (client) =>
        staffReviewAction(
          client,
          fixture.actor,
          inserted.id,
          "test-hold-rating-01",
          "hold",
          "private_information",
          "Synthetic policy test",
        ),
      );
      assert.equal(
        (
          await withReviewTransaction(pool, (client) =>
            publishedReviews(client, 1),
          )
        ).count,
        0,
      );
      await withReviewTransaction(pool, (client) =>
        staffReviewAction(
          client,
          fixture.actor,
          inserted.id,
          "test-restore-rating",
          "restore",
          "private_information",
          "Synthetic reconsideration",
        ),
      );
      const withdrawal = await withReviewTransaction(pool, (client) =>
        createReviewGrant(client, reservation, "withdrawal"),
      );
      await withReviewTransaction(pool, (client) =>
        withdrawGuestReview(
          client,
          { token: withdrawal },
          "test-withdraw-rating",
        ),
      );
      assert.equal(
        (
          await withReviewTransaction(pool, (client) =>
            publishedReviews(client, 1),
          )
        ).count,
        0,
      );
      await assert.rejects(
        withReviewTransaction(pool, (client) =>
          submitGuestReview(
            client,
            { token },
            { ...input, key: "test-new-after-withdrawal" },
          ),
        ),
        { status: 409 },
      );
    },
  );
}
