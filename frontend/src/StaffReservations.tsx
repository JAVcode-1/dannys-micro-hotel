import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import StaffIcon from "./StaffIcon";
import { bookingReference, readableLabel } from "./presentation";
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
type HallItem = {
  id: string;
  setup: string;
  startAt: string;
  endAt: string;
  attendees: number;
  status: string;
  totalCentavos: number;
  actualStart?: string | null;
};
const serviceLabel = (kind?: string) =>
  kind === "combined"
    ? "Accommodation + Function Hall"
    : kind === "hall"
      ? "Function Hall"
      : "Accommodation";
type Reservation = {
  id: string;
  primaryName: string;
  channel: string;
  createdAt: string;
  totalCentavos: number;
  roomCount?: number;
  hallCount?: number;
  serviceKind?: "accommodation" | "hall" | "combined";
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
  hallItems?: HallItem[];
  financials: StayFinancials;
  payments: {
    id: string;
    source: string;
    method: string;
    amountCentavos: number;
    recordedAt: string;
  }[];
  refunds: {
    id?: string;
    roomBookingId: string | null;
    hallReservationId?: string;
    amountCentavos: number;
    status: string;
    transferredAt?: string | null;
  }[];
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
    <section className="staff-reservation-index mt-6 min-w-0">
      <h2 className="text-xl font-bold">All reservations</h2>
      <p className="mt-2 text-sm text-muted">
        Find a booking, review its details and manage each stay.
      </p>
      <form
        className="my-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setQuery(search.trim());
        }}
      >
        <label className="min-w-0 flex-1">
          Guest name, email or full booking ID
          <input
            className="block w-full rounded border p-3 text-base"
            value={search}
            maxLength={120}
            placeholder="Search reservations…"
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
          <ul className="staff-reservation-list">
            {data.reservations.map((r) => (
              <li
                key={r.id}
                className="staff-reservation-row [overflow-wrap:anywhere]"
              >
                <div className="staff-reservation-guest">
                  <span className="staff-reservation-avatar" aria-hidden="true">
                    <StaffIcon name="reservations" />
                  </span>
                  <div>
                    <Link
                      className="staff-reservation-name"
                      to={`/staff/reservations/${r.id}`}
                    >
                      {r.primaryName}
                    </Link>
                    <p className="text-sm font-semibold text-primary">
                      {bookingReference(r.id)}
                    </p>
                  </div>
                </div>
                <div className="staff-reservation-summary">
                  <p className="text-sm text-muted">
                    {r.channel === "online" ? "Online" : "Walk-in"} ·{" "}
                    {serviceLabel(r.serviceKind)} · {r.roomCount ?? 0} rooms
                    {r.hallCount ? ` · ${r.hallCount} Hall event` : ""}
                  </p>
                  <div className="staff-status-list">
                    {r.states?.map((s, index) => (
                      <span
                        className="staff-status"
                        data-state={s}
                        key={`${s}:${index}`}
                      >
                        {s === "proof_pending_review"
                          ? "Awaiting staff payment review"
                          : readableLabel(s)}
                      </span>
                    ))}
                  </div>
                </div>
                <strong className="staff-reservation-amount">
                  {money(r.totalCentavos)}
                </strong>
                <Link
                  className="staff-reservation-open"
                  to={`/staff/reservations/${r.id}`}
                  aria-label={`View reservation for ${r.primaryName}`}
                >
                  View <StaffIcon name="arrow" />
                </Link>
              </li>
            ))}
          </ul>
          {!data.reservations.length && (
            <p className="staff-empty">No reservations match this search.</p>
          )}
          <div className="staff-pagination mt-4 flex gap-4">
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
    <section className="staff-reservation-detail mt-6 min-w-0 [overflow-wrap:anywhere]">
      <div className="print:hidden">
        <Link to="/staff/reservations" className="text-primary underline">
          All reservations
        </Link>
      </div>
      <h2 className="mt-4 text-2xl font-bold">
        {data.reservation.primaryName}
      </h2>
      <p className="mt-2 font-semibold text-primary">
        {bookingReference(data.reservation.id)} -{" "}
        {serviceLabel(data.reservation.serviceKind)}
      </p>
      <p>
        {data.reservation.email || data.contact?.email || "No email recorded"} ·{" "}
        {readableLabel(data.reservation.channel)}
      </p>
      {data.contact && (
        <details className="my-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            Contact and policy records
          </summary>
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
              {readableLabel(data.contact.minor_id_status)}
              {data.contact.minor_id_checked_at
                ? ` · ${time(data.contact.minor_id_checked_at)}`
                : ""}
              . This does not determine legal eligibility. No ID photograph is
              stored.
            </p>
          )}
        </details>
      )}
      <h3 className="mt-6 font-bold">Charges and payments</h3>
      <p className="font-semibold">Not an official fiscal receipt.</p>
      <dl className="staff-financial-summary my-4 grid grid-cols-2 gap-2">
        {(
          [
            ["Total amount", data.financials.netChargeCentavos],
            ["Amount paid", data.financials.collectedCentavos],
            ["Remaining balance", data.financials.settlementDueCentavos],
            ["Refund due", data.financials.refundDueCentavos],
          ] as const
        )
          .filter(([label, value]) => label !== "Refund due" || value > 0)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="font-bold tabular-nums">{money(value)}</dd>
            </div>
          ))}
      </dl>
      {data.items.length > 0 && <h3 className="font-bold">Accommodation</h3>}
      {data.items.map((item) => (
        <article className="my-3 rounded border p-4" key={item.id}>
          <h4 className="font-semibold">
            {readableLabel(item.category)} ·{" "}
            {item.roomCode || "Room assignment pending"}
          </h4>
          <p
            className="staff-status"
            data-state={
              item.checkedOutAt
                ? "checked_out"
                : item.checkedInAt
                  ? "checked_in"
                  : (item.state ?? item.status)
            }
          >
            {item.checkedOutAt
              ? "Checked out"
              : item.checkedInAt
                ? "Checked in"
                : readableLabel(item.state ?? item.status)}
          </p>
          <p>
            {time(item.startAt)} – {time(item.checkoutAt || item.endAt)}
          </p>
          {item.checkedInAt && <p>Checked in: {time(item.checkedInAt)}</p>}
          {item.checkedOutAt && <p>Checked out: {time(item.checkedOutAt)}</p>}
          {item.checkoutAt && item.checkoutAt !== item.endAt && (
            <p className="text-sm text-muted">
              Originally scheduled departure: {time(item.endAt)}
            </p>
          )}
          <p>
            {item.adults} adults · {item.children} children
          </p>
          <nav
            aria-label={`Actions for room item ${item.id}`}
            className="mt-3 flex flex-wrap gap-4 text-primary print:hidden"
          >
            {!item.checkedInAt &&
              !item.checkedOutAt &&
              item.status !== "cancelled" &&
              (item.state === "confirmed" ||
                item.state === "walkin_reserved") && (
                <Link to={`/staff/check-ins?item=${item.id}`}>Check-in</Link>
              )}
            {item.checkedInAt && !item.checkedOutAt && (
              <>
                <Link to={`/staff/stays?item=${item.id}`}>
                  Stay and checkout
                </Link>
                <Link to={`/staff/stay-changes?item=${item.id}`}>
                  Extensions and charges
                </Link>
              </>
            )}
            {!item.checkedInAt &&
              !item.checkedOutAt &&
              item.status !== "cancelled" && (
                <>
                  {item.state === "confirmed" && (
                    <Link to={`/staff/reschedules?item=${item.id}`}>
                      Reschedule
                    </Link>
                  )}
                  <Link to={`/staff/cancellations?item=${item.id}`}>
                    Cancellation and refund
                  </Link>
                </>
              )}
            {(item.checkedOutAt || item.status === "cancelled") && (
              <Link to={`/staff/cancellations?item=${item.id}`}>
                Refund records
              </Link>
            )}
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
      {data.hallItems?.map((hall) => (
        <article
          className="my-3 rounded border border-subtle p-4"
          key={hall.id}
        >
          <h3 className="font-semibold">
            Function Hall ·{" "}
            {hall.setup === "theater" ? "Theater Type" : "Room Type"}
          </h3>
          <p className="staff-status" data-state={hall.status}>
            {readableLabel(hall.status)}
          </p>
          <p>
            {time(hall.startAt)} – {time(hall.endAt)}
          </p>
          <p>
            {hall.attendees} attendees · Booked amount{" "}
            {money(hall.totalCentavos)}
          </p>
          {hall.actualStart && <p>Event started {time(hall.actualStart)}</p>}
          <p className="mt-2 text-sm text-muted">
            Hall operations and changes apply to this event only. Other
            reservation items keep their own schedules.
          </p>
          <Link
            className="mt-3 inline-flex min-h-11 items-center text-primary underline print:hidden"
            to={`/staff/hall?item=${encodeURIComponent(hall.id)}`}
          >
            Manage Hall event, cancellation and refund
          </Link>
        </article>
      ))}
      <details className="mt-6">
        <summary className="cursor-pointer font-semibold">
          Payment and refund history
        </summary>
        <h3 className="mt-3 font-bold">Verified payments</h3>
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
            <p key={r.id ?? r.roomBookingId ?? r.hallReservationId}>
              {r.hallReservationId ? "Function Hall" : "Accommodation"} ·{" "}
              {money(r.amountCentavos)} · {r.status}
              {r.transferredAt ? ` · ${time(r.transferredAt)}` : ""}
            </p>
          ))
        ) : (
          <p>No approved refunds recorded.</p>
        )}
      </details>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Booking records
        </summary>
        <p className="mt-2">Full booking ID: {data.reservation.id}</p>
        <p>Created {time(data.reservation.createdAt)}</p>
      </details>
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
  if (item.checkedOutAt || item.status === "cancelled") return null;
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

