import React from "react";
import { apiBase } from "./staff-auth";

type Room = {
  id: number;
  code: string;
  category_code: string;
  category_name: string;
  operational_state: string;
  active: boolean;
};
const status: Record<string, string> = {
  ready: "bg-green-100 text-green-800",
  occupied: "bg-purple-100 text-purple-800",
  cleaning: "bg-amber-100 text-amber-800",
  maintenance: "bg-slate-200 text-slate-700",
  unverified: "bg-slate-200 text-slate-700",
};

export default function StaffRooms({ token }: { token: string }) {
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/staff/rooms`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setRooms((await response.json()) as Room[]);
      })
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
  }, [token]);
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
      </div>
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
        {rooms.map((room) => (
          <article
            key={room.id}
            className="rounded-xl border border-subtle bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{room.code}</h3>
                <p className="mt-1 text-sm text-muted">{room.category_name}</p>
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
            {!room.active && (
              <p className="mt-4 text-xs font-semibold text-muted">
                Inactive · unavailable for booking
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
