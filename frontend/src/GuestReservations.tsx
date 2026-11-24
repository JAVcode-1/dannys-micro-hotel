import TimePartInput, { manilaClock } from "./TimePartInput";
import { GuestCancellationRequest } from "./CancellationDesk";
import { GuestRescheduleRequest } from "./RescheduleDesk";
import { Fragment, useEffect, useState } from "react";
import type {
  GuestReservation,
  CancellationRow,
  OnlineHallItem,
} from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { hotelTime, peso } from "./BookingPlanner";
import GuestPayment from "./GuestPayment";
import { notifySuccess } from "./notifications";
import GuestReviewAccess from "./GuestReviewAccess";
import { safeGuestReturnTo, useGuestSession } from "./GuestSession";

import { bookingReference, readableLabel } from "./presentation";

function bookingGroup(row: GuestReservation) {
  const ongoing =
    row.items.some((item) => item.checkedInAt && !item.checkedOutAt) ||
    (row.hall?.actualStart &&
      !["completed", "cancelled"].includes(row.hall.status));
  if (ongoing) return "Ongoing";
  const roomsEnded = row.items.every(
    (item) =>
      item.checkedOutAt ||
      ["cancelled", "expired", "rejected", "released"].includes(
        item.status ?? "",
      ) ||
      ["cancelled", "expired", "rejected", "released"].includes(item.state),
  );
  const hallEnded =
    !row.hall ||
    ["completed", "cancelled", "expired", "rejected"].includes(row.hall.status);
  return roomsEnded && hallEnded ? "Past" : "Upcoming";
}

const action =
  "inline-flex min-h-11 items-center font-semibold text-primary disabled:opacity-50";
export function GuestReservationsPage({
  reviewsEnabled = false,
}: {
  reviewsEnabled?: boolean;
}) {
  return <GuestReservationPage reviewsEnabled={reviewsEnabled} />;
}
export function GuestReservationPage({
  reservationId,
  payment = false,
  reviewsEnabled = false,
}: {
  reservationId?: string;
  payment?: boolean;
  reviewsEnabled?: boolean;
}) {
  const session = useGuestSession();
  if (!session || session.access.status === "loading")
    return <p role="status">Restoring your guest session…</p>;
  if (session.access.status !== "authenticated") {
    const path = reservationId
      ? `/reservations/${reservationId}${payment ? "/payment" : ""}`
      : "/reservations";
    return (
      <section className="guest-verification-prompt">
        <h1 className="text-2xl font-bold">Your bookings, all in one place.</h1>
        <p className="mt-3">
          {session.access.message ??
            "Ready to check on your stay? Verify your email with a one-time code to view your private booking details."}
        </p>
        <a
          className={`mt-5 ${action}`}
          href={`/verify?returnTo=${encodeURIComponent(safeGuestReturnTo(path))}`}
        >
          Continue with email
        </a>
      </section>
    );
  }
  return (
    <GuestReservations
      key={session.access.id}
      token={session.access.token}
      reservationId={reservationId}
      payment={payment}
      reviewsEnabled={reviewsEnabled}
    />
  );
}

