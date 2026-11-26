import type { Pool } from "pg";
import { databasePool } from "./database.js";
import { requireTransactionStaff } from "./transaction-staff.js";

export type SettingsUpdate = {
  cleaningBufferMinutes: number | null;
  checkoutAlertMinutes: number | null;
  gcashQrObjectKey: string | null;
  gcashPayeeLabel: string | null;
  cancellationDisplayText: string | null;
};

export function validSettings(value: SettingsUpdate) {
  return (
    value &&
    (value.cleaningBufferMinutes === null ||
      (Number.isSafeInteger(value.cleaningBufferMinutes) &&
        value.cleaningBufferMinutes >= 0 &&
        value.cleaningBufferMinutes <= 1440)) &&
    (value.checkoutAlertMinutes === null ||
      (Number.isSafeInteger(value.checkoutAlertMinutes) &&
        value.checkoutAlertMinutes >= 1 &&
        value.checkoutAlertMinutes <= 1440)) &&
    (value.gcashQrObjectKey === null ||
      (typeof value.gcashQrObjectKey === "string" &&
        value.gcashQrObjectKey.length <= 240 &&
        !/^https?:/i.test(value.gcashQrObjectKey))) &&
    (value.gcashPayeeLabel === null ||
      (typeof value.gcashPayeeLabel === "string" &&
        value.gcashPayeeLabel.length <= 120)) &&
    (value.cancellationDisplayText === null ||
      (typeof value.cancellationDisplayText === "string" &&
        value.cancellationDisplayText.length <= 2000))
  );
}

export async function getSettings(db: Pick<Pool, "query"> = databasePool()) {
  const { rows } = await db.query<
    SettingsUpdate & { legacyCheckoutReminders: number[] | null }
  >(`select cleaning_buffer_minutes as "cleaningBufferMinutes",
    checkout_alert_minutes as "checkoutAlertMinutes",
    to_jsonb(operational_settings)->'checkout_warning_minutes' as "legacyCheckoutReminders",
    gcash_qr_object_key as "gcashQrObjectKey",
    gcash_payee_label as "gcashPayeeLabel", cancellation_display_text as "cancellationDisplayText"
    from staytrack.operational_settings where id = true`);
  const row = rows[0];
  if (!row) return null;
  const { legacyCheckoutReminders, ...settings } = row;
  if (settings.checkoutAlertMinutes === null && legacyCheckoutReminders?.length)
    settings.checkoutAlertMinutes = Math.max(...legacyCheckoutReminders);
  return settings;
}

export async function saveSettings(
  actorId: string,
  value: SettingsUpdate,
  pool?: ReturnType<typeof databasePool>,
) {
  if (!validSettings(value)) return false;
  const client = await (pool ?? databasePool()).connect();
  try {
    await client.query("begin");
    await requireTransactionStaff(client, actorId);
    const result = await client.query<{ hasLegacyReminders: boolean | null }>(
      `update staytrack.operational_settings set
      cleaning_buffer_minutes = $1, checkout_alert_minutes = $2, gcash_qr_object_key = $3,
      gcash_payee_label = $4, cancellation_display_text = $5,
      updated_at = now(), updated_by = $6 where id = true
      returning jsonb_typeof(to_jsonb(operational_settings)->'checkout_warning_minutes') = 'array' as "hasLegacyReminders"`,
      [
        value.cleaningBufferMinutes,
        value.checkoutAlertMinutes,
        value.gcashQrObjectKey,
        value.gcashPayeeLabel,
        value.cancellationDisplayText,
        actorId,
      ],
    );
    if (result.rowCount !== 1) {
      await client.query("rollback");
      return false;
    }
    if (result.rows[0]?.hasLegacyReminders)
      await client.query(
        "update staytrack.operational_settings set checkout_warning_minutes=null where id=true",
      );
    await client.query(
      `insert into staytrack.staff_audit (actor_auth_user_id, action)
      values ($1, 'settings.operational_updated')`,
      [actorId],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
