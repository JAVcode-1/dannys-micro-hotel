import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { createWalkInBooking } from "../dist/walkins.js";

export async function walkInContactPostgres(t, pool) {
  await t.test(
    "C16 walk-in contact/policy/minor metadata is private, immutable, actor-bound and replay-safe",
    async () => {
      await pool.query(
        readFileSync(
          new URL(
            "../../supabase/migrations/20261121002600_walkin_contact_verification.sql",
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
      const items = [
        {
          category: "double_standard",
          startAt: new Date(
            Math.ceil((Date.now() + 550 * 86400000) / 60000) * 60000,
          ).toISOString(),
          blocks: [180],
          adults: 1,
          children: 1,
          extraBed: false,
        },
      ];
      const contact = {
        phone: "09170000000",
        email: "synthetic@example.test",
        policyVersion: "booking-v1",
        policyAcknowledged: true,
        minorIdStatus: "checked",
      };
      const result = await createWalkInBooking(
        actor,
        "walkin-contact-fixture-001",
        "SYNTHETIC CONTACT",
        items,
        pool,
        [],
        contact,
      );
      const row = (
        await pool.query(
          "select * from staytrack.walkin_guest_contacts where reservation_id=$1",
          [result.booking.id],
        )
      ).rows[0];
      assert.equal(row.phone, contact.phone);
      assert.equal(row.email, contact.email);
      assert.equal(row.minor_id_checked_by, actor);
      assert.equal(row.acknowledged_by, actor);
      assert.ok(row.minor_id_checked_at);
      assert.equal(
        (
          await createWalkInBooking(
            actor,
            "walkin-contact-fixture-001",
            "SYNTHETIC CONTACT",
            items,
            pool,
            [],
            contact,
          )
        ).replayed,
        true,
      );
      await assert.rejects(
        createWalkInBooking(
          actor,
          "walkin-contact-fixture-001",
          "SYNTHETIC CONTACT",
          items,
          pool,
          [],
          { ...contact, phone: "09170000001" },
        ),
        /Retry key/,
      );
      await assert.rejects(
        createWalkInBooking(
          actor,
          "walkin-contact-fixture-002",
          "SYNTHETIC CONTACT",
          items,
          pool,
          [],
          { ...contact, minorIdStatus: "no_minors" },
        ),
        /child occupants/,
      );
      await assert.rejects(
        pool.query(
          "update staytrack.walkin_guest_contacts set phone=$1 where reservation_id=$2",
          ["09170000001", result.booking.id],
        ),
        /immutable/,
      );
      const rights = (
        await pool.query(
          "select relrowsecurity as rls,has_table_privilege('anon',oid,'select,insert,update,delete') as anon,has_table_privilege('authenticated',oid,'select,insert,update,delete') as authenticated from pg_class where oid='staytrack.walkin_guest_contacts'::regclass",
        )
      ).rows[0];
      assert.deepEqual(rights, {
        rls: true,
        anon: false,
        authenticated: false,
      });
      assert.equal(
        Object.keys(row).some((key) => /photo|birth|id_number/.test(key)),
        false,
      );
      const before = Number(
        (await pool.query("select count(*) from staytrack.reservations"))
          .rows[0].count,
      );
      await pool.query(
        "create function staytrack.c16_fail_contact() returns trigger language plpgsql as $$begin raise exception 'Synthetic contact failure';end$$;create trigger c16_fail_contact before insert on staytrack.walkin_guest_contacts for each row execute function staytrack.c16_fail_contact()",
      );
      try {
        await assert.rejects(
          createWalkInBooking(
            actor,
            "walkin-contact-rollback-001",
            "SYNTHETIC ROLLBACK",
            [
              {
                ...items[0],
                startAt: new Date(
                  Date.parse(items[0].startAt) + 86400000,
                ).toISOString(),
              },
            ],
            pool,
            [],
            contact,
          ),
          /Synthetic contact failure/,
        );
        assert.equal(
          Number(
            (await pool.query("select count(*) from staytrack.reservations"))
              .rows[0].count,
          ),
          before,
        );
      } finally {
        await pool.query(
          "drop trigger c16_fail_contact on staytrack.walkin_guest_contacts;drop function staytrack.c16_fail_contact()",
        );
      }
    },
  );
}