export default function GuestReservations({
  token,
  reservationId,
  payment = false,
  reviewsEnabled = false,
}: {
  token: string;
  reservationId?: string;
  payment?: boolean;
  reviewsEnabled?: boolean;
}) {
  const [rows, setRows] = useState<GuestReservation[]>([]);
  const [loadedToken, setLoadedToken] = useState("");
  const [message, setMessage] = useState("Loading your reservations…");
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [review, setReview] = useState<"review" | "feedback" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setLoadedToken("");
    setMessage("Loading your reservations…");
    const path = reservationId
      ? `/guest/reservations/${encodeURIComponent(reservationId)}`
      : `/guest/reservations?limit=20&offset=${offset}`;
    void fetch(apiBase + path, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "Reservation not found."
              : "Reservation lookup is unavailable. Please retry.",
          );
        const result = (await response.json()) as
          GuestReservation | GuestReservation[];
        const list = Array.isArray(result) ? result : [result];
        if (!controller.signal.aborted) {
          setRows(list);
          setLoadedToken(token);
          setMessage(
            list.length
              ? ""
              : reservationId
                ? "Reservation not found."
                : "No reservations found for your verified identity.",
          );
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error
              ? error.message
              : "Reservation lookup unavailable.",
          );
      });
    return () => controller.abort();
  }, [token, reservationId, offset, reload]);
  const visible = loadedToken === token ? rows : [];
  const ordered = reservationId
    ? visible
    : ["Ongoing", "Upcoming", "Past"].flatMap((group) =>
        visible.filter((row) => bookingGroup(row) === group),
      );
  return (
    <section className="guest-reservations" aria-label="Your reservations">
      <p className="guest-eyebrow">Your time at Danny’s</p>
      <h1 className="text-2xl font-bold">
        {reservationId ? "Reservation details" : "Your reservations"}
      </h1>
      {reservationId && (
        <a href="/reservations" className={action}>
          ← All reservations
        </a>
      )}
      {message && (
        <p role="status" className="mt-4 text-muted">
          {message}
        </p>
      )}
      {ordered.map((row, rowIndex) => (
        <Fragment key={row.id}>
          {!reservationId &&
            (rowIndex === 0 ||
              bookingGroup(ordered[rowIndex - 1]) !== bookingGroup(row)) && (
              <h2 className="mt-6 text-lg font-bold">{bookingGroup(row)}</h2>
            )}
          <article
            key={row.id}
            className="guest-reservation-card mt-5 rounded-2xl border border-subtle bg-white p-5 sm:p-7"
          >
            <p className="text-sm font-semibold text-primary">
              {bookingReference(row.id)}
            </p>
            <h2 className="mt-1 break-words text-xl font-bold">
              {row.primaryName}
            </h2>
            <p className="mt-2 text-muted">
              Total amount:{" "}
              {peso(row.financials?.netChargeCentavos ?? row.totalCentavos)}
            </p>
            {!reservationId ? (
              <>
                <p className="mt-2 text-sm">
                  {row.items.length > 0
                    ? `${row.items.length} room${row.items.length === 1 ? "" : "s"}`
                    : ""}
                  {row.hall
                    ? `${row.items.length ? " + " : ""}Function Hall`
                    : ""}{" "}
                  ·{" "}
                  {row.items
                    .map((item) =>
                      item.checkedOutAt
                        ? "Checked out"
                        : item.checkedInAt
                          ? "Checked in"
                          : readableLabel(
                              item.status === "cancelled"
                                ? item.status
                                : item.state,
                            ),
                    )
                    .join(", ")}
                </p>
                {row.items.map((item, index) => (
                  <p key={item.id} className="mt-2 text-sm text-muted">
                    Room {index + 1}: {hotelTime(item.startAt)} to{" "}
                    {hotelTime(item.effectiveCheckoutAt ?? item.endAt)}
                  </p>
                ))}
                {row.hall && (
                  <p className="mt-2 text-sm text-muted">
                    Function Hall: {hotelTime(row.hall.startAt)} to{" "}
                    {hotelTime(row.hall.endAt)} -{" "}
                    {readableLabel(row.hall.status)}
                  </p>
                )}
                <a className={action} href={`/reservations/${row.id}`}>
                  View booking
                </a>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold text-primary">
                  {row.hall
                    ? row.items.length
                      ? "Accommodation + Function Hall"
                      : "Function Hall"
                    : "Accommodation"}
                </p>
                {row.financials && (
                  <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-selected p-4 text-sm">
                    <dt>Total amount</dt>
                    <dd>{peso(row.financials.netChargeCentavos)}</dd>
                    <dt>Amount paid</dt>
                    <dd>{peso(row.financials.collectedCentavos)}</dd>
                    <dt>Remaining balance</dt>
                    <dd>{peso(row.financials.settlementDueCentavos)}</dd>
                    {row.financials.refundDueCentavos > 0 && (
                      <>
                        <dt>Refund due</dt>
                        <dd>{peso(row.financials.refundDueCentavos)}</dd>
                      </>
                    )}
                  </dl>
                )}
                {row.items.map((item, index) => {
                  const confirmed =
                    item.state === "confirmed" && item.status !== "cancelled";
                  const cancellationDeadline = item.confirmationAt
                    ? Date.parse(item.confirmationAt) + 3600000
                    : null;
                  const cancelEligible =
                    confirmed &&
                    !item.checkedInAt &&
                    cancellationDeadline !== null &&
                    Date.now() <= cancellationDeadline;
                  const rescheduleEligible =
                    confirmed &&
                    !item.checkedInAt &&
                    !item.pendingReschedule &&
                    !!item.blocks?.length;
                  return (
                    <section
                      key={item.id}
                      className="mt-5 border-t border-subtle pt-5 text-sm leading-6"
                    >
                      <h3 className="text-base font-bold">
                        Room {index + 1} ·{" "}
                        {item.category === "double_standard"
                          ? "Double Standard"
                          : "Family Executive"}
                      </h3>
                      <p>Scheduled arrival: {hotelTime(item.startAt)}</p>
                      <p>
                        Departure:{" "}
                        {hotelTime(item.effectiveCheckoutAt ?? item.endAt)}
                      </p>
                      {item.checkedInAt && (
                        <p>Checked in: {hotelTime(item.checkedInAt)}</p>
                      )}
                      {item.checkedOutAt && (
                        <p>Checked out: {hotelTime(item.checkedOutAt)}</p>
                      )}
                      {item.effectiveCheckoutAt &&
                        item.effectiveCheckoutAt !== item.endAt && (
                          <p className="text-muted">
                            Booked departure: {hotelTime(item.endAt)}
                          </p>
                        )}
                      {item.originalCheckoutAt &&
                        item.originalCheckoutAt !== item.endAt && (
                          <p className="text-muted">
                            Departure recorded at check-in:{" "}
                            {hotelTime(item.originalCheckoutAt)}
                          </p>
                        )}
                      <p>
                        {item.adults} adults · {item.children} children ·{" "}
                        {peso(item.totalCentavos)}
                      </p>
                      <p>
                        Status:{" "}
                        {item.checkedOutAt
                          ? "Checked out"
                          : item.checkedInAt
                            ? "Checked in"
                            : item.status === "cancelled"
                              ? "Cancelled"
                              : readableLabel(item.state)}
                      </p>
                      {!!item.additionalCharges?.length && (
                        <details className="mt-3">
                          <summary className="cursor-pointer font-semibold">
                            Additional charges
                          </summary>
                          {item.additionalCharges.map((charge, i) => (
                            <p key={i}>
                              {readableLabel(charge.kind)}:{" "}
                              {peso(charge.amountCentavos)} · Paid{" "}
                              {peso(charge.paidCentavos)} · Credits{" "}
                              {peso(charge.creditedCentavos)}
                            </p>
                          ))}
                        </details>
                      )}
                      {cancelEligible ? (
                        <GuestCancellationRequest
                          token={token}
                          itemId={item.id}
                        />
                      ) : null}
                      {!item.checkedOutAt && item.status !== "cancelled" && (
                        <details className="mt-3 text-muted">
                          <summary className="cursor-pointer">
                            Cancellation policy
                          </summary>
                          {confirmed && cancellationDeadline !== null && (
                            <p>
                              Original free-cancellation deadline:{" "}
                              {hotelTime(new Date(cancellationDeadline).toISOString())}.
                              A schedule change keeps this deadline. Free cancellation
                              ends sooner if you check in before it.
                            </p>
                          )}
                          {!cancelEligible && (
                            <p>
                              {item.checkedInAt
                                ? "This room has checked in. Contact staff for stay changes."
                                : !confirmed
                                  ? "Cancellation requests become available after confirmation. Contact staff for reconciliation of other states."
                                  : "The one-hour free cancellation window has ended. Contact staff for review."}
                            </p>
                          )}
                        </details>
                      )}
                      {rescheduleEligible && item.blocks ? (
                        <GuestRescheduleRequest
                          token={token}
                          itemId={item.id}
                          revision={item.scheduleRevision ?? 0}
                          startAt={item.startAt}
                          blocks={item.blocks}
                        />
                      ) : item.pendingReschedule ? (
                        <div role="status" className="mt-3 rounded-lg bg-selected p-3">
                          <p className="font-semibold">Awaiting staff approval</p>
                          <p>Your current booking stays active while staff check availability.</p>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
                {row.hall && (
                  <GuestHallItem
                    hall={row.hall}
                    token={token}
                    onRefresh={() => setReload((value) => value + 1)}
                  />
                )}
                <div className="mt-5 flex flex-wrap gap-5">
                  <a
                    className={action}
                    href={`/reservations/${row.id}/payment`}
                  >
                    View payment
                  </a>
                  <button
                    className={action}
                    onClick={() => setReload((value) => value + 1)}
                  >
                    Refresh booking
                  </button>
                </div>
                {payment && (
                  <GuestPayment token={token} reservationId={row.id} />
                )}
                <details className="mt-5 text-sm">
                  <summary className="cursor-pointer font-semibold">
                    Booking records and refund history
                  </summary>
                  <p className="mt-2 break-all">Full booking ID: {row.id}</p>
                  <p>Created {hotelTime(row.createdAt)}</p>
                  <RefundHistory token={token} reservationId={row.id} />
                </details>
                {reviewsEnabled && (
                  <section className="mt-5 border-t border-subtle pt-4">
                    {row.reviewEligible ? (
                      <button
                        className={action}
                        onClick={() => setReview("review")}
                      >
                        Review your completed stay
                      </button>
                    ) : (
                      <p className="text-sm text-muted">
                        A public review requires a recorded completed stay
                        within the review window and no previous rating for this
                        reservation.
                      </p>
                    )}
                    {row.items.some(
                      (item) => item.checkedInAt && item.checkedOutAt,
                    ) && (
                      <button
                        className={`${action} ml-4`}
                        onClick={() => setReview("feedback")}
                      >
                        Send private feedback
                      </button>
                    )}
                    {review && (
                      <GuestReviewAccess
                        key={`${row.id}:${review}`}
                        token={token}
                        reservation={row.id}
                        initial={review}
                      />
                    )}
                  </section>
                )}
              </>
            )}
          </article>
        </Fragment>
      ))}
      {!reservationId && (
        <p className="mt-4 text-sm text-muted">
          Grouped within this page. Use Next for older bookings.
        </p>
      )}
      {!reservationId && (
        <nav aria-label="Reservation pages" className="mt-5 flex gap-6">
          <button
            className={action}
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Previous
          </button>
          <button
            className={action}
            disabled={visible.length < 20}
            onClick={() => setOffset(offset + 20)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
function RefundHistory({
  token,
  reservationId,
}: {
  token: string;
  reservationId: string;
}) {
  const [rows, setRows] = useState<CancellationRow[]>([]);
  const [message, setMessage] = useState("Loading refund status…");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `${apiBase}/guest/cancellations?reservationId=${encodeURIComponent(reservationId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { items: CancellationRow[] };
        if (!controller.signal.aborted) {
          setRows(
            (data.items ?? []).filter(
              (row) => row.reservationId === reservationId,
            ),
          );
          setMessage("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Refund status is unavailable. Contact staff before assuming a transfer has completed.",
          );
      });
    return () => controller.abort();
  }, [token, reservationId]);
  if (!message && rows.length === 0) return null;
  return (
    <section className="mt-5">
      <h3 className="font-bold">Accommodation refunds</h3>
      {message ? (
        <p className="mt-2 text-sm text-muted">{message}</p>
      ) : rows.length ? (
        rows.map((row) => (
          <p key={row.id} className="mt-2 text-sm">
            {readableLabel(row.refundStatus)} · {peso(row.refundCentavos ?? 0)}
            {row.transferredAt ? ` · ${hotelTime(row.transferredAt)}` : ""}
          </p>
        ))
      ) : (
        <p className="mt-2 text-sm text-muted">
          No accommodation cancellation refund recorded. Refunds require manual
          staff processing.
        </p>
      )}
    </section>
  );
}

function GuestHallItem({
  hall,
  token,
  onRefresh,
}: {
  hall: OnlineHallItem;
  token: string;
  onRefresh(): void;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState<{ body: string; key: string } | null>(
    null,
  );
  const confirmed = hall.status === "confirmed" && hall.state === "confirmed";
  const cancelEligible =
    confirmed &&
    !hall.actualStart &&
    !!hall.confirmationAt &&
    Date.now() < Date.parse(hall.confirmationAt) + 3600000;
  async function cancel(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const body = JSON.stringify({ reason });
    const key =
      retry?.body === body ? retry.key : globalThis.crypto.randomUUID();
    setRetry({ body, key });
    try {
      const response = await fetch(
        `${apiBase}/guest/hall/${encodeURIComponent(hall.id)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason, requestKey: key }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Cancellation could not be recorded.");
      notifySuccess(
        "Hall cancellation recorded. Eligible refunds are processed manually.",
      );
      setMessage(
        "Hall cancellation recorded. Eligible refunds are transferred manually by staff; your other reservation items are unchanged.",
      );
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Cancellation unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 border-t border-subtle pt-5 text-sm leading-6">
      <h3 className="text-base font-bold">
        Function Hall ·{" "}
        {hall.setup === "theater" ? "Theater Type" : "Room Type"}
      </h3>
      <p>
        {hotelTime(hall.startAt)} → {hotelTime(hall.endAt)}
      </p>
      <p>
        {hall.attendees} attendees · {peso(hall.totalCentavos)}
      </p>
      <p>Status: {readableLabel(hall.status)}</p>
      {hall.actualStart && <p>Event started: {hotelTime(hall.actualStart)}</p>}
      {(!!hall.refundDueCentavos || !!hall.refundedCentavos) && (
        <p>
          Hall refund due: {peso(hall.refundDueCentavos ?? 0)} · Refunded
          manually: {peso(hall.refundedCentavos ?? 0)}
        </p>
      )}
      {confirmed && <GuestHallChange hall={hall} token={token} />}
      {cancelEligible ? (
        <form
          onSubmit={(event) => void cancel(event)}
          className="mt-4 space-y-3"
        >
          <p>
            Free cancellation ends one hour after payment confirmation or when
            this event actually starts, whichever comes first. Refunds are
            processed manually.
          </p>
          <label className="block">
            Cancellation reason
            <input
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-subtle px-3"
            />
          </label>
          <button disabled={busy} className={action}>
            {busy ? "Cancelling..." : "Cancel hall"}
          </button>
        </form>
      ) : !["completed", "cancelled", "expired", "rejected"].includes(
          hall.status,
        ) ? (
        <details className="mt-3 text-muted">
          <summary className="cursor-pointer">
            Changes and cancellation policy
          </summary>
          <p>
            {hall.actualStart
              ? "This event has started."
              : confirmed
                ? "The one-hour free cancellation window has ended."
                : "Free cancellation is available after confirmation and before the event starts."}{" "}
            Contact staff for review, independent rescheduling or an extension.
            Hall extensions require full payment of the additional cost before
            activation.
          </p>
        </details>
      ) : null}
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
    </section>
  );
}

function GuestHallChange({
  hall,
  token,
}: {
  hall: OnlineHallItem;
  token: string;
}) {
  const local = new Date(Date.parse(hall.startAt) + 480 * 60000).toISOString();
  const [kind, setKind] = useState(hall.actualStart ? "extend" : "reschedule");
  const [date, setDate] = useState(local.slice(0, 10));
  const [hour, setHour] = useState(
    String(Number(local.slice(11, 13)) % 12 || 12),
  );
  const [minute, setMinute] = useState(local.slice(14, 16));
  const [period, setPeriod] = useState(
    Number(local.slice(11, 13)) >= 12 ? "PM" : "AM",
  );
  const [hours, setHours] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState<{ body: string; key: string } | null>(
    null,
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const payload =
      kind === "extend"
        ? { kind, hours, reason }
        : {
            kind,
            reason,
            setup: hall.setup,
            attendees: hall.attendees,
            minutes: Math.round(
              (Date.parse(hall.endAt) - Date.parse(hall.startAt)) / 60000,
            ),
            start: `${date}T${manilaClock(hour, minute, period)}`,
          };
    const body = JSON.stringify(payload);
    const key =
      retry?.body === body ? retry.key : globalThis.crypto.randomUUID();
    setRetry({ body, key });
    try {
      const response = await fetch(
        `${apiBase}/guest/hall/${encodeURIComponent(hall.id)}/change`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, requestKey: key }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Request unavailable.");
      notifySuccess("Schedule change requested. Awaiting staff approval.");
      setMessage(
        "Request sent for staff approval. Your booked schedule stays unchanged until approved. Hall extensions require full payment of the additional cost.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Request unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-1 min-h-11 w-full rounded-xl border border-subtle bg-white px-3";
  return (
    <details className="mt-4">
      <summary className="min-h-11 cursor-pointer font-semibold text-primary">
        Change hall booking
      </summary>
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <fieldset disabled={busy} className="space-y-3">
          <label className="block">
            Change type
            <select
              className={input}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {!hall.actualStart && (
                <option value="reschedule">Reschedule event</option>
              )}
              <option value="extend">Extend event</option>
            </select>
          </label>
          {kind === "extend" ? (
            <label className="block">
              Additional full hours
              <input
                required
                type="number"
                min="1"
                max="24"
                step="1"
                className={input}
                value={hours}
                onChange={(e) => setHours(e.target.valueAsNumber)}
              />
            </label>
          ) : (
            <>
              <label className="block">
                Requested event date
                <input
                  required
                  type="date"
                  className={input}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  Event hour
                  <TimePartInput
                    part="hour"
                    label="Event hour"
                    value={hour}
                    onChange={setHour}
                    className={input}
                  />
                </div>
                <div>
                  Event minute
                  <TimePartInput
                    part="minute"
                    label="Event minute"
                    value={minute}
                    onChange={setMinute}
                    className={input}
                  />
                </div>
                <label>
                  Event AM/PM
                  <select
                    className={input}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option>AM</option>
                    <option>PM</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <label className="block">
            Change reason
            <input
              required
              maxLength={1000}
              className={input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="text-muted">
            Staff check availability and payment before approval. Other
            reservation items remain unchanged.
          </p>
          <button className={action}>
            {busy ? "Sending..." : "Send request"}
          </button>
        </fieldset>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
