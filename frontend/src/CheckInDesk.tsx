import { useEffect, useState } from "react";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { readableLabel } from "./presentation";
import StaffIcon from "./StaffIcon";
import StaffLoadingSkeleton, { SkeletonBlock } from "./StaffLoadingSkeleton";

type Item = {
  id: string;
  primary_name?: string;
  reservation_room_number?: number | null;
  channel: "online" | "walk_in";
  category: string;
  start_at: string;
  end_at: string;
  late: boolean;
  checked_in_at?: string;
  checkout_at?: string;
  assigned_room?: string;
  rooms: { id: string; code: string }[];
  no_show_review?: { decision: string; note: string };
};
const time = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  }).format(new Date(value));
const button =
  "min-h-11 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50";
const demoKey = "staytrack-w02-preview";

function fixtures(): Item[] {
  const now = Date.now();
  return [
    {
      id: "fixture-walk-in",
      primary_name: "Sample walk-in guest",
      channel: "walk_in",
      category: "double_standard",
      late: false,
      start_at: new Date(now).toISOString(),
      end_at: new Date(now + 10800000).toISOString(),
    },
    {
      id: "fixture-online",
      primary_name: "Sample online guest",
      channel: "online",
      category: "double_standard",
      late: true,
      start_at: new Date(now - 3900000).toISOString(),
      end_at: new Date(now + 6900000).toISOString(),
    },
  ].map((item) => ({
    ...item,
    rooms: [
      { id: "a", code: "Fixture A" },
      { id: "b", code: "Fixture B" },
    ],
  })) as Item[];
}

