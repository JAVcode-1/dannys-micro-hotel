import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { StayFinancials } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { GuestRescheduleForm } from "./RescheduleDesk";
import type { RescheduleRecord } from "@staytrack/shared";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    value / 100,
  );
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
type Reservation = {
  id: string;
  primaryName: string;
  channel: string;
  createdAt: string;
  totalCentavos: number;
  roomCount?: number;
  states?: string[];
  email?: string;
};
type Detail = {
  contact?: {
    phone: string;
    email?: string | null;
    policy_version: string;
    acknowledged_by: string;
    acknowledged_at: string;
    minor_id_status?: string;
    minor_id_checked_by?: string | null;
    minor_id_checked_at?: string | null;
  } | null;
  rescheduleEnabled?: boolean;
  reservation: Reservation;
  items: {
    id: string;
    category: string;
    startAt: string;
    endAt: string;
    checkoutAt: string | null;
    roomCode: string | null;
    status: string;
    adults: number;
    children: number;
    state?: string;
    checkedInAt?: string | null;
    checkedOutAt?: string | null;
    blocks?: number[];
    scheduleRevision?: number;
    confirmationAt?: string | null;
    pendingReschedule?: boolean;
  }[];
  financials: StayFinancials;
  payments: {
    id: string;
    source: string;
    method: string;
    amountCentavos: number;
    recordedAt: string;
  }[];
  refunds: { roomBookingId: string; amountCentavos: number; status: string }[];
};

