import { useEffect, useState } from "react";
import { apiBase } from "./staff-auth";

type Item = {
  id: string;
  channel: "online" | "walk_in";
  category: string;
  start_at: string;
  end_at: string;
  late: boolean;
  checked_in_at?: string;
  checkout_at?: string;
  assigned_room?: string;
  rooms: { id: string; code: string }[];
};
const time = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  }).format(new Date(value));
const button = "rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50";
const demoKey = "staytrack-w02-preview";

function fixtures(): Item[] {
  const now = Date.now();
  return [
    {
      id: "fixture-walk-in",
      channel: "walk_in",
      category: "double_standard",
      late: false,
      start_at: new Date(now).toISOString(),
      end_at: new Date(now + 10800000).toISOString(),
    },
    {
      id: "fixture-online",
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
  const [enabled, setEnabled] = useState(!token);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [keys] = useState(() => new Map<string, string>());
  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetch(`${apiBase}/staff/check-ins`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) {
          setItems(data.items);
          setEnabled(data.enabled);
        }
      })
      .catch(() => {
        if (active) setMessage("Unable to load check-in desk.");
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
          body: JSON.stringify({ roomId: room.id, requestKey: key }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        checkedIn = data.checked_in_at;
        checkout = data.checkout_at;
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
  return (
    <section className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-subtle bg-white p-6">
      <h1 className="text-2xl font-semibold text-primary">
        Room assignment and check-in
      </h1>
      {!token && (
        <p>
          Synthetic preview. Fixture payments are verified and only Ready
          fixtures can be selected.
        </p>
      )}
      {token && !enabled && <p>Live check-in is closed pending acceptance.</p>}
      {message && <p role="alert">{message}</p>}
      {items.map((item) => (
        <article
          key={item.id}
          className="space-y-2 rounded-lg border border-subtle p-4"
        >
          <h2 className="font-semibold">
            {item.channel === "walk_in" ? "Walk-in" : "Online"} ·{" "}
            {item.category.replaceAll("_", " ")}
          </h2>
          <p className="break-all text-sm">{item.id}</p>
          <p>
            Scheduled arrival {time(item.start_at)} · Checkout{" "}
            {time(item.end_at)}
          </p>
          {item.late && (
            <p className="font-semibold text-primary">
              Past the one-hour arrival grace period. Review with staff.
            </p>
          )}
          {item.checked_in_at && item.checkout_at ? (
            <p>
              {item.assigned_room} occupied · In {time(item.checked_in_at)} ·
              Out {time(item.checkout_at)}
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                Ready room
                <select
                  className="rounded-lg border border-subtle p-2"
                  value={selected[item.id] ?? ""}
                  onChange={(e) =>
                    setSelected({ ...selected, [item.id]: e.target.value })
                  }
                >
                  <option value="">Select a room</option>
                  {item.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.code}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={button}
                disabled={
                  !enabled ||
                  busy ||
                  !item.rooms.some(({ id }) => id === selected[item.id])
                }
                onClick={() => void submit(item)}
              >
                Check in
              </button>
            </div>
          )}
        </article>
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
