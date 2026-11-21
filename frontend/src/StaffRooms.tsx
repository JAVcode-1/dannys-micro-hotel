import RoomMaintenancePanel from "./RoomMaintenancePanel";
import React from "react";
import { apiBase } from "./staff-auth";
import type {
  StaffRoom,
  HousekeepingAction,
  HousekeepingInput,
} from "@staytrack/shared";
const status: Record<string, string> = {
  ready: "bg-green-100 text-green-800",
  occupied: "bg-purple-100 text-purple-800",
  cleaning: "bg-amber-100 text-amber-800",
  maintenance: "bg-slate-200 text-slate-700",
  unverified: "bg-slate-200 text-slate-700",
};
type OperationalRoom = StaffRoom & {
  physically_ready?: boolean;
  legacy_inspection_eligible?: boolean;
};

export default function StaffRooms({ token }: { token: string }) {
  const [rooms, setRooms] = React.useState<OperationalRoom[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [checks, setChecks] = React.useState<Record<string, boolean>>({});
  const retries = React.useRef<Record<string, HousekeepingInput>>({});
  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(`${apiBase}/staff/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok)
        throw new Error(
          "Room board is unavailable. Check staff access and try again.",
        );
      setRooms((await response.json()) as StaffRoom[]);
    },
    [token],
  );
  React.useEffect(() => {
    const controller = new AbortController();
    setRooms([]);
    setError("");
    setLoading(true);
    setChecks({});
    retries.current = {};
    void load(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Room board is unavailable. Check staff access and try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, load]);
  async function act(room: StaffRoom, action: HousekeepingAction) {
    if (!room.checkout_id || busy) return;
    const cycle = `${room.id}:${room.checkout_id}`;
    const retry = `${cycle}:${action}`;
    const input = retries.current[retry] ?? {
      checkoutId: room.checkout_id,
      action,
      requestKey: crypto.randomUUID(),
      ...(action === "ready" ? { checksConfirmed: true } : {}),
    };
    retries.current[retry] = input;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBase}/staff/rooms/${room.id}/housekeeping`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          body.error ??
            "Housekeeping could not be recorded. Refresh and retry.",
        );
      }
      await load();
      delete retries.current[retry];
      setChecks((current) => ({ ...current, [cycle]: false }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Housekeeping unavailable. Refresh and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const time = (value: string) =>
    new Date(value).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  return (
    <section className="mt-8 border-t border-subtle pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
            Operations
          </p>
          <h2 className="mt-2 text-2xl font-bold">Physical rooms</h2>
        </div>
        <span className="rounded-full bg-selected px-3 py-2 text-sm font-semibold text-primary">
          {rooms.length} rooms on record
        </span>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-subtle px-4 text-sm font-semibold disabled:opacity-50"
          disabled={busy || loading}
          onClick={() => {
            setBusy(true);
            setError("");
            void load()
              .catch(() => setError("Room board refresh failed."))
              .finally(() => setBusy(false));
          }}
        >
          Refresh room board
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        Physical readiness and turnover protection are separate. Capacity claims
        below are provisional, not guest room assignments.
      </p>
      {loading && (
        <p role="status" className="mt-6 text-muted">
          Loading room board…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 text-red-700">
          {error}
        </p>
      )}
      {!loading && !error && rooms.length === 0 && (
        <p className="mt-6 rounded-xl bg-lavender p-4 text-main">
          No physical rooms are configured yet. Actual hotel room identifiers
          are pending.
        </p>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => {
          const events = room.housekeeping ?? [];
          const stage = events.at(-1)?.action;
          const action: HousekeepingAction =
            stage === "start"
              ? "finish"
              : stage === "finish"
                ? "ready"
                : "start";
          const label = {
            start: "Start cleaning",
            finish: "Finish cleaning",
            ready: "Mark Ready",
          }[action];
          const cycle = `${room.id}:${room.checkout_id}`;
          return (
            <article
              key={room.id}
              className="rounded-xl border border-subtle bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{room.code}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {room.category_name}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${status[room.operational_state] ?? status.unverified}`}
                >
                  {room.operational_state === "unverified"
                    ? "Unverified"
                    : room.operational_state[0].toUpperCase() +
                      room.operational_state.slice(1)}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {room.available_now && (
                  <p className="font-semibold text-green-800">Available now</p>
                )}
                {room.operational_state === "cleaning" && (
                  <p className="font-semibold text-amber-800">
                    {stage === "finish"
                      ? "Cleaning finished · Not Ready"
                      : stage === "start"
                        ? "Cleaning in progress · Not Ready"
                        : "Needs cleaning · Not Ready"}
                  </p>
                )}
                {room.maintenance_now && (
                  <p className="font-semibold">Maintenance block active</p>
                )}
                {room.turnover_until && (
                  <p>
                    Turnover protected until {time(room.turnover_until)}{" "}
                    (Asia/Manila)
                  </p>
                )}
                {room.held_now > 0 && (
                  <p>
                    Held / awaiting review: {room.held_now} provisional claim
                  </p>
                )}
                {room.reserved_now > 0 && (
                  <p>Reserved: {room.reserved_now} provisional claim</p>
                )}
                {events.map((event) => (
                  <p
                    key={event.action}
                    className="break-words text-xs text-muted"
                  >
                    {
                      {
                        start: "Cleaning started",
                        finish: "Cleaning finished",
                        ready: "Marked Ready",
                      }[event.action]
                    }{" "}
                    · {time(event.occurredAt)} · Staff {event.actorId}
                  </p>
                ))}
              </div>
              {room.operational_state === "cleaning" &&
                room.checkout_id &&
                stage !== "ready" && (
                  <div className="mt-4 space-y-3 border-t border-subtle pt-4">
                    {!room.housekeeping_enabled && (
                      <p className="text-sm text-muted">
                        Live housekeeping is closed pending acceptance.
                      </p>
                    )}
                    {action === "ready" && (
                      <label className="flex min-h-11 items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          disabled={
                            busy ||
                            !room.housekeeping_enabled ||
                            room.maintenance_now
                          }
                          checked={checks[cycle] ?? false}
                          onChange={(event) =>
                            setChecks((current) => ({
                              ...current,
                              [cycle]: event.target.checked,
                            }))
                          }
                        />
                        I completed the applicable room checks and confirm this
                        room is Ready.
                      </label>
                    )}
                    <button
                      type="button"
                      className="min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        busy ||
                        !room.active ||
                        !room.housekeeping_enabled ||
                        room.maintenance_now ||
                        (action === "ready" && !checks[cycle])
                      }
                      onClick={() => void act(room, action)}
                    >
                      {label}
                    </button>
                  </div>
                )}
              <RoomMaintenancePanel
                key={token + ":" + (room.maintenance?.activeBlockId ?? "none")}
                room={room}
                token={token}
                refresh={load}
                time={time}
                busy={busy}
                rooms={rooms}
              />
              {room.legacy_inspection_eligible !== undefined && (
                <RoomAdministration
                  key={
                    token + ":" + room.id + ":" + room.active + ":" + room.code
                  }
                  room={room}
                  token={token}
                  refresh={load}
                />
              )}
              {!room.active && (
                <p className="mt-4 text-xs font-semibold text-muted">
                  Inactive · unavailable for booking
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoomAdministration({
  room,
  token,
  refresh,
}: {
  room: OperationalRoom;
  token: string;
  refresh: () => Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [code, setCode] = React.useState(room.code);
  const [active, setActive] = React.useState(room.active);
  const [checked, setChecked] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const retry = React.useRef<{ payload: string; key: string } | null>(null);
  async function submit(inspection: boolean) {
    const body = inspection
      ? { note, checksConfirmed: checked }
      : { note, code, active };
    const payload = JSON.stringify({ inspection, ...body });
    if (retry.current?.payload !== payload)
      retry.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBase}/staff/rooms/${room.id}/${inspection ? "inspection" : "admin"}`,
        {
          method: inspection ? "POST" : "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, requestKey: retry.current.key }),
        },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      retry.current = null;
      await refresh();
      setNote("");
      setChecked(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Room update unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || !room.housekeeping_enabled;
  return (
    <details className="mt-4 border-t border-subtle pt-3">
      <summary className="cursor-pointer font-semibold">
        Room administration and inspection
      </summary>
      <p className="mt-2 text-sm">
        Use owner-confirmed identifiers only. Current inspection can reconcile
        missing legacy readiness evidence after any protected turnover expires;
        it does not invent historical cleaning events.
      </p>
      {room.physically_ready === false &&
        room.operational_state === "ready" && (
          <p className="text-sm">
            Ready label requires current inspection or latest housekeeping
            evidence before guest access.
          </p>
        )}
      <label className="mt-2 grid gap-1">
        Confirmed room identifier
        <input
          maxLength={80}
          className="rounded border border-subtle p-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="flex gap-2 py-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          disabled={disabled}
        />
        Active for booking
      </label>
      <label className="grid gap-1">
        Administration or inspection reason
        <textarea
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded border border-subtle p-2"
          disabled={disabled}
        />
      </label>
      <button
        className="mt-2 min-h-11 rounded border border-subtle px-3"
        disabled={disabled || !note.trim() || !code.trim()}
        onClick={() => void submit(false)}
      >
        Save room administration
      </button>
      {room.legacy_inspection_eligible && (
        <>
          <label className="flex gap-2 py-2">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => setChecked(e.target.checked)}
            />
            I physically inspected this room now and confirm it is Ready.
          </label>
          <button
            className="min-h-11 rounded border border-subtle px-3"
            disabled={disabled || !checked || !note.trim()}
            onClick={() => void submit(true)}
          >
            Record current legacy inspection
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
