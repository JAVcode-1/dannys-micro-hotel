import { useEffect, useRef, useState } from "react";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { bookingReference, readableLabel } from "./presentation";
import StaffIcon from "./StaffIcon";
import StaffLoadingSkeleton, { SkeletonBlock } from "./StaffLoadingSkeleton";
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
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    token ? null : 30,
  );
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
  const syncRevision = useRef(0);
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
      const revision = syncRevision.current;
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
        if (active && revision === syncRevision.current) {
          setItems(data.items);
          setReminderMinutes(data.warningMinutes?.[0] ?? null);
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
        ).catch(() => null);
        const data = await response?.json().catch(() => null);
        if (
          response &&
          !response.ok &&
          typeof data?.error === "string" &&
          data.error
        ) {
          if (response.status >= 400 && response.status < 500)
            keys.current.delete(item.id);
          throw new Error(data.error);
        }
        if (
          !response?.ok ||
          typeof data?.checked_out_at !== "string" ||
          !Number.isFinite(Date.parse(data.checked_out_at))
        ) {
          // A read started before the interruption cannot reconcile the checkout.
          syncRevision.current += 1;
          setSyncState("error");
          throw new Error(
            "Checkout could not be confirmed. Synchronize and check the stay status before retrying.",
          );
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
    <section className="staff-stays mx-auto max-w-5xl space-y-5 rounded-2xl border border-subtle bg-white p-6 text-main">
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
        <StaffLoadingSkeleton label="Loading stays and synchronizing server time…">
          <div className="space-y-5">
            <section className="space-y-3">
              <SkeletonBlock className="h-5 w-32" />
              <div className="staff-stays-list" data-kind="active">
                {["w-32", "w-40"].map((nameWidth) => (
                  <article
                    key={nameWidth}
                    className="staff-stay-card rounded-xl border border-subtle p-4"
                  >
                    <div className="space-y-2">
                      <SkeletonBlock className={`h-4 ${nameWidth}`} />
                      <SkeletonBlock className="h-3 w-24" />
                    </div>
                    <div className="staff-stay-schedule">
                      <SkeletonBlock className="h-8 w-full" />
                      <SkeletonBlock className="h-8 w-full" />
                    </div>
                    <div className="staff-stay-clock rounded-xl p-3">
                      <SkeletonBlock className="h-6 w-36" />
                    </div>
                    <div className="staff-stay-actions">
                      <SkeletonBlock className="h-11 w-28" />
                      <SkeletonBlock className="h-4 w-24" />
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="space-y-3">
              <SkeletonBlock className="h-5 w-40" />
              <div className="staff-stays-list" data-kind="completed">
                <article className="staff-stay-card">
                  <SkeletonBlock className="h-4 w-32" />
                  <div className="staff-stay-schedule">
                    <SkeletonBlock className="h-3 w-28" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                  <SkeletonBlock className="h-4 w-28" />
                </article>
              </div>
            </section>
          </div>
        </StaffLoadingSkeleton>
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
            kind: "active",
            icon: "stays",
            items: items.filter((item) => !item.checked_out_at),
          },
          {
            label: "Completed stays",
            kind: "completed",
            icon: "logout",
            items: items.filter((item) => item.checked_out_at),
          },
        ].map((group) => (
          <section
            key={group.label}
            className="space-y-3"
            aria-label={group.label}
          >
            <h2 className="staff-stays-heading text-lg font-semibold">
              <StaffIcon name={group.icon} />
              {group.label}{" "}
              <span className="staff-stays-count">({group.items.length})</span>
            </h2>
            {!group.items.length && (
              <p className="staff-stays-empty staff-empty text-sm text-muted">
                {group.label === "Active stays"
                  ? "No active stays."
                  : "No completed stays in this list."}
              </p>
            )}
            {group.items.length > 0 && (
              <div className="staff-stays-list" data-kind={group.kind}>
                {group.items.map((item) => {
                  const clock = countdown(
                    Date.parse(item.checkout_at),
                    clockNow,
                    reminderMinutes,
                  );
                  const seconds = Math.ceil(
                    Math.max(0, clock.remainingMs) / 1000,
                  );
                  return (
                    <article
                      key={item.id}
                      className="staff-stay-card rounded-xl border border-subtle p-4"
                    >
                      <div>
                        <h3 className="font-semibold">
                          {item.room_code} ·{" "}
                          {item.channel === "online" ? "Online" : "Walk-in"}
                        </h3>
                        <p className="text-sm text-muted">
                          {bookingReference(item.reservation_id)} ·{" "}
                          {readableLabel(item.category_code)}
                        </p>
                      </div>
                      <dl className="staff-stay-schedule">
                        <div>
                          <dt>Checked in</dt>
                          <dd>{time(item.checked_in_at)}</dd>
                        </div>
                        <div>
                          <dt>Scheduled checkout</dt>
                          <dd>{time(item.checkout_at)}</dd>
                        </div>
                        {item.original_checkout_at &&
                          item.original_checkout_at !== item.checkout_at && (
                            <div className="staff-stay-original-checkout">
                              <dt>Original checkout</dt>
                              <dd>{time(item.original_checkout_at)}</dd>
                            </div>
                          )}
                      </dl>
                      {item.checked_out_at ? (
                        <div className="staff-stay-departure">
                          <p className="staff-stay-checkout-status">
                            Checkout recorded
                          </p>
                          <p className="text-sm">
                            Departed {time(item.checked_out_at)}
                          </p>
                          {item.exception_reason && (
                            <p className="text-sm text-muted">
                              Unpaid-departure exception recorded
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <p
                            className="staff-stay-clock rounded-xl p-3 font-bold tabular-nums"
                            data-clock={clock.state}
                          >
                            <span role="status">
                              {clock.state === "overdue" ? "Package expired" : ""}
                            </span>
                            {clock.state !== "overdue" && (
                              <>
                                {clock.state === "warning"
                                  ? `Checkout warning (${clock.warningMinutes}m)`
                                  : "Time remaining"}{" "}
                                <span className="staff-stay-clock-duration">
                                  {Math.floor(seconds / 3600)}h{" "}
                                  {Math.floor(seconds / 60) % 60}m{" "}
                                  {seconds % 60}s
                                </span>
                              </>
                            )}
                          </p>
                          <dl className="staff-stay-balance">
                            <div>
                              <dt>Remaining balance (whole reservation)</dt>
                              <dd>{money(item.balance_centavos)}</dd>
                            </div>
                          </dl>
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
                          <div className="staff-stay-actions">
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
                                className="inline-flex min-h-11 items-center font-semibold text-primary"
                              >
                                Extensions and stay changes
                              </a>
                            )}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
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
