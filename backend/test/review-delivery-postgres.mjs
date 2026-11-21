import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import {
  issueReviewInvitation,
  startReviewOtp,
  processReviewInvitations,
} from "../dist/review-access.js";
import { outboxReviewDelivery } from "../dist/notifications.js";

export async function reviewDeliveryPostgres(t, pool) {
  await t.test(
    "review invitations and OTPs commit with their outbox rows and automatic invitations run once",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261121002400_review_invitation_jobs.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const fixture = (
        await pool.query(
          `select r.id,coalesce(r.verified_email,'review-completion@example.test') email,coalesce(r.owner_auth_user_id,'d3a00000-0000-4000-8000-000000000025'::uuid) guest from staytrack.reservations r join staytrack.room_bookings b on b.reservation_id=r.id join staytrack.room_checkouts o on o.room_booking_id=b.id where o.checked_out_at>clock_timestamp()-interval '720 hours' and not exists(select 1 from staytrack.review_credentials c where c.reservation_id=r.id and c.purpose='invitation') and not exists(select 1 from staytrack.guest_reviews gr where gr.reservation_id=r.id) order by o.checked_out_at desc limit 1`,
        )
      ).rows[0];
      assert.ok(fixture, "an existing completed synthetic stay is required");
      await pool.query(
        `insert into staytrack.review_contacts(reservation_id,email,verified_auth_user_id,invitation_consent_at) values($1,$2,$3,clock_timestamp()) on conflict(reservation_id) do update set invitation_consent_at=clock_timestamp()`,
        [fixture.id, fixture.email, fixture.guest],
      );
      const adapter = {
        invitation: async () => {},
        generateOtp: async () => "987654",
        sendOtp: async () => {},
        verifyOtp: async (email) => ({ id: fixture.guest, email }),
      };
      const wrapped = outboxReviewDelivery(pool, adapter);
      await assert.rejects(
        issueReviewInvitation(
          pool,
          {
            ...wrapped,
            queueInvitation: async () => {
              throw new Error("Injected queue failure");
            },
          },
          fixture.id,
        ),
        /Injected queue failure/,
      );
      assert.equal(
        (
          await pool.query(
            "select 1 from staytrack.review_credentials where reservation_id=$1 and purpose='invitation'",
            [fixture.id],
          )
        ).rowCount,
        0,
      );
      await assert.rejects(
        startReviewOtp(
          pool,
          {
            ...wrapped,
            queueOtp: async () => {
              throw new Error("Injected OTP queue failure");
            },
          },
          fixture.id,
          fixture.email,
          "feedback_otp",
          undefined,
          false,
        ),
        /Injected OTP queue failure/,
      );
      assert.equal(
        (
          await pool.query(
            "select 1 from staytrack.review_credentials where reservation_id=$1 and purpose='feedback_otp'",
            [fixture.id],
          )
        ).rowCount,
        0,
      );
      await Promise.all([
        processReviewInvitations(pool, wrapped),
        processReviewInvitations(pool, wrapped),
      ]);
      assert.equal(
        (
          await pool.query(
            "select 1 from staytrack.review_invitation_jobs where reservation_id=$1",
            [fixture.id],
          )
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "select 1 from staytrack.review_credentials where reservation_id=$1 and purpose='invitation'",
            [fixture.id],
          )
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "select 1 from staytrack.notification_outbox where kind='review_invitation' and payload->>'reservationId'=$1",
            [fixture.id],
          )
        ).rowCount,
        1,
      );
      await startReviewOtp(
        pool,
        wrapped,
        fixture.id,
        fixture.email,
        "feedback_otp",
        undefined,
        false,
      );
      assert.equal(
        (
          await pool.query(
            "select 1 from staytrack.notification_outbox where kind='review_otp' and payload->>'reservationId'=$1",
            [fixture.id],
          )
        ).rowCount,
        1,
      );
      const privileges = (
        await pool.query(
          "select relrowsecurity as rls,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') as anon from pg_class where oid='staytrack.review_invitation_jobs'::regclass",
        )
      ).rows[0];
      assert.deepEqual(privileges, { rls: true, anon: false });
    },
  );
}
