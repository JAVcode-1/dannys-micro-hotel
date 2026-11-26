import RoomMaintenancePanel from "./RoomMaintenancePanel";
import React from "react";
import StaffLoadingSkeleton, { SkeletonBlock } from "./StaffLoadingSkeleton";
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
  "needs inspection": "bg-amber-100 text-amber-800",
};
type OperationalRoom = StaffRoom & {
  legacy_inspection_eligible?: boolean;
};

function roomNeedsAttention(room: OperationalRoom) {
  return (
    (room.active && room.operational_state === "cleaning") ||
    room.legacy_inspection_eligible === true
  );
}

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
      ).catch(() => null);
      if (!response?.ok) {
        const body = await response?.json().catch(() => null);
        throw new Error(
          body?.error ||
            "The housekeeping update could not be confirmed. Refresh the Rooms board before trying again.",
        );
      }
      notifySuccess(
        {
          start: "Cleaning started.",
          finish: "Cleaning finished. Ready inspection is still required.",
          ready: "Room marked Ready.",
        }[action],
      );
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
    <section className="staff-room-board mt-8 border-t border-subtle pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold">Rooms</h2>
        {!loading && (
          <span className="rounded-full bg-selected px-3 py-2 text-sm font-semibold text-primary">
            {rooms.length} rooms on record
          </span>
        )}
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
          Refresh
        </button>
      </div>
      <details className="mt-4 rounded-xl border border-subtle bg-white p-4">
        <summary className="min-h-11 cursor-pointer font-semibold text-primary">
          Register a room
        </summary>
        <RoomRegistration
          key={token}
          token={token}
          refresh={load}
          disabled={loading || busy}
        />
      </details>
      {loading && (
        <StaffLoadingSkeleton label="Loading room board…">
          <div className="staff-room-grid mt-6 grid items-start gap-3">
            {["w-16", "w-20", "w-14", "w-24"].map((roomWidth) => (
              <article
                key={roomWidth}
                className="space-y-4 rounded-xl border border-subtle bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <SkeletonBlock className={`h-5 ${roomWidth}`} />
                    <SkeletonBlock className="h-3 w-28" />
                  </div>
                  <SkeletonBlock className="h-6 w-20" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <SkeletonBlock className="h-6 w-24" />
                  <SkeletonBlock className="h-6 w-16" />
                </div>
                <div className="space-y-2 border-t border-subtle pt-3">
                  <SkeletonBlock className="h-3 w-36" />
                  <SkeletonBlock className="h-3 w-28" />
                </div>
                <SkeletonBlock className="h-11 w-full" />
              </article>
            ))}
          </div>
        </StaffLoadingSkeleton>
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
      <div className="staff-room-grid mt-6 grid items-start gap-3">
        {[...rooms]
          .sort(
            (a, b) =>
              Number(roomNeedsAttention(b)) - Number(roomNeedsAttention(a)) ||
              a.code.localeCompare(b.code, "en", {
                numeric: true,
                sensitivity: "base",
              }),
          )
          .map((room) => {
            const available = room.active && room.available_now;
            let badge = room.operational_state;
            if (!room.active) badge = "inactive";
            else if (room.legacy_inspection_eligible)
              badge = "needs inspection";
            else if (badge === "ready" && !available) badge = "unavailable";
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
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${status[badge] ?? status.unverified}`}
                  >
                    {badge.charAt(0).toUpperCase() + badge.slice(1)}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {badge !== "unavailable" && (
                    <p
                      className={
                        available
                          ? "font-semibold text-green-800"
                          : "text-muted"
                      }
                    >
                      {!room.active
                        ? "Unavailable for booking"
                        : available
                          ? "Available now"
                          : "Unavailable now"}
                    </p>
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
                    <p>Turnover ends {time(room.turnover_until)} </p>
                  )}
                  {room.held_now > 0 && (
                    <p>On hold / under review: {room.held_now}</p>
                  )}
                  {room.reserved_now > 0 && (
                    <p>Reserved capacity: {room.reserved_now}</p>
                  )}
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
                          I completed the applicable room checks and confirm
                          this room is Ready.
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
                <details className="mt-4 border-t border-subtle pt-3 text-sm">
                  <summary className="min-h-11 cursor-pointer font-semibold text-primary">
                    Room details and cleaning history
                  </summary>
                  <p className="mb-3 text-muted">
                    Readiness and availability are checked separately.
                    Provisional capacity claims are not room assignments.
                  </p>
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
                  {!events.length && (
                    <p className="text-muted">No cleaning history recorded.</p>
                  )}
                </details>
                <RoomMaintenancePanel
                  key={
                    token + ":" + (room.maintenance?.activeBlockId ?? "none")
                  }
                  room={room}
                  token={token}
                  refresh={load}
                  time={time}
                  busy={busy}
                  rooms={rooms}
                />
                {room.legacy_inspection_eligible !== undefined && (
                  <RoomReadinessActions
                    key={token + ":" + room.id}
                    room={room}
                    token={token}
                    refresh={load}
                  />
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}

function RoomRegistration({
  token,
  refresh,
  disabled,
}: {
  token: string;
  refresh: () => Promise<void>;
  disabled: boolean;
}) {
  const [code, setCode] = React.useState("");
  const [category, setCategory] = React.useState("double_standard");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const retry = React.useRef<{ payload: string; key: string } | null>(null);
  return (
    <form
      className="mt-5 rounded-xl border border-subtle bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || disabled) return;
        const payload = JSON.stringify({
          code: code.trim(),
          category,
          note: note.trim(),
        });
        if (retry.current?.payload !== payload)
          retry.current = { payload, key: crypto.randomUUID() };
        const requestKey = retry.current.key;
        setBusy(true);
        setMessage("");
        void (async () => {
          try {
            const response = await fetch(`${apiBase}/staff/rooms`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...JSON.parse(payload), requestKey }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "Registration failed.");
            notifySuccess(
              "Room registered as inactive and Unverified.",
            );
            retry.current = null;
            setCode("");
            setNote("");
            await refresh();
            setMessage(
              "Room registered as inactive and Unverified. Inspect it to record its readiness.",
            );
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Registration unavailable. Refresh before retrying.",
            );
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <h3 className="font-bold">Register a physical room</h3>
      <p className="mt-2 text-sm text-muted">
        New rooms start inactive and Unverified.
      </p>
      <fieldset
        disabled={busy || disabled}
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
        <label className="grid gap-1 text-sm">
          Actual room number or identifier
          <input
            required
            maxLength={80}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded border border-subtle p-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Room category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-subtle p-2"
          >
            <option value="double_standard">Double Standard</option>
            <option value="family_executive">Family Executive</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Registration note
          <input
            required
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded border border-subtle p-2"
          />
        </label>
        <button
          className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50"
          disabled={!code.trim() || !note.trim()}
        >
          {busy ? "Registering…" : "Register room"}
        </button>
      </fieldset>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </form>
  );
}

function RoomReadinessActions({
  room,
  token,
  refresh,
}: {
  room: OperationalRoom;
  token: string;
  refresh: () => Promise<void>;
}) {
  const [inspectionNote, setInspectionNote] = React.useState("");
  const [activationNote, setActivationNote] = React.useState("");
  const [inspectionRequired, setInspectionRequired] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  const [pending, setPending] = React.useState<"inspection" | "admin" | null>(
    null,
  );
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const retries = React.useRef<
    Partial<Record<"inspection" | "admin", { payload: string; key: string }>>
  >({});
  async function submit(action: "inspection" | "admin") {
    if (pending) return;
    setError("");
    setSuccess("");
    const inspection = action === "inspection";
    const note = (inspection ? inspectionNote : activationNote).trim();
    if (!note) {
      setError(
        inspection
          ? "Enter an inspection reason before marking the room Ready."
          : "Enter a reason to activate the room.",
      );
      return;
    }
    if (inspection && !checked) {
      setError(
        "Confirm that you physically inspected the room and it is Ready.",
      );
      return;
    }
    const body = inspection
      ? { note, checksConfirmed: true }
      : { note, active: true };
    const payload = JSON.stringify(body);
    setPending(action);
    try {
      const prior = retries.current[action];
      const attempt =
        prior?.payload === payload
          ? prior
          : { payload, key: crypto.randomUUID() };
      retries.current[action] = attempt;
      const response = await fetch(
        `${apiBase}/staff/rooms/${room.id}/${action}`,
        {
          method: inspection ? "POST" : "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, requestKey: attempt.key }),
        },
      ).catch(() => null);
      if (!response?.ok) {
        const result = await response?.json().catch(() => null);
        if (
          !inspection &&
          response?.status === 409 &&
          result?.error === "Inspect and mark the room Ready before activation."
        ) {
          setInspectionRequired(true);
        }
        throw new Error(
          result?.error ||
            "The room update could not be confirmed. Refresh the board before retrying.",
        );
      }
      delete retries.current[action];
      if (inspection) {
        setInspectionNote("");
        setChecked(false);
        setInspectionRequired(false);
      } else {
        setActivationNote("");
      }
      const message = inspection
        ? "Inspection saved. Room marked Ready."
        : "Room activated for booking.";
      notifySuccess(message);
      setSuccess(message);
      try {
        await refresh();
      } catch {
        setError(
          "The change was saved, but the room board could not refresh. Use Refresh to see the latest status.",
        );
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Room update unavailable.",
      );
    } finally {
      setPending(null);
    }
  }
  const disabled = pending !== null || !room.housekeeping_enabled;
  return (
    <>
      {!room.active && room.operational_state === "ready" && (
        <details className="mt-4 border-t border-subtle pt-3 text-sm">
          <summary className="min-h-11 cursor-pointer font-semibold text-primary">
            Booking activation
          </summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit("admin");
            }}
          >
            <fieldset
              disabled={
                disabled || room.maintenance_now || Boolean(room.turnover_until)
              }
            >
              <label className="grid gap-1">
                Activation reason
                <textarea
                  maxLength={1000}
                  required
                  value={activationNote}
                  onChange={(e) => setActivationNote(e.target.value)}
                  className="rounded border border-subtle p-2"
                />
              </label>
              <button className="mt-2 min-h-11 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50">
                Activate for booking
              </button>
            </fieldset>
          </form>
          {!room.housekeeping_enabled && (
            <p className="mt-2 text-muted">
              Booking activation is currently unavailable.
            </p>
          )}
        </details>
      )}
      {(room.legacy_inspection_eligible || inspectionRequired) && (
        <details
          open={inspectionRequired || undefined}
          className="mt-4 border-t border-subtle pt-3 text-sm"
        >
          <summary className="min-h-11 cursor-pointer font-semibold text-primary">
            Inspect room
          </summary>
          <label className="grid gap-1">
            Inspection note
            <textarea
              maxLength={1000}
              value={inspectionNote}
              onChange={(e) => setInspectionNote(e.target.value)}
              className="rounded border border-subtle p-2"
              disabled={disabled}
            />
          </label>
          <label className="flex min-h-11 items-start gap-2 py-2">
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
            className="mt-2 min-h-11 rounded-lg bg-primary px-4 font-semibold text-white disabled:opacity-50"
            disabled={disabled}
            onClick={() => void submit("inspection")}
          >
            Inspect and mark Ready
          </button>
        </details>
      )}
      {pending && (
        <p role="status">
          {pending === "inspection" ? "Saving inspection…" : "Activating room…"}
        </p>
      )}
      {success && (
        <p role="status" className="mt-2 text-green-800">
          {success}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
