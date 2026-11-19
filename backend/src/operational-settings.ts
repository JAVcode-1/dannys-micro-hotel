import { databasePool } from "./database.js";

export type SettingsUpdate = {
  cleaningBufferMinutes: number | null;
  checkoutAlertMinutes: number | null;
  checkoutWarningMinutes?: number[] | null;
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
    (value.checkoutWarningMinutes == null ||
      (Array.isArray(value.checkoutWarningMinutes) &&
        value.checkoutWarningMinutes.length >= 1 &&
        value.checkoutWarningMinutes.length <= 10 &&
        value.checkoutWarningMinutes.every(
          (m) => Number.isInteger(m) && m >= 1 && m <= 1440,
        ))) &&
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

export async function getSettings() {
  const { rows } = await databasePool()
    .query(`select cleaning_buffer_minutes as "cleaningBufferMinutes",
    checkout_alert_minutes as "checkoutAlertMinutes",
    to_jsonb(operational_settings)->'checkout_warning_minutes' as "checkoutWarningMinutes",
    to_jsonb(operational_settings) ? 'checkout_warning_minutes' as "supportsWarnings", gcash_qr_object_key as "gcashQrObjectKey",
    gcash_payee_label as "gcashPayeeLabel", cancellation_display_text as "cancellationDisplayText"
    from staytrack.operational_settings where id = true`);
  const row = rows[0];
  if (!row) return null;
  if (!row.supportsWarnings) delete row.checkoutWarningMinutes;
  delete row.supportsWarnings;
  return row;
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
    const result = await client.query(
      `update staytrack.operational_settings set
      cleaning_buffer_minutes = $1, checkout_alert_minutes = $2, gcash_qr_object_key = $3,
      gcash_payee_label = $4, cancellation_display_text = $5,
      updated_at = now(), updated_by = $6 where id = true`,
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
    if (value.checkoutWarningMinutes !== undefined)
      await client.query(
        "update staytrack.operational_settings set checkout_warning_minutes=$1 where id=true",
        [value.checkoutWarningMinutes],
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