export default function StaffReservations({ token }: { token: string }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{
    reservations: Reservation[];
    hasMore: boolean;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError("");
    void fetch(
      `${apiBase}/staff/reservations?${new URLSearchParams({ q: query, page: String(page) })}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Reservation index unavailable.");
        return response.json();
      })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Reservation index unavailable. Try again.");
      });
    return () => controller.abort();
  }, [token, query, page]);
  return (
    <section className="mt-6 min-w-0">
      <h2 className="text-xl font-bold">All reservations</h2>
      <form
        className="my-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setQuery(search.trim());
        }}
      >
        <label className="min-w-0 flex-1">
          Search name, email or reservation ID
          <input
            className="block w-full rounded border p-3 text-base"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="self-end rounded bg-primary px-4 py-3 text-white">
          Search
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading reservations…</p>}
      {data && (
        <>
          <ul className="space-y-3">
            {data.reservations.map((r) => (
              <li
                key={r.id}
                className="rounded border border-subtle p-4 [overflow-wrap:anywhere]"
              >
                <Link
                  className="font-bold text-primary underline"
                  to={`/staff/reservations/${r.id}`}
                >
                  {r.primaryName}
                </Link>
                <p>
                  {r.channel === "online" ? "Online" : "Walk-in"} ·{" "}
                  {r.roomCount} room items · {money(r.totalCentavos)}
                </p>
                <p className="text-sm">{r.id}</p>
                <p>
                  {r.states
                    ?.map((s) =>
                      s === "proof_pending_review"
                        ? "Awaiting staff payment review"
                        : s.replaceAll("_", " "),
                    )
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
          {!data.reservations.length && (
            <p>No reservations match this search.</p>
          )}
          <div className="mt-4 flex gap-4">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              disabled={!data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function StaffReservationDetail({ token }: { token: string }) {
  const { id } = useParams();
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(undefined);
    setError("");
    void fetch(`${apiBase}/staff/reservations/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Reservation not found or unavailable.");
        return r.json();
      })
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError("Reservation not found or unavailable.");
      });
    return () => c.abort();
  }, [token, id]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading reservation…</p>;
  return (
    <section className="mt-6 min-w-0 [overflow-wrap:anywhere]">
      <div className="print:hidden">
        <Link to="/staff/reservations" className="text-primary underline">
          All reservations
        </Link>
        <button
          className="ml-4 rounded border p-3"
          onClick={() => window.print()}
        >
          Print internal statement
        </button>
      </div>
      <h2 className="mt-4 text-2xl font-bold">
        {data.reservation.primaryName}
      </h2>
      <p>{data.reservation.id}</p>
      <p>
        {data.reservation.email || data.contact?.email || "No email recorded"} ·{" "}
        {data.reservation.channel}
      </p>
      {data.contact && (
        <div className="my-3 text-sm">
          <p>Contact phone: {data.contact.phone}</p>
          {data.contact.email && (
            <p>Walk-in email is unverified until separately verified.</p>
          )}
          <p>
            Policy {data.contact.policy_version} acknowledged{" "}
            {time(data.contact.acknowledged_at)}.
          </p>
          {data.contact.minor_id_status && (
            <p>
              Minor ID check metadata:{" "}
              {data.contact.minor_id_status.replaceAll("_", " ")}
              {data.contact.minor_id_checked_at
                ? ` · ${time(data.contact.minor_id_checked_at)}`
                : ""}
              . This does not determine legal eligibility. No ID photograph is
              stored.
            </p>
          )}
        </div>
      )}
      <h3 className="mt-6 font-bold">
        Internal reservation and financial statement
      </h3>
      <p className="font-semibold">Not an official fiscal receipt.</p>
      <dl className="my-4 grid grid-cols-2 gap-2">
        {(
          [
            ["Net charges", data.financials.netChargeCentavos],
            ["Verified collections", data.financials.collectedCentavos],
            ["Balance due", data.financials.settlementDueCentavos],
            ["Refund due", data.financials.refundDueCentavos],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="font-bold tabular-nums">{money(value)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="font-bold">Room items</h3>
      {data.items.map((item) => (
        <article className="my-3 rounded border p-4" key={item.id}>
          <h4 className="font-semibold">
            {item.category.replaceAll("_", " ")} ·{" "}
            {item.roomCode || "Room assignment pending"}
          </h4>
          <p>{item.status}</p>
          <p>
            {time(item.startAt)} – {time(item.checkoutAt || item.endAt)}
          </p>
          <p>
            {item.adults} adults · {item.children} children
          </p>
          <nav
            aria-label={`Actions for room item ${item.id}`}
            className="mt-3 flex flex-wrap gap-4 text-primary print:hidden"
          >
            <Link to={`/staff/check-ins?item=${item.id}`}>Check-in</Link>
            <Link to={`/staff/stays?item=${item.id}`}>Stay and checkout</Link>
            <Link to={`/staff/reschedules?item=${item.id}`}>Reschedule</Link>
            <Link to={`/staff/cancellations?item=${item.id}`}>
              Cancellation and refund
            </Link>
            <Link to={`/staff/stay-changes?item=${item.id}`}>
              Extensions and charges
            </Link>
          </nav>
          <StaffAssistedReschedule
            token={token}
            reservationId={data.reservation.id}
            channel={data.reservation.channel}
            enabled={data.rescheduleEnabled === true}
            item={item}
          />
        </article>
      ))}
      <h3 className="mt-6 font-bold">Verified payment history</h3>
      {data.payments.length ? (
        data.payments.map((p) => (
          <p key={`${p.source}:${p.id}`}>
            {time(p.recordedAt)} · {p.method} · {money(p.amountCentavos)}
          </p>
        ))
      ) : (
        <p>No verified collections recorded.</p>
      )}
      <h3 className="mt-6 font-bold">Refund history</h3>
      {data.refunds.length ? (
        data.refunds.map((r) => (
          <p key={r.roomBookingId}>
            {money(r.amountCentavos)} · {r.status}
          </p>
        ))
      ) : (
        <p>No approved refunds recorded.</p>
      )}
    </section>
  );
}

function StaffAssistedReschedule({
  token,
  reservationId,
  channel,
  enabled,
  item,
}: {
  token: string;
  reservationId: string;
  channel: string;
  enabled: boolean;
  item: Detail["items"][number];
}) {
  if (!enabled)
    return (
      <p className="mt-3 text-sm text-muted print:hidden">
        Reschedule requests are closed pending isolated activation and
        acceptance.
      </p>
    );
  if (item.checkedInAt || item.checkedOutAt)
    return (
      <p className="mt-3 text-sm text-muted print:hidden">
        This room has entered its stay. Use the active-stay controls for
        changes.
      </p>
    );
  if (item.pendingReschedule)
    return (
      <p className="mt-3 text-sm text-muted print:hidden">
        A reschedule request is already awaiting staff review.
      </p>
    );
  if (
    channel !== "online" ||
    item.state !== "confirmed" ||
    !item.blocks?.length
  )
    return (
      <p className="mt-3 text-sm text-muted print:hidden">
        Assisted rescheduling requires a confirmed online room. Walk-in schedule
        policy remains pending.
      </p>
    );
  async function readSnapshot() {
    const response = await fetch(
      `${apiBase}/staff/reservations/${encodeURIComponent(reservationId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!response.ok) throw new Error("Reservation refresh unavailable.");
    const snapshot = (await response.json()) as Detail;
    const current = snapshot.items.find((row) => row.id === item.id);
    if (
      !current ||
      current.checkedInAt ||
      current.checkedOutAt ||
      current.state !== "confirmed"
    )
      throw new Error(
        "This room is no longer eligible. Reload the reservation workspace.",
      );
    return {
      revision: current.scheduleRevision ?? 0,
      startAt: current.startAt,
      endAt: current.endAt,
      confirmationAt: current.confirmationAt ?? null,
      pending: current.pendingReschedule ?? false,
    };
  }
  return (
    <details className="mt-4 rounded-xl border border-subtle p-4 print:hidden">
      <summary className="cursor-pointer font-semibold text-primary">
        Request a schedule change for this room
      </summary>
      <p className="mt-3 text-sm text-muted">
        Record the guest's requested schedule. The existing reservation remains
        active until a separate staff approval checks availability and policy.
      </p>
      <GuestRescheduleForm
        itemId={item.id}
        revision={item.scheduleRevision ?? 0}
        startAt={item.startAt}
        endAt={item.endAt}
        blocks={item.blocks}
        confirmationAt={item.confirmationAt ?? null}
        refresh={readSnapshot}
        submit={async (input) => {
          const response = await fetch(
            `${apiBase}/staff/reschedules/${encodeURIComponent(item.id)}/request`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(input),
            },
          );
          const result = (await response.json()) as RescheduleRecord & {
            error?: string;
          };
          if (!response.ok)
            throw Object.assign(
              new Error(result.error ?? "Reschedule request unavailable."),
              { status: response.status },
            );
          return result;
        }}
      />
    </details>
  );
}

export function StaffDashboard({ token }: { token: string }) {
  const [counts, setCounts] = useState<Record<string, number>>();
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`${apiBase}/staff/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const next = await response.json();
        if (!controller.signal.aborted) {
          setCounts(next);
          setMessage("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setCounts(undefined);
          setMessage(
            "Live summary unavailable. Open the individual operational queues.",
          );
        }
      }
    }
    setCounts(undefined);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [token]);
  return (
    <section className="mt-6">
      <h2 className="text-2xl font-bold">Today’s operations</h2>
      <p className="mt-2">
        Use the live operational queues to review arrivals, occupied stays,
        payment proofs and room readiness.
      </p>
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
      {counts && (
        <dl
          aria-label="Current operational queues"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {[
            ["arrivals", "Arrivals today"],
            ["paymentReviews", "Payment proofs to review"],
            ["occupied", "Active stays"],
            ["overdue", "Overdue stays"],
            ["needsCleaning", "Rooms to clean"],
            ["maintenance", "Rooms in maintenance"],
          ].map(([key, label]) => (
            <div className="rounded border border-subtle p-3" key={key}>
              <dt className="text-sm">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums">
                {counts[key]?.toLocaleString("en-PH") ?? "Unavailable"}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <nav className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["/staff/check-ins", "Arrivals and no-show review"],
          ["/staff/stays", "Active stays and overdue checkout"],
          ["/staff/payments", "GCash verification queue"],
          ["/staff/rooms", "Cleaning and maintenance"],
          ["/staff/reservations", "Search all reservations"],
          ["/staff/hall", "Function Hall operations"],
        ].map(([to, label]) => (
          <Link
            className="rounded border border-subtle bg-selected p-4 font-semibold text-primary"
            key={to}
            to={to}
          >
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