export function StaffDashboard({
  token,
  hallEnabled = false,
}: {
  token: string;
  hallEnabled?: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, number>>();
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const [availableRooms, setAvailableRooms] = useState<number>();
  const [upcomingCheckouts, setUpcomingCheckouts] = useState<{
    count: number;
    next?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      void fetch(`${apiBase}/staff/stays`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const data = (await response.json()) as {
            serverNow: string;
            items: { checkout_at: string; checked_out_at?: string | null }[];
          };
          const upcoming = data.items
            .filter(
              (item) =>
                !item.checked_out_at &&
                Date.parse(item.checkout_at) > Date.parse(data.serverNow),
            )
            .sort(
              (a, b) => Date.parse(a.checkout_at) - Date.parse(b.checkout_at),
            );
          if (!controller.signal.aborted)
            setUpcomingCheckouts({
              count: upcoming.length,
              next: upcoming[0]?.checkout_at,
            });
        })
        .catch(() => {
          if (!controller.signal.aborted) setUpcomingCheckouts(undefined);
        });
      // The room board owns availability; readiness alone is not availability.
      void fetch(`${apiBase}/staff/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const rooms = (await response.json()) as { available_now: boolean }[];
          if (!controller.signal.aborted)
            setAvailableRooms(
              rooms.filter((room) => room.available_now).length,
            );
        })
        .catch(() => {
          if (!controller.signal.aborted) setAvailableRooms(undefined);
        });
      try {
        const response = await fetch(`${apiBase}/staff/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const next = await response.json();
        if (!controller.signal.aborted) {
          setCounts(next);
          setUpdatedAt(new Date());
          setMessage("");
        }
      } catch {
        if (!controller.signal.aborted) {
          setCounts(undefined);
          setUpdatedAt(undefined);
          setMessage(
            "Live summary unavailable. Open the individual operational queues.",
          );
        }
      }
    }
    setCounts(undefined);
    setAvailableRooms(undefined);
    setUpcomingCheckouts(undefined);
    setUpdatedAt(undefined);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [token]);
  const value = (key: string) => counts?.[key]?.toLocaleString("en-PH") ?? "—";
  return (
    <section
      className="staff-dashboard"
      aria-labelledby="staff-dashboard-heading"
    >
      <div className="staff-dashboard-intro">
        <div>
          <p className="staff-eyebrow">THE FRONT DESK</p>
          <h2 id="staff-dashboard-heading">Today at a glance</h2>
        </div>
        <div className="staff-refresh-note">
          <StaffIcon name="clock" />
          <span>
            {updatedAt
              ? `Last updated ${updatedAt.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true })}`
              : "Refreshes every 30 seconds"}
          </span>
        </div>
      </div>
      {message && (
        <p role="status" className="staff-notice">
          {message}
        </p>
      )}
      {!counts && !message && (
        <p role="status" className="staff-loading">
          Loading operational summary…
        </p>
      )}
      <dl
        aria-label="Current operational queues"
        className="staff-metrics"
        aria-busy={!counts && !message}
      >
        {[
          ["arrivals", "Arrivals today", "arrivals", "Expected room check-ins"],
          ["occupied", "Active stays", "stays", "Currently checked in"],
          [
            "paymentReviews",
            "Payment reviews",
            "payments",
            "Awaiting GCash verification",
          ],
          ["overdue", "Expired stay packages", "clock", "Requires staff review"],
          ...(hallEnabled
            ? [
                [
                  "hallArrivals",
                  "Hall events today",
                  "hall",
                  "Confirmed events scheduled today",
                ],
              ]
            : []),
        ].map(([key, label, icon, description]) => (
          <div className="staff-metric" key={key} title={description}>
            <dt>
              <span>{label}</span>
              <span
                className={`staff-metric-icon ${key === "overdue" && (counts?.overdue ?? 0) > 0 ? "is-urgent" : ""}`}
              >
                <StaffIcon name={icon} />
              </span>
            </dt>
            <dd>{value(key)}</dd>
          </div>
        ))}
        <div className="staff-metric">
          <dt>
            <Link to="/staff/stays">Upcoming checkouts</Link>
            <span className="staff-metric-icon">
              <StaffIcon name="clock" />
            </span>
          </dt>
          <dd>{upcomingCheckouts?.count ?? "—"}</dd>
          {upcomingCheckouts?.next && (
            <p>Next: {time(upcomingCheckouts.next)}</p>
          )}
        </div>
      </dl>
      <div className="staff-dashboard-columns">
        <section
          className="staff-panel staff-attention"
          aria-labelledby="staff-attention-heading"
        >
          <div className="staff-panel-heading">
            <div>
              <p className="staff-eyebrow">YOUR WORK QUEUES</p>
              <h3 id="staff-attention-heading">Needs attention</h3>
            </div>
            <span className="staff-panel-symbol">
              <StaffIcon name="today" />
            </span>
          </div>
          <nav aria-label="Front desk work queues">
            {[
              [
                "paymentReviews",
                "Review GCash payments",
                "Check the actual transaction before confirming.",
                "/staff/payments",
                "payments",
              ],
              [
                "arrivals",
                "Prepare for arrivals",
                "Assign a Ready room and record check-in.",
                "/staff/check-ins",
                "arrivals",
              ],
              [
                "overdue",
                "Review Expired stay packages",
                "Checkout and extensions need a staff action.",
                "/staff/stays",
                "clock",
              ],
            ].map(([key, label, description, to, icon]) => (
              <Link
                className="staff-queue-row"
                to={to}
                key={key}
                title={description}
              >
                <span
                  className={`staff-queue-icon ${key === "overdue" && (counts?.overdue ?? 0) > 0 ? "is-urgent" : ""}`}
                >
                  <StaffIcon name={icon} />
                </span>
                <span className="staff-queue-copy">
                  <strong>{label}</strong>
                </span>
                <span
                  className="staff-queue-count"
                  aria-label={`${label}: ${value(key)}`}
                >
                  {value(key)}
                </span>
                <StaffIcon name="arrow" />
              </Link>
            ))}
          </nav>
        </section>
        <section
          className="staff-panel staff-property"
          aria-labelledby="staff-property-heading"
        >
          <div className="staff-panel-heading">
            <div>
              <p className="staff-eyebrow">THE PROPERTY</p>
              <h3 id="staff-property-heading">Room readiness</h3>
            </div>
            <span className="staff-panel-symbol">
              <StaffIcon name="rooms" />
            </span>
          </div>
          <div className="staff-property-total">
            <strong>{availableRooms ?? "—"}</strong>
            <div>
              <span>Available now</span>
              <small>
                {availableRooms === undefined
                  ? "Availability unavailable"
                  : "Current room-board availability"}
              </small>
            </div>
          </div>
          <div className="staff-category-line">
            <span>Double Standard</span>
            <strong>10 rooms</strong>
          </div>
          <div className="staff-category-line">
            <span>Family Executive</span>
            <strong>5 rooms</strong>
          </div>
          <dl className="staff-room-states">
            <div>
              <dt>
                <span className="staff-state-dot cleaning" />
                To clean
              </dt>
              <dd>{value("needsCleaning")}</dd>
            </div>
            <div>
              <dt>
                <span className="staff-state-dot maintenance" />
                Maintenance
              </dt>
              <dd>{value("maintenance")}</dd>
            </div>
          </dl>
          <Link className="staff-outline-action" to="/staff/rooms">
            Open room board
            <StaffIcon name="arrow" />
          </Link>
          <p className="staff-property-note">
            Ready status and booking availability are checked separately.
          </p>
        </section>
      </div>
      <section
        className="staff-shortcuts"
        aria-labelledby="staff-shortcuts-heading"
      >
        <h3 id="staff-shortcuts-heading">Quick actions</h3>
        <nav aria-label="Staff shortcuts">
          {[
            [
              "/staff/reservations",
              "Find a reservation",
              "Search bookings and guest details",
              "reservations",
            ],
            [
              "/staff/stays",
              "Upcoming checkouts",
              "Check balances, extensions and checkout",
              "stays",
            ],
            ...(hallEnabled
              ? [
                  [
                    "/staff/hall",
                    "Upcoming Hall events",
                    "Schedules and event management",
                    "hall",
                  ],
                ]
              : []),
          ].map(([to, label, description, icon]) => (
            <Link key={to} to={to} title={description}>
              <StaffIcon name={icon} />
              <span>
                <strong>{label}</strong>
              </span>
              <StaffIcon name="arrow" />
            </Link>
          ))}
        </nav>
      </section>
    </section>
  );
}
