import type { MailAdapter, MailMessage } from "./notifications.js";

const time = (value: unknown) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Notification schedule is missing.");
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
};
const peso = (value: unknown) => {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Notification amount is invalid.");
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(cents / 100);
};
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function renderBookingMail(message: MailMessage, site: string) {
  const p = message.payload;
  const id = String(p.reservationId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Notification reservation is missing.");
  const link = new URL(`/reservations/${id}`, site).href;
  let subject: string;
  const lines = [`Danny's Micro Hotel`, `Reservation: ${id}`];
  switch (message.kind) {
    case "reservation_created":
      subject = "Your booking selections are on hold";
      lines.push("Your booking is not confirmed yet. Submit the full GCash payment reference and private screenshot before the shared deadline. Staff must verify the actual payment.");
      break;
    case "payment_submitted":
      subject = p.staffAlert ? `Payment review: ${p.reviewMinutes}-minute alert` : "We received your payment proof";
      lines.push(p.staffAlert ? "A payment submission is still awaiting actual staff verification. Review it in the staff Payments workspace; this message does not confirm payment." : "Your payment proof is awaiting staff verification. Your submitted selections remain protected during review. This is not a booking confirmation.");
      break;
    case "reservation_confirmed": {
      subject = "Your reservation is confirmed";
      lines.push("Staff have verified the full payment and confirmed your reservation.", `Confirmed: ${time(p.onlineConfirmationAt)} (Asia/Manila)`, `Total: ${peso(p.amountCentavos)}`);
      for (const item of (Array.isArray(p.items) ? p.items : []) as Record<string, unknown>[]) {
        const category = item.category === "double_standard" ? "Double Standard" : item.category === "family_executive" ? "Family Executive" : "Room";
        lines.push(`${category}: ${time(item.startAt)} to ${time(item.endAt)} (Asia/Manila) — ${peso(item.totalCentavos)}`);
        if (Array.isArray(item.packages)) lines.push(`Packages: ${(item.packages as Record<string, unknown>[]).map(pack => `${Number(pack.durationMinutes) / 60} hours`).join(" + ")}`);
      }
      for (const hall of (Array.isArray(p.hallItems) ? p.hallItems : []) as Record<string, unknown>[]) {
        lines.push(`Function Hall (${hall.setup === "theater" ? "Theater Type" : "Room Type"}): ${time(hall.startAt)} to ${time(hall.endAt)} (Asia/Manila) — ${peso(hall.originalCentavos)}`);
      }
      lines.push(`Cancellation terms: ${String(p.cancellationTerms || "Contact staff for your recorded terms.")}`, "Eligible online item cancellation ends one hour after original staff confirmation or that item's actual check-in/event start, whichever comes first. Refunds are handled manually.");
      break;
    }
    case "payment_reminder":
      subject = "Your booking payment deadline is approaching";
      lines.push("Submit your GCash reference and screenshot before the shared deadline to keep your selections. If you have already paid but cannot submit proof, contact staff; do not pay again.");
      break;
    default: throw new Error("Unsupported notification kind; no email was sent.");
  }
  if (p.proofDeadlineAt && message.kind !== "reservation_confirmed" && !p.staffAlert) lines.push(`Proof deadline: ${time(p.proofDeadlineAt)} (Asia/Manila)`);
  lines.push(p.staffAlert ? new URL("/staff/payments", site).href : link, "Private reservation access requires email verification.");
  const text = lines.join("\n\n");
  return { subject, text, html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escape(text)}</div>` };
}

export function configuredMailAdapter(): MailAdapter | null {
  const provider = process.env.MAIL_PROVIDER;
  if (!provider) return null;
  if (provider !== "resend") throw new Error("MAIL_PROVIDER must be resend for the installed notification adapter.");
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const site = process.env.MAIL_SITE_URL;
  if (!key || !from || /[\r\n]/.test(from) || !site) throw new Error("Configure RESEND_API_KEY, MAIL_FROM and MAIL_SITE_URL for notifications.");
  const origin = new URL(site);
  if (origin.username || origin.password || origin.search || origin.hash ||
    !(origin.protocol === "https:" || (origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))))
    throw new Error("MAIL_SITE_URL must be the real development website origin.");
  return {
    // Resend retains idempotency keys for 24 hours. Stop ambiguous older retries.
    idempotencyWindowMs: 23 * 3600000,
    async deliver(message) {
      const body = renderBookingMail(message, site);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `staytrack-${message.id}` },
        body: JSON.stringify({ from, to: [message.to], ...body }),
      });
      if (!response.ok) throw new Error("Notification provider did not accept delivery.");
      const result = await response.json() as { id?: string };
      if (!result.id) throw new Error("Notification provider did not acknowledge delivery.");
    },
  };
}
