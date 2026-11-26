import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import {
  bookingPolicy,
  createGuestHold,
  guestReservations,
} from "../dist/guest-booking.js";

export async function guestPostgres(t, pool) {
  await t.test(
    "guest contact snapshot migration is private and immutable with owned pagination",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261121002300_booking_contact_policy.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const access = (
        await pool.query(
          `select relrowsecurity,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') as anon,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated from pg_class where oid='staytrack.reservation_booking_contacts'::regclass`,
        )
      ).rows[0];
      assert.deepEqual(access, {
        relrowsecurity: true,
        anon: false,
        authenticated: false,
      });
      await pool.query(
        "update staytrack.operational_settings set cleaning_buffer_minutes=15 where id=true",
      );
      await pool.query(
        `insert into staytrack.rooms(category_id,code,operational_state,active) select id,'GUEST-CORRECTION-FIXTURE','ready',true from staytrack.room_categories where code='double_standard'`,
      );
      const guest = {
        id: "d3a00000-0000-4000-8000-000000000023",
        email: "completion@example.test",
      };
      const items = [
        {
          category: "double_standard",
          startAt: new Date(
            Math.ceil((Date.now() + 100 * 86400000) / 60000) * 60000,
          ).toISOString(),
          blocks: [180],
          adults: 2,
          children: 0,
          extraBed: false,
        },
      ];
      const contact = {
        phone: "09170000000",
        policyVersion: bookingPolicy.version,
        policyAcknowledged: true,
      };
      const expectedTotal = Number(
        (
          await pool.query(
            "select price_centavos from staytrack.packages where category_code='double_standard' and duration_minutes=180 and active",
          )
        ).rows[0].price_centavos,
      );
      const reservation = await createGuestHold(
        guest,
        "guest-correction-key-023",
        "Synthetic fixture",
        items,
        pool,
        [],
        contact,
        expectedTotal,
      );
      assert.equal(
        (
          await pool.query(
            "select phone,policy_version,acknowledged_by from staytrack.reservation_booking_contacts where reservation_id=$1",
            [reservation.id],
          )
        ).rows[0].phone,
        "+639170000000",
      );
      const replay = await createGuestHold(
        guest,
        "guest-correction-key-023",
        "Synthetic fixture",
        items,
        pool,
        [],
        contact,
        expectedTotal,
      );
      assert.equal(replay.id, reservation.id);
      assert.equal(replay.replayed, true);
      await assert.rejects(
        pool.query(
          "update staytrack.reservation_booking_contacts set phone='09170000001' where reservation_id=$1",
          [reservation.id],
        ),
        /immutable/,
      );
      assert.equal(
        (
          await guestReservations(guest, pool, {
            reservationId: reservation.id,
          })
        )[0].id,
        reservation.id,
      );
      assert.deepEqual(
        await guestReservations(
          { ...guest, id: "d3a00000-0000-4000-8000-000000000024" },
          pool,
          { reservationId: reservation.id },
        ),
        [],
      );
      await assert.rejects(
        createGuestHold(
          guest,
          "guest-correction-price-023",
          "Synthetic fixture",
          items,
          pool,
          [],
          contact,
          1,
        ),
        /Prices changed/,
      );
      await assert.rejects(
        createGuestHold(
          guest,
          "guest-correction-ack-023",
          "Synthetic fixture",
          items,
          pool,
          [],
          { ...contact, policyAcknowledged: false },
          expectedTotal,
        ),
        /acknowledge/,
      );
      assert.equal(
        Number(
          (
            await pool.query(
              "select count(*) from staytrack.reservations where owner_auth_user_id=$1",
              [guest.id],
            )
          ).rows[0].count,
        ),
        1,
      );
    },
  );
}
