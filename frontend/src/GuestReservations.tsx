import CancellationDesk, { GuestCancellationRequest } from "./CancellationDesk";
import RescheduleDesk, { GuestRescheduleRequest } from "./RescheduleDesk";
import { useEffect, useState } from "react";
import type { GuestReservation } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { hotelTime, peso } from "./BookingPlanner";
import GuestPayment from "./GuestPayment";

export default function GuestReservations({ token }: { token: string }) {
  const [rows, setRows] = useState<GuestReservation[]>([]);
  const [message, setMessage] = useState("Loading your reservations…");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/guest/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const reservations = (await response.json()) as GuestReservation[];
        setRows(reservations);
        setMessage(
          reservations.length
            ? ""
            : "No reservations found for your verified email.",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Reservation lookup is unavailable. Online booking is not open yet.",
          );
      });
    return () => controller.abort();
  }, [token]);
  return (
    <section className="mt-6" aria-label="Your reservations">
      <h2 className="text-xl font-bold">Your reservations</h2>
      {message && (
        <p role="status" className="mt-3 text-sm text-muted">
          {message}
        </p>
      )}
      {rows.map((row) => (
        <article
          key={row.id}
          className="mt-4 rounded-xl border border-subtle p-4"
        >
          <h3 className="font-bold">
            {row.primaryName} · {peso(row.totalCentavos)}
          </h3>
          {row.items.map((item, index) => (
            <div key={item.id} className="mt-3 text-sm leading-6">
              <p>
                Room {index + 1} ·{" "}
                {item.category === "double_standard"
                  ? "Double Standard"
                  : "Family Executive"}
              </p>
              <p>
                {hotelTime(item.startAt)} → {hotelTime(item.endAt)}
              </p>
              <p>
                {item.adults} adults · {item.children} children ·{" "}
                {peso(item.totalCentavos)}
              </p>
              <GuestCancellationRequest token={token} itemId={item.id} />
              {item.blocks && (
                <GuestRescheduleRequest
                  key={item.id}
                  token={token}
                  itemId={item.id}
                  revision={item.scheduleRevision ?? 0}
                  startAt={item.startAt}
                  endAt={item.endAt}
                  blocks={item.blocks}
                  confirmationAt={item.confirmationAt ?? null}
                />
              )}
              <p>
                Capacity: {item.state.replaceAll("_", " ")}. Reservation
                confirmation is unavailable in this preview.
              </p>
            </div>
          ))}
          <button
            className="mt-3 min-h-11 text-sm font-semibold text-primary"
            onClick={() => setPaymentId(row.id)}
          >
            Payment proof details
          </button>
          {paymentId === row.id && (
            <GuestPayment token={token} reservationId={row.id} />
          )}
        </article>
      ))}
      <CancellationDesk token={token} guest />
      <RescheduleDesk token={token} guest />
    </section>
  );
}
