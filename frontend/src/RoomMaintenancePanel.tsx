import { writeApi } from "./api-query";
import React from "react";
import type { MaintenanceAction, StaffRoom } from "@staytrack/shared";
import { notifySuccess } from "./notifications";
import { readableLabel } from "./presentation";
import { apiBase } from "./staff-auth";

export default function RoomMaintenancePanel({
  room,
  token,
  refresh,
  time,
  busy,
  rooms = [],
}: {
  room: StaffRoom;
  token: string;
  refresh: () => Promise<void>;
  time: (instant: string) => string;
  busy: boolean;
  rooms?: StaffRoom[];
}) {
  const [note, setNote] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [targets, setTargets] = React.useState<Record<string, string>>({});
  const retry = React.useRef<{ payload: string; key: string } | null>(null);
  const maintenance = room.maintenance;
  if (!maintenance) return null;
  const blockId = maintenance.activeBlockId;

  async function submit(action: MaintenanceAction) {
    if (saving || busy || !maintenance?.enabled) return;
    const data = {
      action,
      blockId,
      note: note.trim(),
      ...(action === "clear" ? { restoreReady: ready } : {}),
    };
    const payload = JSON.stringify(data);
    if (retry.current?.payload !== payload)
      retry.current = { payload, key: crypto.randomUUID() };
    setSaving(true);
    setError("");
    try {
      const response = await writeApi(
        `${apiBase}/staff/rooms/${room.id}/maintenance`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, requestKey: retry.current.key }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error ?? "Maintenance update failed.",
        );
      notifySuccess("Room maintenance updated.");
      await refresh();
      retry.current = null;
      setNote("");
      setReady(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Maintenance update failed.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function reassign(itemId: string) {
    const data = { itemId, targetRoomId: targets[itemId], note: note.trim() };
    const payload = JSON.stringify(data);
    if (retry.current?.payload !== payload)
      retry.current = { payload, key: crypto.randomUUID() };
    setSaving(true);
    setError("");
    try {
      const response = await writeApi(
        `${apiBase}/staff/rooms/${room.id}/reassign`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...data, requestKey: retry.current.key }),
        },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      notifySuccess("Room reassignment recorded.");
      retry.current = null;
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Reassignment unavailable.",
      );
    } finally {
      setSaving(false);
    }
  }
  const disabled = !maintenance.enabled || busy || saving;
  const actions: [MaintenanceAction, string][] = blockId
    ? [
        ["progress", "Record progress"],
        ["clear", "Clear maintenance"],
      ]
    : [["open", "Open maintenance"]];
  return (
    <details
      className="mt-4 border-t border-subtle pt-3"
      open={blockId ? true : undefined}
    >
      <summary className="min-h-11 cursor-pointer font-semibold">
        Maintenance {blockId ? "in progress" : "details"}
      </summary>
      {maintenance.affected.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Affected room items</p>
          <ul className="space-y-2">
            {maintenance.affected.map((item) => (
              <li key={item.itemId} className="break-words">
                {item.paid
                  ? "Payment recorded. Staff resolution required."
                  : "Staff review required."}{" "}
                {time(item.startAt)} to {time(item.endAt)} (
                {readableLabel(item.state)}).
                <br />
                <details>
                  <summary className="cursor-pointer text-primary">
                    Booking reference
                  </summary>
                  <p className="break-all">{item.itemId}</p>
                </details>
                <label className="mt-2 grid gap-1">
                  Replacement Ready room
                  <select
                    className="rounded border border-subtle bg-white p-2"
                    value={targets[item.itemId] ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      setTargets({ ...targets, [item.itemId]: e.target.value })
                    }
                  >
                    <option value="">Select a room</option>
                    {rooms
                      .filter(
                        (target) =>
                          target.id !== room.id &&
                          target.category_code === room.category_code &&
                          target.active &&
                          target.operational_state === "ready",
                      )
                      .sort((a, b) =>
                        a.code.localeCompare(b.code, "en", {
                          numeric: true,
                          sensitivity: "base",
                        }),
                      )
                      .map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.code}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="mt-2 min-h-11 rounded border border-subtle px-3"
                  disabled={disabled || !note.trim() || !targets[item.itemId]}
                  onClick={() => void reassign(item.itemId)}
                >
                  Reassign room item
                </button>
                <p className="text-xs">
                  Uses the maintenance note below; preserves schedule, price and
                  verified payments. Server rechecks capacity.
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {maintenance.events.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Maintenance history
          </summary>
          <ul aria-label="Maintenance history" className="space-y-2 text-sm">
            {maintenance.events.map((event) => (
              <li key={event.id} className="break-words">
                <strong>
                  {
                    { open: "Opened", progress: "Progress", clear: "Cleared" }[
                      event.action
                    ]
                  }
                </strong>{" "}
                {event.note}
                <p className="text-xs text-muted">
                  {time(event.occurredAt)} · Staff {event.actorId}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!maintenance.enabled && (
        <p className="mt-2 text-sm text-muted">
          Maintenance changes are closed pending acceptance.
        </p>
      )}
      {(blockId ||
        (room.active &&
          !room.maintenance_now &&
          room.operational_state !== "occupied" &&
          room.operational_state !== "maintenance")) && (
        <div className="mt-3 space-y-2 text-sm">
          <label className="block">
            Maintenance note
            <textarea
              className="mt-1 w-full rounded border border-subtle p-2"
              maxLength={1000}
              value={note}
              disabled={disabled}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {blockId && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={ready}
                disabled={disabled}
                onChange={(event) => setReady(event.target.checked)}
              />
              I completed the room checks and explicitly confirm Ready if
              housekeeping and turnover are complete.
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map(([action, label]) => (
              <button
                key={action}
                type="button"
                disabled={disabled || !note.trim()}
                className="min-h-11 rounded-lg border border-subtle px-3 font-semibold disabled:opacity-50"
                onClick={() => void submit(action)}
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
