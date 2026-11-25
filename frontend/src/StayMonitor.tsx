import { useEffect, useRef, useState } from "react";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { bookingReference, readableLabel } from "./presentation";
import { countdown, serverTime, type ClockAnchor } from "./stay-clock";
type Item = {
  id: string;
  reservation_id: string;
  channel: string;
  category_code: string;
  room_code: string;
  checked_in_at: string;
  checkout_at: string;
  original_checkout_at?: string;
  checked_out_at?: string;
  balance_centavos: number;
  exception_reason?: string;
  operational_state: string;
};
const demoKey = "staytrack-w03-preview";
function fixtures(): Item[] {
  const now = Date.now();
  return [20, -10, 90].map((minutes, index) => ({
    id: `fixture-item-${index}`,
    reservation_id:
      index < 2 ? "fixture-shared-reservation" : "fixture-online-reservation",
    channel: index < 2 ? "walk_in" : "online",
    category_code: index === 1 ? "family_executive" : "double_standard",
    room_code: `Synthetic fixture ${String.fromCharCode(65 + index)}`,
    checked_in_at: new Date(now - 3 * 3600000).toISOString(),
    checkout_at: new Date(now + minutes * 60000).toISOString(),
    balance_centavos: index < 2 ? 50000 : 0,
    operational_state: "occupied",
  }));
}
const time = (v: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  }).format(new Date(v));
const money = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n / 100,
  );
