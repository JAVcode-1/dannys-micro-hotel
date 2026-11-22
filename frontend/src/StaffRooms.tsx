import RoomMaintenancePanel from "./RoomMaintenancePanel";
import React from "react";
import { notifySuccess } from "./notifications";
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
        cache: "no-store",
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
      notifySuccess({ start: "Cleaning started.", finish: "Cleaning finished. Ready inspection is still required.", ready: "Room marked Ready." }[action]);
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
      <RoomRegistration key={token} token={token} refresh={load} disabled={loading || busy} />
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
                  key={token + ":" + room.id}
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

function RoomRegistration({ token, refresh, disabled }: { token: string; refresh: () => Promise<void>; disabled: boolean }) {
  const [code, setCode] = React.useState("");
  const [category, setCategory] = React.useState("double_standard");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const retry = React.useRef<{ payload: string; key: string } | null>(null);
  return <form className="mt-5 rounded-xl border border-subtle bg-white p-4" onSubmit={event => {
    event.preventDefault();
    if (busy || disabled) return;
    const payload = JSON.stringify({ code: code.trim(), category, note: note.trim() });
    if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    const requestKey = retry.current.key;
    setBusy(true); setMessage("");
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/staff/rooms`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...JSON.parse(payload), requestKey }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Registration failed.");
        notifySuccess("Room registered as inactive and Unverified. Inspect it before activation.");
        retry.current = null; setCode(""); setNote("");
        await refresh(); setMessage("Room registered as inactive and Unverified. Inspect it, then activate it for booking.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Registration unavailable. Refresh before retrying."); }
      finally { setBusy(false); }
    })();
  }}>
    <h3 className="font-bold">Register a physical room</h3>
    <p className="mt-2 text-sm text-muted">Register the actual 10 Double Standard and 5 Family Executive identifiers. The Function Hall is managed separately. New rooms are not automatically Ready or available.</p>
    <fieldset disabled={busy || disabled} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Actual room number or identifier<input required maxLength={80} value={code} onChange={e => setCode(e.target.value)} className="rounded border border-subtle p-2" /></label>
      <label className="grid gap-1 text-sm">Room category<select value={category} onChange={e => setCategory(e.target.value)} className="rounded border border-subtle p-2"><option value="double_standard">Double Standard</option><option value="family_executive">Family Executive</option></select></label>
      <label className="grid gap-1 text-sm sm:col-span-2">Registration note<input required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} className="rounded border border-subtle p-2" /></label>
      <button className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50" disabled={!code.trim() || !note.trim()}>{busy ? "Registering…" : "Register room"}</button>
    </fieldset>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </form>;
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
  const [category, setCategory] = React.useState(room.category_code);
  const [active, setActive] = React.useState(room.active);
  const [checked, setChecked] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const retry = React.useRef<{ payload: string; key: string } | null>(null);
  React.useEffect(() => {
    setCode(room.code);
    setCategory(room.category_code);
    setActive(room.active);
  }, [room.code, room.category_code, room.active]);
  async function submit(inspection: boolean) {
    if (busy) return;
    setError("");
    setSuccess("");
    if (!note.trim() || (!inspection && !code.trim())) {
      setError(inspection
        ? "Enter an inspection reason before marking the room Ready."
        : "Enter the confirmed room identifier and an administration reason.");
      return;
    }
    if (inspection && !checked) {
      setError("Confirm that you physically inspected the room and it is Ready.");
      return;
    }
    if (!inspection && active && !room.active && room.operational_state !== "ready") {
      setError("Inspect and mark the room Ready first, then save with Active for booking selected.");
      return;
    }
    const body = inspection
      ? { note: note.trim(), checksConfirmed: checked }
      : { note: note.trim(), code: code.trim(), active, category };
    const payload = JSON.stringify({ inspection, ...body });
    setBusy(true);
    try {
      if (retry.current?.payload !== payload)
        retry.current = { payload, key: crypto.randomUUID() };
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
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Room update failed. Please try again.");
      }
      retry.current = null;
      setNote("");
      setChecked(false);
      notifySuccess(inspection ? "Inspection saved. Room marked Ready." : "Room administration saved.");
      setSuccess(inspection
        ? "Inspection saved. Room marked Ready." + (!room.active ? " Activate it for booking using Save room administration." : "")
        : "Room administration saved." + (active ? " Active for online and walk-in bookings, subject to availability." : " Room is inactive for booking."));
      try {
        await refresh();
      } catch {
        setError("The change was saved, but the room board could not refresh. Use Refresh room board to see the latest status.");
      }
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
      {!room.housekeeping_enabled && (
        <p role="status" className="mt-2 text-sm">Room administration and inspection are currently unavailable.</p>
      )}
      {room.active && room.physically_ready === false &&
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
      <label className="mt-2 grid gap-1">
        Room category
        <select value={category} disabled={disabled || room.active} onChange={e => setCategory(e.target.value)} className="rounded border border-subtle p-2">
          <option value="double_standard">Double Standard</option><option value="family_executive">Family Executive</option>
        </select>
        <span className="text-xs text-muted">Category corrections require an inactive room without booking or maintenance history.</span>
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
        type="button"
        className="mt-2 min-h-11 rounded border border-subtle px-3"
        disabled={disabled}
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
            type="button"
            className="min-h-11 rounded border border-subtle px-3"
            disabled={disabled}
            onClick={() => void submit(true)}
          >
            Inspect and mark Ready
          </button>
        </>
      )}
      {busy && <p role="status">Saving room changes…</p>}
      {success && <p role="status" className="mt-2 text-green-800">{success}</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
