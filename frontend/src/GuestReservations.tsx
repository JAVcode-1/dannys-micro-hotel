import { GuestCancellationRequest } from "./CancellationDesk";
import { GuestRescheduleRequest } from "./RescheduleDesk";
import { useEffect, useState } from "react";
import type { GuestReservation, CancellationRow } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { hotelTime, peso } from "./BookingPlanner";
import GuestPayment from "./GuestPayment";
import GuestReviewAccess from "./GuestReviewAccess";
import { safeGuestReturnTo, useGuestSession } from "./GuestSession";

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
      <section>
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="mt-3">
          {session.access.message ??
            "Your reservations are private. Verify your email to continue."}
        </p>
        <a
          className={action}
          href={`/verify?returnTo=${encodeURIComponent(safeGuestReturnTo(path))}`}
        >
          Verify email
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
  return (
    <section aria-label="Your reservations">
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
      {visible.map((row) => (
        <article
          key={row.id}
          className="mt-5 rounded-2xl border border-subtle bg-white p-5 sm:p-7"
        >
          <h2 className="break-words text-xl font-bold">{row.primaryName}</h2>
          <p className="mt-2 text-muted">
            Created {hotelTime(row.createdAt)} · {peso(row.totalCentavos)}
          </p>
          {!reservationId ? (
            <>
              <p className="mt-2 text-sm">
                {row.items.length} room{row.items.length === 1 ? "" : "s"} ·{" "}
                {row.items
                  .map((item) => item.state.replaceAll("_", " "))
                  .join(", ")}
              </p>
              <a className={action} href={`/reservations/${row.id}`}>
                View reservation
              </a>
            </>
          ) : (
            <>
              <p className="mt-3 break-all text-sm text-muted">
                Reservation {row.id}
              </p>
              {row.financials && (
                <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-selected p-4 text-sm">
                  <dt>Net charges</dt>
                  <dd>{peso(row.financials.netChargeCentavos)}</dd>
                  <dt>Collected</dt>
                  <dd>{peso(row.financials.collectedCentavos)}</dd>
                  <dt>Balance due</dt>
                  <dd>{peso(row.financials.settlementDueCentavos)}</dd>
                  <dt>Refund due</dt>
                  <dd>{peso(row.financials.refundDueCentavos)}</dd>
                </dl>
              )}
              {row.items.map((item, index) => {
                const confirmed =
                  item.state === "confirmed" && item.status !== "cancelled";
                const cancelEligible =
                  confirmed &&
                  !item.checkedInAt &&
                  !!item.confirmationAt &&
                  Date.now() <= Date.parse(item.confirmationAt) + 3600000;
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
                    <p>
                      {hotelTime(item.startAt)} →{" "}
                      {hotelTime(item.effectiveCheckoutAt ?? item.endAt)}
                    </p>
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
                            : item.state.replaceAll("_", " ")}
                    </p>
                    {item.additionalCharges?.map((charge, i) => (
                      <p key={i}>
                        {charge.kind.replaceAll("_", " ")}:{" "}
                        {peso(charge.amountCentavos)} · Paid{" "}
                        {peso(charge.paidCentavos)} · Credits{" "}
                        {peso(charge.creditedCentavos)}
                      </p>
                    ))}
                    {cancelEligible ? (
                      <GuestCancellationRequest
                        token={token}
                        itemId={item.id}
                      />
                    ) : (
                      <p className="mt-3 text-muted">
                        {item.checkedInAt
                          ? "This room has checked in. Contact staff for stay changes."
                          : !confirmed
                            ? "Cancellation requests become available after confirmation. Contact staff for reconciliation of other states."
                            : "The one-hour free cancellation window has ended. Contact staff for review."}
                      </p>
                    )}
                    {rescheduleEligible && item.blocks ? (
                      <GuestRescheduleRequest
                        token={token}
                        itemId={item.id}
                        revision={item.scheduleRevision ?? 0}
                        startAt={item.startAt}
                        endAt={item.endAt}
                        blocks={item.blocks}
                        confirmationAt={item.confirmationAt ?? null}
                      />
                    ) : (
                      <p className="text-muted">
                        {item.pendingReschedule
                          ? "A schedule change is already awaiting staff review."
                          : "Self-service rescheduling requires a confirmed room before arrival and check-in."}
                      </p>
                    )}
                  </section>
                );
              })}
              <div className="mt-5 flex flex-wrap gap-5">
                <a className={action} href={`/reservations/${row.id}/payment`}>
                  Payment details
                </a>
                <button
                  className={action}
                  onClick={() => setReload((value) => value + 1)}
                >
                  Refresh reservation
                </button>
              </div>
              {payment && <GuestPayment token={token} reservationId={row.id} />}
              <RefundHistory token={token} reservationId={row.id} />
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
                      A public review requires a recorded completed stay within
                      the review window and no previous rating for this
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
      ))}
      {!reservationId && (
        <nav aria-label="Reservation pages" className="mt-5 flex gap-6">
          <button
            className={action}
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Previous page
          </button>
          <button
            className={action}
            disabled={visible.length < 20}
            onClick={() => setOffset(offset + 20)}
          >
            Next page
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
  return (
    <section className="mt-5">
      <h3 className="font-bold">Refund status</h3>
      {message ? (
        <p className="mt-2 text-sm text-muted">{message}</p>
      ) : rows.length ? (
        rows.map((row) => (
          <p key={row.id} className="mt-2 text-sm">
            {row.refundStatus.replaceAll("_", " ")} ·{" "}
            {peso(row.refundCentavos ?? 0)}
            {row.transferredAt ? ` · ${hotelTime(row.transferredAt)}` : ""}
          </p>
        ))
      ) : (
        <p className="mt-2 text-sm text-muted">
          No cancellation refund recorded for this reservation. Refunds require
          manual staff processing.
        </p>
      )}
    </section>
  );
}