export default function CheckInDesk({ token }: { token?: string }) {
  const [items, setItems] = useState<Item[]>(() => {
    if (token) return [];
    try {
      return (
        JSON.parse(sessionStorage.getItem(demoKey) ?? "null") ?? fixtures()
      );
    } catch {
      return fixtures();
    }
  });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [earlyReasons, setEarlyReasons] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(!token);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">(
    token ? "loading" : "ready",
  );
  const [keys] = useState(() => new Map<string, string>());
  useEffect(() => {
    if (!token) return;
    let active = true;
    setListStatus("loading");
    void fetch(`${apiBase}/staff/check-ins`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) {
          setItems(data.items);
          setEnabled(data.enabled);
          setListStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setListStatus("error");
          setMessage("Unable to load check-in desk.");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function submit(item: Item) {
    const room = item.rooms.find(({ id }) => id === selected[item.id]);
    if (!room) return;
    setBusy(true);
    setMessage("");
    try {
      let checkedIn = new Date().toISOString();
      let checkout =
        item.channel === "walk_in"
          ? new Date(
              +new Date(checkedIn) +
                (+new Date(item.end_at) - +new Date(item.start_at)),
            ).toISOString()
          : item.end_at;
      if (token) {
        const attempt = `${item.id}:${room.id}`;
        const key = keys.get(attempt) ?? crypto.randomUUID();
        keys.set(attempt, key);
        const response = await fetch(`${apiBase}/staff/check-ins/${item.id}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.id,
            requestKey: key,
            earlyApproval: earlyReasons[item.id],
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        checkedIn = data.checked_in_at;
        checkout = data.checkout_at;
        notifySuccess("Guest check-in recorded.");
      }
      const next = items.map((row) =>
        row.id === item.id
          ? {
              ...row,
              checked_in_at: checkedIn,
              checkout_at: checkout,
              assigned_room: room.code,
              late: false,
            }
          : { ...row, rooms: row.rooms.filter(({ id }) => id !== room.id) },
      );
      setItems(next);
      if (!token) sessionStorage.setItem(demoKey, JSON.stringify(next));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Check-in unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reviewNoShow(item: Item, decision: string) {
    if (!token || !reviewNotes[item.id]?.trim()) return;
    setBusy(true);
    setMessage("");
    const attempt = `${item.id}:no-show:${decision}:${reviewNotes[item.id]}`;
    const key = keys.get(attempt) ?? crypto.randomUUID();
    keys.set(attempt, key);
    try {
      const response = await fetch(
        `${apiBase}/staff/check-ins/${item.id}/no-show`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            note: reviewNotes[item.id],
            requestKey: key,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                no_show_review: { decision, note: reviewNotes[item.id] },
              }
            : row,
        ),
      );
      notifySuccess("No-show review recorded.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No-show review unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  const groups =
    listStatus === "ready"
      ? [
          {
            label: "Arriving guests",
            icon: "arrivals",
            items: items.filter((item) => !item.checked_in_at),
          },
          {
            label: "Checked in",
            icon: "stays",
            items: items.filter((item) => item.checked_in_at),
          },
        ]
      : [];
  return (
    <section className="staff-check-in mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-subtle bg-white p-6">
      <h1 className="text-2xl font-semibold text-primary">Check-in</h1>
      {!token && (
        <p>
          Synthetic preview. Fixture payments are verified and only Ready
          fixtures can be selected.
        </p>
      )}
      {token && !enabled && listStatus !== "loading" && (
        <p>Live check-in is closed pending acceptance.</p>
      )}
      {message && <p role="alert">{message}</p>}
      {listStatus === "loading" && (
        <StaffLoadingSkeleton label="Loading check-ins…">
          <div className="grid gap-4 min-[72rem]:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
            {["arriving", "checked-in"].map((group) => (
              <div key={group} className="staff-check-in-group">
                <SkeletonBlock className="h-5 w-32" />
                <article className="staff-check-in-card space-y-3 rounded-lg border border-subtle p-4">
                  <SkeletonBlock className="h-5 w-36" />
                  <SkeletonBlock className="h-3 w-24" />
                  <div className="staff-check-in-schedule">
                    <SkeletonBlock className="h-8 w-full" />
                    <SkeletonBlock className="h-8 w-full" />
                  </div>
                  {group === "arriving" && (
                    <div className="flex flex-wrap gap-3 border-t border-subtle pt-3">
                      <SkeletonBlock className="h-11 min-w-32 flex-1" />
                      <SkeletonBlock className="h-11 w-24" />
                    </div>
                  )}
                </article>
              </div>
            ))}
          </div>
        </StaffLoadingSkeleton>
      )}
      {groups.map((group) => (
        <section
          key={group.label}
          className="staff-check-in-group"
          aria-label={group.label}
        >
          <h2 className="staff-check-in-group-heading text-lg font-semibold">
            <StaffIcon name={group.icon} />
            {group.label}{" "}
            <span className="staff-check-in-count">({group.items.length})</span>
          </h2>
          {!group.items.length && (
            <p className="staff-check-in-empty text-sm text-muted">
              {group.label === "Arriving guests"
                ? "No guests awaiting check-in."
                : "No check-ins recorded in this list."}
            </p>
          )}
          {group.items.map((item) => (
            <article
              key={item.id}
              className="staff-check-in-card space-y-3 rounded-lg border border-subtle p-4"
            >
              <h3 className="break-words font-semibold">
                {item.primary_name || "Guest name unavailable"}
              </h3>
              <p className="text-sm text-muted">
                {item.channel === "walk_in" ? "Walk-in" : "Online"} ·{" "}
                {readableLabel(item.category)}
                {item.reservation_room_number != null &&
                  ` · Booked room ${item.reservation_room_number}`}
              </p>
              <dl className="staff-check-in-schedule">
                <div>
                  <dt>Scheduled arrival</dt>
                  <dd>{time(item.start_at)}</dd>
                </div>
                <div>
                  <dt>Checkout</dt>
                  <dd>{time(item.end_at)}</dd>
                </div>
              </dl>
              {item.late && (
                <p className="staff-check-in-late">
                  <StaffIcon name="clock" />
                  Past the one-hour arrival grace period. Review with staff.
                </p>
              )}
              {item.no_show_review && (
                <p>
                  Last arrival review:{" "}
                  {item.no_show_review.decision === "no_show"
                    ? "No-show"
                    : "Guest expected"}{" "}
                  · {item.no_show_review.note}. Capacity remains protected.
                </p>
              )}
              {token && item.late && !item.checked_in_at && (
                <div className="staff-check-in-review">
                  <label className="staff-check-in-review-note grid gap-1">
                    Arrival review note
                    <input
                      maxLength={1000}
                      value={reviewNotes[item.id] ?? ""}
                      onChange={(e) =>
                        setReviewNotes({
                          ...reviewNotes,
                          [item.id]: e.target.value,
                        })
                      }
                      className="rounded-lg border border-subtle p-2"
                    />
                  </label>
                  <button
                    className={button}
                    disabled={!enabled || busy || !reviewNotes[item.id]?.trim()}
                    onClick={() =>
                      void reviewNoShow(
                        item,
                        item.no_show_review?.decision === "no_show"
                          ? "expected"
                          : "no_show",
                      )
                    }
                  >
                    {item.no_show_review?.decision === "no_show"
                      ? "Reopen as expected"
                      : "Record reviewed no-show"}
                  </button>
                  <p className="staff-check-in-review-help text-sm">
                    This records the review only. It does not release capacity,
                    charge a penalty or issue a refund.
                  </p>
                </div>
              )}
              {item.checked_in_at && item.checkout_at ? (
                <p className="staff-check-in-occupied">
                  {item.assigned_room} occupied · In {time(item.checked_in_at)}{" "}
                  · Out {time(item.checkout_at)}
                </p>
              ) : (
                <div className="staff-check-in-assign flex flex-wrap items-end gap-3">
                  <label className="staff-check-in-room grid gap-1">
                    Ready room
                    <select
                      className="rounded-lg border border-subtle p-2"
                      value={selected[item.id] ?? ""}
                      onChange={(e) =>
                        setSelected({ ...selected, [item.id]: e.target.value })
                      }
                    >
                      <option value="">Select a room</option>
                      {[...item.rooms]
                        .sort((a, b) =>
                          a.code.localeCompare(b.code, "en", {
                            numeric: true,
                            sensitivity: "base",
                          }),
                        )
                        .map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.code}
                          </option>
                        ))}
                    </select>
                  </label>
                  {!item.rooms.length && (
                    <p
                      role="status"
                      className="staff-check-in-unavailable text-sm text-amber-800"
                    >
                      No Ready rooms available. Refresh before assigning a room.
                    </p>
                  )}
                  <button
                    className={button}
                    disabled={
                      !enabled ||
                      busy ||
                      item.no_show_review?.decision === "no_show" ||
                      (item.channel === "online" &&
                        Date.parse(item.start_at) > Date.now() &&
                        !earlyReasons[item.id]?.trim()) ||
                      !item.rooms.some(({ id }) => id === selected[item.id])
                    }
                    onClick={() => void submit(item)}
                  >
                    Check in
                  </button>
                  {item.channel === "online" &&
                    Date.parse(item.start_at) > Date.now() && (
                      <label className="staff-check-in-early grid gap-1">
                        Early check-in approval reason
                        <span className="text-sm text-muted">
                          Purchased duration stays unchanged; checkout moves
                          earlier.
                        </span>
                        <input
                          maxLength={1000}
                          value={earlyReasons[item.id] ?? ""}
                          onChange={(e) =>
                            setEarlyReasons({
                              ...earlyReasons,
                              [item.id]: e.target.value,
                            })
                          }
                          className="rounded-lg border border-subtle p-2"
                        />
                      </label>
                    )}
                </div>
              )}
            </article>
          ))}
        </section>
      ))}
      {!token && (
        <button
          className={button}
          onClick={() => {
            sessionStorage.removeItem(demoKey);
            setItems(fixtures());
            setSelected({});
          }}
        >
          Reset preview
        </button>
      )}
    </section>
  );
}