export default function StayMonitor({ token }: { token?: string }) {
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
  useEffect(() => {
    if (!token) sessionStorage.setItem(demoKey, JSON.stringify(items));
  }, [items, token]);
  const [warnings, setWarnings] = useState<number[]>(token ? [] : [30, 15, 5]);
  const [anchor, setAnchor] = useState<ClockAnchor>({
    serverMs: Date.now(),
    receivedMs: performance.now(),
  });
  const [tick, setTick] = useState(performance.now());
  const [syncState, setSyncState] = useState<"loading" | "ready" | "error">(
    token ? "loading" : "ready",
  );
  const synced = syncState === "ready";
  const [hasLoaded, setHasLoaded] = useState(!token);
  const [enabled, setEnabled] = useState(!token);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const keys = useRef(new Map<string, { key: string; reason: string }>());
  const refresh = useRef<() => Promise<void>>(async () => {});
  const clockNow = serverTime(anchor, tick);
  const hasRunningCountdown = items.some(
    (item) => !item.checked_out_at && Date.parse(item.checkout_at) > clockNow,
  );
  useEffect(() => {
    if (!hasRunningCountdown) return;
    const timer = setInterval(() => setTick(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRunningCountdown]);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    setSyncState(token ? "loading" : "ready");
    setHasLoaded(!token);
    async function load() {
      if (!token) {
        setTick(performance.now());
        return;
      }
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const response = await fetch(`${apiBase}/staff/stays`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        const serverMs = Date.parse(data.serverNow);
        if (!Number.isFinite(serverMs)) throw new Error("Invalid server time");
        if (active) {
          setItems(data.items);
          setWarnings(data.warningMinutes);
          setAnchor({
            serverMs,
            receivedMs: performance.now(),
          });
          setTick(performance.now());
          setSyncState("ready");
          setHasLoaded(true);
          setEnabled(data.enabled);
          setMessage("");
        }
      } catch {
        if (active) {
          setSyncState("error");
          setEnabled(false);
        }
      } finally {
        inFlight = false;
      }
    }
    refresh.current = load;
    void load();
    const poll = setInterval(() => void load(), 15000);
    const resume = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      controller.abort();
      clearInterval(poll);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [token]);
  async function depart(item: Item) {
    setBusy(true);
    setMessage("");
    try {
      const reason = (reasons[item.id] ?? "").trim();
      if (item.balance_centavos > 0 && !reason)
        throw new Error(
          "Settle the reservation balance or document an unpaid-departure exception.",
        );
      let departed = new Date(serverTime(anchor)).toISOString();
      if (token) {
        const prior = keys.current.get(item.id);
        if (prior && prior.reason !== reason)
          throw new Error(
            "Retry the original reason first, or refresh and reconcile the uncertain checkout.",
          );
        const attempt = prior ?? { key: crypto.randomUUID(), reason };
        keys.current.set(item.id, attempt);
        const response = await fetch(
          `${apiBase}/staff/stays/${item.id}/checkout`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requestKey: attempt.key,
              exceptionReason: reason || null,
            }),
          },
        );
        const data = await response.json();
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500)
            keys.current.delete(item.id);
          throw new Error(data.error);
        }
        departed = data.checked_out_at;
        notifySuccess("Checkout recorded. Room needs cleaning.");
      }
      const next = items.map((row) =>
        row.id === item.id
          ? {
              ...row,
              checked_out_at: departed,
              exception_reason: reason,
              operational_state: "cleaning",
            }
          : row,
      );
      setItems(next);
      if (!token) sessionStorage.setItem(demoKey, JSON.stringify(next));
      setMessage(
        "Departure recorded. Needs Cleaning. No automatic overtime charge.",
      );
      if (token) await refresh.current();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Checkout unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-5xl space-y-5 rounded-2xl border border-subtle bg-white p-6 text-main">
      <h1 className="text-2xl font-semibold text-primary">
        Stays and checkout
      </h1>
      {!token && (
        <p>
          Synthetic preview only. Fixture labels are not actual hotel room
          identifiers. No booking or payment network writes.
        </p>
      )}
      {token && synced && !enabled && (
        <p>Live checkout is closed pending acceptance.</p>
      )}
      {message && <p role="status">{message}</p>}
      {syncState === "loading" && (
        <p role="status">Loading stays and synchronizing server time…</p>
      )}
      {syncState === "error" && (
        <div className="space-y-3">
          <p role="alert">
            Server time could not be refreshed. Countdown may be stale. Checkout
            is paused until the connection is restored.
          </p>
          <button type="button" onClick={() => void refresh.current()}>
            Retry synchronization
          </button>
        </div>
      )}
      {hasLoaded &&
        [
          {
            label: "Active stays",
            items: items.filter((item) => !item.checked_out_at),
          },
          {
            label: "Completed stays",
            items: items.filter((item) => item.checked_out_at),
          },
        ].map((group) => (
          <section
            key={group.label}
            className="space-y-3"
            aria-label={group.label}
          >
            <h2 className="text-lg font-semibold">
              {group.label}{" "}
              <span className="text-sm text-muted">({group.items.length})</span>
            </h2>
            {!group.items.length && (
              <p className="staff-empty text-sm text-muted">
                {group.label === "Active stays"
                  ? "No active stays."
                  : "No completed stays in this list."}
              </p>
            )}
            {group.items.map((item) => {
              const clock = countdown(
                Date.parse(item.checkout_at),
                clockNow,
                warnings,
              );
              const seconds = Math.ceil(Math.max(0, clock.remainingMs) / 1000);
              return (
                <article
                  key={item.id}
                  className="space-y-2 rounded-xl border border-subtle p-4"
                >
                  <h3 className="font-semibold">
                    {item.room_code} ·{" "}
                    {item.channel === "online" ? "Online" : "Walk-in"}
                  </h3>
                  <p>
                    {bookingReference(item.reservation_id)} ·{" "}
                    {readableLabel(item.category_code)}
                  </p>
                  <p>
                    Checked in {time(item.checked_in_at)} · Scheduled checkout{" "}
                    {time(item.checkout_at)}
                    {item.original_checkout_at &&
                      item.original_checkout_at !== item.checkout_at && (
                        <span className="block text-sm text-muted">
                          Original checkout: {time(item.original_checkout_at)}
                        </span>
                      )}
                  </p>
                  {item.checked_out_at ? (
                    <p>
                      Departed {time(item.checked_out_at)} · Checkout recorded
                      {item.exception_reason
                        ? " · Unpaid-departure exception recorded"
                        : ""}
                    </p>
                  ) : (
                    <>
                      <p
                        className={`rounded-xl p-3 text-xl font-bold tabular-nums ${clock.state === "overdue" ? "bg-red-50 text-red-800" : clock.state === "warning" ? "bg-amber-50 text-amber-900" : "bg-selected text-primary"}`}
                      >
                        <span role="status">
                          {clock.state === "overdue" ? "Package expired" : ""}
                        </span>
                        {clock.state !== "overdue" && (
                          <>
                            {clock.state === "warning"
                              ? `Checkout warning (${clock.warningMinutes}m)`
                              : "Time remaining"}{" "}
                            · {Math.floor(seconds / 3600)}h{" "}
                            {Math.floor(seconds / 60) % 60}m {seconds % 60}s
                          </>
                        )}
                      </p>
                      <p>
                        Remaining balance (whole reservation):{" "}
                        {money(item.balance_centavos)}
                      </p>
                      {item.balance_centavos > 0 && (
                        <label className="grid gap-1">
                          Unpaid-departure exception reason · {item.room_code}
                          <textarea
                            className="rounded-lg border border-subtle p-2"
                            maxLength={1000}
                            value={reasons[item.id] ?? ""}
                            onChange={(e) =>
                              setReasons({
                                ...reasons,
                                [item.id]: e.target.value,
                              })
                            }
                          />
                        </label>
                      )}
                      <button
                        className="min-h-11 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
                        disabled={!enabled || !synced || busy}
                        onClick={() => void depart(item)}
                      >
                        Record checkout · {item.room_code}
                      </button>
                      {token && (
                        <a
                          href="/staff/stay-changes"
                          className="ml-3 inline-flex min-h-11 items-center font-semibold text-primary"
                        >
                          Extensions and stay changes
                        </a>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      {!token && (
        <button
          className="rounded-lg bg-selected px-4 py-2 text-primary"
          onClick={() => {
            sessionStorage.removeItem(demoKey);
            setItems(fixtures());
            setReasons({});
            setAnchor({ serverMs: Date.now(), receivedMs: performance.now() });
            setTick(performance.now());
            setMessage("");
          }}
        >
          Reset synthetic preview
        </button>
      )}
    </section>
  );
}
