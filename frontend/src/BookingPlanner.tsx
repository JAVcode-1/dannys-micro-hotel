import { useEffect, useState } from "react";
import { notifySuccess } from "./notifications";
import type { FormEvent } from "react";
import type { BookingQuote } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { useGuestSession } from "./GuestSession";

type Draft = {
  id: number;
  category: string;
  date: string;
  hour: string;
  minute: string;
  period: string;
  blocks: number[];
  adults: number;
  children: number;
  extraBed: boolean;
};
type HallDraft = {
  setup: "theater" | "room";
  date: string;
  hour: string;
  minute: string;
  period: "AM" | "PM";
  minutes: number;
  attendees: number;
  requests: string;
};
const hallDraftKey = "staytrack.hall-selections.v1";
const newHall = (): HallDraft => ({
  setup:
    new URLSearchParams(window.location.search).get("setup") === "room"
      ? "room"
      : "theater",
  date: "",
  hour: "8",
  minute: "00",
  period: "AM",
  minutes: 180,
  attendees: 1,
  requests: "",
});
function restoreHall(): HallDraft | null {
  if (new URLSearchParams(window.location.search).get("service") === "hall")
    return newHall();
  try {
    const saved = JSON.parse(
      window.sessionStorage.getItem(hallDraftKey) ?? "null",
    ) as HallDraft | null;
    if (
      saved &&
      ["theater", "room"].includes(saved.setup) &&
      typeof saved.date === "string" &&
      typeof saved.hour === "string" &&
      typeof saved.minute === "string" &&
      ["AM", "PM"].includes(saved.period) &&
      Number.isInteger(saved.minutes) &&
      Number.isInteger(saved.attendees) &&
      typeof saved.requests === "string"
    )
      return saved;
  } catch {
    /* Ignore invalid local drafts. */
  }
  return new URLSearchParams(window.location.search).get("service") === "hall"
    ? newHall()
    : null;
}
const hallInput = (hall: HallDraft) => ({
  setup: hall.setup,
  start: `${hall.date}T${String((Number(hall.hour) % 12) + (hall.period === "PM" ? 12 : 0)).padStart(2, "0")}:${hall.minute}`,
  minutes: hall.minutes,
  attendees: hall.attendees,
  requests: hall.requests,
});
type Rate = {
  code: string;
  name: string;
  duration_minutes: number;
  price_centavos: number;
};
const newRoom = (id: number, rates: Rate[] = []): Draft => {
  const rate =
    rates.find(
      (rate) =>
        rate.code === "double_standard" && rate.duration_minutes === 180,
    ) ?? rates[0];
  return {
    id,
    category: rate?.code ?? "double_standard",
    date: "",
    hour: "2",
    minute: "00",
    period: "PM",
    blocks: [rate?.duration_minutes ?? 180],
    adults: 2,
    children: 0,
    extraBed: false,
  };
};
export const peso = (centavos: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    centavos / 100,
  );
export const hotelTime = (instant: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  }).format(new Date(instant));
const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-subtle bg-white px-3 text-base focus:outline-2 focus:outline-primary";
const secondary =
  "min-h-11 rounded-xl border border-subtle px-4 font-semibold text-primary disabled:opacity-50";
const draftKey = "staytrack.booking-selections.v1";
const commandKey = "staytrack.booking-command.v1";
export async function bookingRequestKey(
  identity: string,
  body: string,
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  const fingerprint = Array.from(
    new Uint8Array(
      await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(identity + ":" + body),
      ),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  try {
    const prior = JSON.parse(storage.getItem(commandKey) ?? "null") as {
      fingerprint?: string;
      key?: string;
    } | null;
    if (
      prior?.fingerprint === fingerprint &&
      typeof prior.key === "string" &&
      /^[A-Za-z0-9_-]{16,100}$/.test(prior.key)
    )
      return prior.key;
  } catch {
    /* Invalid local retry metadata is replaced. */
  }
  const key = globalThis.crypto.randomUUID();
  try {
    storage.setItem(commandKey, JSON.stringify({ fingerprint, key }));
  } catch {
    /* Current-page retry remains available without storage. */
  }
  return key;
}
function restoreDraft(): Draft[] {
  if (new URLSearchParams(window.location.search).get("service") === "hall")
    return [];
  try {
    const saved: unknown = JSON.parse(
      window.sessionStorage.getItem(draftKey) ?? "null",
    );
    if (
      Array.isArray(saved) &&
      saved.length >= 0 &&
      saved.length <= 15 &&
      saved.every(
        (x: Draft) =>
          x &&
          Number.isInteger(x.id) &&
          ["double_standard", "family_executive"].includes(x.category) &&
          typeof x.date === "string" &&
          typeof x.hour === "string" &&
          typeof x.minute === "string" &&
          ["AM", "PM"].includes(x.period) &&
          Array.isArray(x.blocks) &&
          x.blocks.length > 0 &&
          x.blocks.length <= 30 &&
          x.blocks.every(Number.isInteger) &&
          Number.isInteger(x.adults) &&
          Number.isInteger(x.children) &&
          typeof x.extraBed === "boolean",
      )
    )
      return saved as Draft[];
  } catch {
    /* Storage may be unavailable in a private browser. */
  }
  return new URLSearchParams(window.location.search).get("service") === "hall"
    ? []
    : [newRoom(1)];
}
const toInputs = (items: Draft[]) =>
  items.map((item) => ({
    category: item.category,
    startAt: `${item.date}T${String((Number(item.hour) % 12) + (item.period === "PM" ? 12 : 0)).padStart(2, "0")}:${item.minute}:00+08:00`,
    blocks: item.blocks,
    adults: item.adults,
    children: item.children,
    extraBed: item.extraBed,
  }));

export default function BookingPlanner({
  hallEnabled = false,
}: {
  hallEnabled?: boolean;
}) {
  const guest = useGuestSession();
  const [items, setItems] = useState<Draft[]>(restoreDraft);
  const [hall, setHall] = useState<HallDraft | null>(() =>
    hallEnabled ? restoreHall() : null,
  );
  const [rates, setRates] = useState<Rate[]>([]);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [policy, setPolicy] = useState<{
    version: string;
    text: string;
    pendingOwnerApproval?: boolean;
  } | null>(null);
  const [primaryName, setPrimaryName] = useState("");
  const [phone, setPhone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [policiesExpanded, setPoliciesExpanded] = useState(true);
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [request, setRequest] = useState<{ body: string; key: string } | null>(
    null,
  );
  useEffect(() => {
    try {
      window.sessionStorage.setItem(hallDraftKey, JSON.stringify(hall));
    } catch {
      /* Continue without draft recovery. */
    }
  }, [hall]);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify(items));
    } catch {
      /* Continue without draft recovery. */
    }
  }, [items]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/guest/booking-status`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const status = (await response.json()) as {
          enabled?: boolean;
          bookingEnabled?: boolean;
          policy?: typeof policy;
        };
        if (!controller.signal.aborted) {
          setBookingEnabled(
            status.enabled === true || status.bookingEnabled === true,
          );
          setPolicy(status.policy ?? null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const category = new URLSearchParams(window.location.search).get(
      "category",
    );
    void fetch(`${apiBase}/catalog`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const currentRates = (await response.json()) as Rate[];
        setRates(currentRates);
        if (!currentRates.length) {
          setMessage("No stay lengths are currently available.");
          return;
        }
        const preferredRate = currentRates.reduce<Rate | undefined>(
          (preferred, rate) =>
            rate.code === category &&
            (!preferred || rate.duration_minutes < preferred.duration_minutes)
              ? rate
              : preferred,
          undefined,
        );
        setItems((current) =>
          current.map((item) => {
            const rate =
              (item.id === 1 ? preferredRate : undefined) ??
              currentRates.find(
                (row) =>
                  row.code === item.category &&
                  row.duration_minutes === item.blocks[0],
              ) ??
              currentRates[0];
            return {
              ...item,
              category: rate.code,
              blocks:
                (!preferredRate || item.category === preferredRate.code) &&
                item.blocks.every((block) =>
                  currentRates.some(
                    (row) =>
                      row.code === rate.code && row.duration_minutes === block,
                  ),
                )
                  ? item.blocks
                  : [rate.duration_minutes],
              extraBed: rate.code === "family_executive" && item.extraBed,
            };
          }),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Current stay lengths are unavailable. Please try again later.",
          );
      });
    return () => controller.abort();
  }, []);
  function update(id: number, patch: Partial<Draft>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    setQuote(null);
    setAvailability(null);
    setMessage("");
  }
  function updateHall(patch: Partial<HallDraft>) {
    setHall((current) => (current ? { ...current, ...patch } : current));
    setQuote(null);
    setAvailability(null);
    setMessage("");
  }
  const selection = () => ({
    items: toInputs(items),
    ...(hall ? { hall: hallInput(hall) } : {}),
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setQuote(null);
    setAvailability(null);
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/guest/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection()),
      });
      const data = (await response.json()) as BookingQuote & { error?: string };
      if (!response.ok)
        throw new Error(data.error || "Price unavailable. Please try again.");
      setQuote(data);
      notifySuccess("Booking price updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Price unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function checkAvailability() {
    setBusy(true);
    setMessage("");
    setAvailability(null);
    try {
      const response = await fetch(`${apiBase}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection()),
      });
      const data = (await response.json()) as {
        available: boolean;
        quote: BookingQuote;
        reason?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Availability is unavailable.");
      setQuote(data.quote);
      setAvailability(data.available);
      if (data.available) notifySuccess("Your selected schedules are available. Continue to reserve them.");
      setMessage(
        data.available
          ? "Available now. Capacity is reserved only when your hold succeeds."
          : data.reason ?? "These schedules are unavailable. Choose another time or category.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Availability unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function hold(event: FormEvent) {
    event.preventDefault();
    if (
      !quote ||
      !policy ||
      guest?.access.status !== "authenticated" ||
      !acknowledged ||
      !bookingEnabled
    )
      return;
    setBusy(true);
    setMessage("");
    const body = JSON.stringify({
      primaryName,
      ...selection(),
      contact: {
        phone,
        policyVersion: policy.version,
        policyAcknowledged: true,
      },
      expectedTotalCentavos: quote.totalCentavos,
    });
    try {
      const key =
        request?.body === body
          ? request.key
          : await bookingRequestKey(
              guest.access.id,
              body,
              window.sessionStorage,
            );
      setRequest({ body, key });
      const response = await fetch(`${apiBase}/guest/reservations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${guest.access.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(JSON.parse(body) as Record<string, unknown>),
          requestKey: key,
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id)
        throw new Error(
          result.error ??
            "Booking unavailable. Retry the same request to recover its result.",
        );
      window.sessionStorage.removeItem(draftKey);
      window.sessionStorage.removeItem(hallDraftKey);
      window.sessionStorage.removeItem(commandKey);
      notifySuccess("Booking held. Submit payment proof before the deadline; staff confirmation is still required.", true);
      window.location.assign(
        `/reservations/${encodeURIComponent(result.id)}/payment`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Booking unavailable. Retry to recover your result.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="booking-planner text-main">
      <div className="mx-auto max-w-6xl">
        <div className="booking-intro mb-9 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
            Plan your stay
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Together, on your own time.
          </h1>
          <p className="mt-4 leading-7 text-muted">
            Choose rooms, the Function Hall, or both. Each item has its own
            schedule. All times are Philippine time; all selected items share
            one payment.
          </p>
          <p className="booking-notice mt-2 text-sm text-muted">
            {bookingEnabled
              ? "Isolated development booking. Do not send real money."
              : "Online booking is currently closed."}
          </p>
        </div>
        <div className="booking-columns grid items-start gap-8 lg:grid-cols-[1fr_320px]">
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy} className="space-y-6 disabled:opacity-70">
              <legend className="sr-only">Reservation items</legend>
              {items.map((item, index) => (
                <section
                  key={item.id}
                  aria-label={`Room ${index + 1}`}
                  className="booking-item rounded-2xl border border-subtle bg-white p-5 sm:p-7"
                  data-kind="room"
                >
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">
                      <span className="booking-item-number mr-3 text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      Room {index + 1}
                    </h2>
                    {(items.length > 1 || hall) && (
                      <button
                        type="button"
                        className="min-h-11 text-sm font-semibold text-primary"
                        onClick={() => {
                          setItems((current) =>
                            current.filter((room) => room.id !== item.id),
                          );
                          setQuote(null);
                          setAvailability(null);
                        }}
                      >
                        Remove room
                      </button>
                    )}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="font-medium">
                      Room type
                      <select
                        className={inputClass}
                        value={item.category}
                        onChange={(event) => {
                          const category = event.target.value;
                          update(item.id, {
                            category,
                            blocks: [
                              rates.find((rate) => rate.code === category)!
                                .duration_minutes,
                            ],
                            extraBed: false,
                          });
                        }}
                      >
                        {["double_standard", "family_executive"]
                          .filter((code) =>
                            rates.some((rate) => rate.code === code),
                          )
                          .map((code) => (
                            <option key={code} value={code}>
                              {rates.find((rate) => rate.code === code)?.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="font-medium">
                      Arrival date
                      <input
                        type="date"
                        required
                        className={inputClass}
                        value={item.date}
                        onChange={(event) =>
                          update(item.id, { date: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <fieldset className="mt-5">
                    <legend className="font-medium">Arrival time</legend>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <label className="text-sm text-muted">
                        Hour
                        <select
                          className={inputClass}
                          value={item.hour}
                          onChange={(event) =>
                            update(item.id, { hour: event.target.value })
                          }
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm text-muted">
                        Minute
                        <select
                          className={inputClass}
                          value={item.minute}
                          onChange={(event) =>
                            update(item.id, { minute: event.target.value })
                          }
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <option key={i}>
                              {String(i).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm text-muted">
                        AM/PM
                        <select
                          className={inputClass}
                          value={item.period}
                          onChange={(event) =>
                            update(item.id, { period: event.target.value })
                          }
                        >
                          <option>AM</option>
                          <option>PM</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>
                  <div className="mt-6 space-y-3">
                    {item.blocks.map((block, blockIndex) => (
                      <div key={blockIndex} className="flex items-end gap-3">
                        <label className="min-w-0 flex-1 font-medium">
                          {blockIndex === 0
                            ? "How long will you stay?"
                            : `More time ${blockIndex}`}
                          <select
                            className={inputClass}
                            value={block}
                            onChange={(event) =>
                              update(item.id, {
                                blocks: item.blocks.map((b, i) =>
                                  i === blockIndex
                                    ? Number(event.target.value)
                                    : b,
                                ),
                              })
                            }
                          >
                            {rates
                              .filter((rate) => rate.code === item.category)
                              .map((rate) => (
                                <option
                                  key={rate.duration_minutes}
                                  value={rate.duration_minutes}
                                >
                                  {rate.duration_minutes / 60} hours ·{" "}
                                  {peso(rate.price_centavos)}
                                </option>
                              ))}
                          </select>
                        </label>
                        {item.blocks.length > 1 && (
                          <button
                            type="button"
                            className={secondary}
                            aria-label={`Remove extra time ${blockIndex} from room ${index + 1}`}
                            onClick={() =>
                              update(item.id, {
                                blocks: item.blocks.filter(
                                  (_, i) => i !== blockIndex,
                                ),
                              })
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={item.blocks.length >= 30}
                      className="min-h-11 font-semibold text-primary"
                      onClick={() =>
                        update(item.id, {
                          blocks: [
                            ...item.blocks,
                            item.blocks[item.blocks.length - 1],
                          ],
                        })
                      }
                    >
                      + Add time
                    </button>
                    <p className="text-sm text-muted">
                      Added time begins when the previous stay length ends. The
                      price updates with your choices.
                    </p>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-5">
                    {(["adults", "children"] as const).map((field) => (
                      <label key={field} className="font-medium">
                        {field === "adults" ? "Adults" : "Children"}
                        <input
                          type="number"
                          min={field === "adults" ? 1 : 0}
                          step="1"
                          required
                          className={inputClass}
                          value={item[field]}
                          onChange={(event) =>
                            update(item.id, {
                              [field]: event.target.valueAsNumber,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  {item.category === "family_executive" && (
                    <label className="mt-5 flex min-h-11 items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={item.extraBed}
                        onChange={(event) =>
                          update(item.id, { extraBed: event.target.checked })
                        }
                      />
                      One extra bed · ₱100 once for this stay (stock pending)
                    </label>
                  )}
                  <p className="mt-4 text-sm text-muted">
                    Occupancy is advisory. No per-person surcharge. Safety
                    limits and extra-bed availability require staff review.
                  </p>
                </section>
              ))}
              {hall && (
                <section
                  aria-label="Function Hall booking"
                  className="booking-item rounded-2xl border border-subtle bg-white p-5 sm:p-7"
                  data-kind="hall"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">
                      <span className="booking-item-number mr-3" aria-hidden="true">FH</span>
                      Function Hall
                    </h2>
                    <button
                      type="button"
                      className="min-h-11 font-semibold text-primary"
                      disabled={!items.length}
                      onClick={() => {
                        setHall(null);
                        setQuote(null);
                        setAvailability(null);
                      }}
                    >
                      Remove hall
                    </button>
                  </div>
                  <p className="mb-5 text-sm text-muted">
                    One exclusive hall, with two alternative setups. Preparation
                    and cleanup time are protected separately.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="font-medium">
                      Hall setup
                      <select
                        className={inputClass}
                        value={hall.setup}
                        onChange={(e) =>
                          updateHall({
                            setup: e.target.value as HallDraft["setup"],
                          })
                        }
                      >
                        <option value="theater">
                          Theater Type · up to 70 attendees
                        </option>
                        <option value="room">
                          Room Type · up to 50 attendees
                        </option>
                      </select>
                    </label>
                    <label className="font-medium">
                      Event date
                      <input
                        required
                        type="date"
                        className={inputClass}
                        value={hall.date}
                        onChange={(e) => updateHall({ date: e.target.value })}
                      />
                    </label>
                  </div>
                  <fieldset className="mt-5">
                    <legend className="font-medium">Event start time</legend>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="text-sm text-muted">
                        Hour
                        <select
                          className={inputClass}
                          value={hall.hour}
                          onChange={(e) => updateHall({ hour: e.target.value })}
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm text-muted">
                        Minute
                        <select
                          className={inputClass}
                          value={hall.minute}
                          onChange={(e) =>
                            updateHall({ minute: e.target.value })
                          }
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <option key={i}>
                              {String(i).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm text-muted">
                        AM/PM
                        <select
                          className={inputClass}
                          value={hall.period}
                          onChange={(e) =>
                            updateHall({
                              period: e.target.value as HallDraft["period"],
                            })
                          }
                        >
                          <option>AM</option>
                          <option>PM</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="font-medium">
                      Event duration
                      <select
                        className={inputClass}
                        value={hall.minutes}
                        onChange={(e) =>
                          updateHall({ minutes: Number(e.target.value) })
                        }
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={(i + 3) * 60}>
                            {i + 3} hours
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="font-medium">
                      Number of attendees
                      <input
                        required
                        type="number"
                        min="1"
                        max={hall.setup === "theater" ? 70 : 50}
                        step="1"
                        className={inputClass}
                        value={hall.attendees}
                        onChange={(e) =>
                          updateHall({ attendees: e.target.valueAsNumber })
                        }
                      />
                    </label>
                  </div>
                  <label className="mt-5 block font-medium">
                    Additional requests
                    <textarea
                      className={inputClass + " py-3"}
                      rows={3}
                      maxLength={1000}
                      value={hall.requests}
                      onChange={(e) => updateHall({ requests: e.target.value })}
                    />
                  </label>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    First 3 hours: ₱3,000.00 for starts from 8:00 AM to before
                    5:00 PM; ₱5,000.00 from 5:00 PM. Each additional full hour:
                    ₱1,000.00. The event must fit within configured hours and
                    notice requirements. The server checks the final price and
                    availability.
                  </p>
                </section>
              )}
              <div className="booking-actions flex flex-wrap gap-3">
                <button
                  type="button"
                  className={secondary}
                  disabled={items.length >= 15 || rates.length === 0}
                  onClick={() => {
                    setItems((current) => [
                      ...current,
                      newRoom(
                        Math.max(0, ...current.map((room) => room.id)) + 1,
                        rates,
                      ),
                    ]);
                    setQuote(null);
                    setAvailability(null);
                  }}
                >
                  + Add room
                </button>
                {hallEnabled && (
                  <button
                    type="button"
                    className={secondary}
                    disabled={Boolean(hall)}
                    onClick={() => {
                      setHall(newHall());
                      setQuote(null);
                      setAvailability(null);
                    }}
                  >
                    + Add Function Hall
                  </button>
                )}
                <button
                  disabled={!items.length && !hall}
                  className="min-h-11 rounded-xl bg-booking px-6 font-bold text-main disabled:opacity-50"
                >
                  {busy ? "Calculating…" : "Get total"}
                </button>
                <button
                  type="button"
                  className={secondary}
                  disabled={!items.length && !hall}
                  onClick={() => void checkAvailability()}
                >
                  Check availability
                </button>
              </div>
            </fieldset>
            {message && (
              <p role="alert" className="mt-5 text-red-700">
                {message}
              </p>
            )}
          </form>
          <aside
            aria-label="Reservation summary"
            className="booking-summary rounded-2xl border border-subtle bg-white p-6 lg:sticky lg:top-8"
          >
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
              Your reservation
            </p>
            <h2 className="mt-3 text-2xl font-bold">
              {items.length > 0
                ? `${items.length} ${items.length === 1 ? "room" : "rooms"}`
                : ""}
              {hall ? `${items.length ? " + " : ""}Function Hall` : ""}
              {!items.length && !hall
                ? "Choose your items"
                : ", one reservation."}
            </h2>
            <div className="mt-5 rounded-xl bg-lavender p-4 text-sm leading-6">
              <strong>
                {bookingEnabled ? "Review your booking" : "Your choices"}
              </strong>
              <p>
                {bookingEnabled
                  ? "Review your total and terms before holding all selected items together for 30 minutes."
                  : "Online booking and payments are not open. Seeing a price does not reserve capacity."}
              </p>
            </div>
            {quote ? (
              <div aria-live="polite" className="mt-5 space-y-5">
                {quote.items.map((item, index) => (
                  <div
                    key={index}
                    className="border-b border-subtle pb-4 text-sm leading-6"
                  >
                    <h3 className="font-bold">
                      Room {index + 1} ·{" "}
                      {item.category === "double_standard"
                        ? "Double Standard"
                        : "Family Executive"}
                    </h3>
                    <p>
                      {hotelTime(item.startAt)} → {hotelTime(item.endAt)}
                    </p>
                    <p>
                      {item.blocks.map((block) => `${block / 60}h`).join(" + ")}
                    </p>
                    <p>Room price: {peso(item.baseCentavos)}</p>
                    {item.extraBedCentavos > 0 && (
                      <p>Extra bed (once): {peso(item.extraBedCentavos)}</p>
                    )}
                    <p className="font-bold">{peso(item.totalCentavos)}</p>
                    {item.advisory && (
                      <p className="mt-2 text-muted">{item.advisory}</p>
                    )}
                  </div>
                ))}
                {quote.hall && (
                  <div className="border-b border-subtle pb-4 text-sm leading-6">
                    <h3 className="font-bold">
                      Function Hall ·{" "}
                      {quote.hall.setup === "theater"
                        ? "Theater Type"
                        : "Room Type"}
                    </h3>
                    <p>
                      {hotelTime(quote.hall.start)} →{" "}
                      {hotelTime(quote.hall.end)}
                    </p>
                    <p>
                      {quote.hall.attendees} attendees ·{" "}
                      {quote.hall.minutes / 60} hours
                    </p>
                    <p>First 3 hours: {peso(quote.hall.base)}</p>
                    {quote.hall.additional > 0 && (
                      <p>Additional hours: {peso(quote.hall.additional)}</p>
                    )}
                    <p className="font-bold">{peso(quote.hall.total)}</p>
                  </div>
                )}
                <div className="booking-total">
                  <p className="text-sm text-muted">
                    Total for your reservation
                  </p>
                  <p className="mt-1 text-3xl font-bold text-primary">
                    {peso(quote.totalCentavos)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-muted">
                Choose your items and schedules, then check the current total
                price.
              </p>
            )}
            {bookingEnabled ? (
              <div className="mt-6 space-y-4">
                {guest?.access.status === "authenticated" ? (
                  <form
                    onSubmit={(event) => void hold(event)}
                    className="space-y-4"
                  >
                    <label className="block font-medium">
                      Primary guest name
                      <input
                        className={inputClass}
                        required
                        maxLength={120}
                        autoComplete="name"
                        value={primaryName}
                        onChange={(event) => setPrimaryName(event.target.value)}
                      />
                    </label>
                    <label className="block font-medium">
                      Contact number
                      <input
                        className={inputClass}
                        required
                        type="tel"
                        autoComplete="tel"
                        pattern="[+()0-9 -]{7,30}"
                        maxLength={30}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </label>
                    {policy && (
                      <>
                        <section aria-label="Booking policies" className="rounded-xl border border-subtle bg-canvas p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-bold text-main">Booking policies</h3>
                            <button
                              type="button"
                              className="min-h-11 rounded-lg border border-subtle px-3 text-sm font-semibold text-primary"
                              aria-expanded={policiesExpanded}
                              aria-controls="booking-policy-content"
                              onClick={() => setPoliciesExpanded((expanded) => !expanded)}
                            >
                              {policiesExpanded ? "Hide" : "Show"}
                              <span className="sr-only"> booking policies</span>
                            </button>
                          </div>
                          <div id="booking-policy-content" hidden={!policiesExpanded}>
                          <ul className="mt-4 space-y-4">
                            {[
                              { title: "Payment", text: "Pay the full amount via GCash. Submit proof and reference number within 30 minutes.", icon: "M3 7h18v13H3z M3 7V4h14v3 M16 12h5v4h-5z" },
                              { title: "Confirmation", text: "Your booking is confirmed after staff verifies your payment. Timely proof submission protects your reservation.", icon: "M9 12l2 2 4-4 M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" },
                              { title: "Cancellation", text: "Free cancellation within one hour of confirmation or before check-in/event start, whichever comes first. Rescheduling does not reset this period.", icon: "M8 2v4 M16 2v4 M3 10h18 M3 4h18v17H3z M9 13l6 5 M15 13l-6 5" },
                              { title: "Late arrival", text: "Your scheduled checkout or event end time remains unchanged.", icon: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" },
                              { title: "No-show", text: "Subject to staff review and generally non-refundable.", icon: "M12 8v5 M12 16h.01 M12 3L2 21h20z" },
                              { title: "Refunds", text: "Eligible refunds are processed manually.", icon: "M4 10h10a6 6 0 0 1 0 12 M4 10l5-5 M4 10l5 5" },
                              { title: "Hotel rules", text: "No smoking. Occupancy and minor eligibility are subject to staff review and safety requirements.", icon: "M4 21V3h16v18 M2 21h20 M8 7h2 M14 7h2 M8 11h2 M14 11h2 M10 21v-6h4v6" },
                            ].map(({ title, text, icon }) => (
                              <li key={title} className="flex items-start gap-3">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-selected text-primary">
                                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={icon} />
                                  </svg>
                                </span>
                                <div className="min-w-0 text-sm leading-6">
                                  <p className="font-semibold text-main">{title}</p>
                                  <p className="text-muted">{text}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                          <details className="mt-5 border-t border-subtle pt-4">
                            <summary className="text-sm font-semibold text-primary">Read the full policy</summary>
                            <p className="mt-3 text-sm leading-6 text-muted">{policy.text}</p>
                          </details>
                          </div>
                        </section>
                        {policy.pendingOwnerApproval && (
                          <p className="text-sm text-muted">
                            Development disclosure; owner and legal policy
                            approval remains pending.
                          </p>
                        )}
                        <label className="flex items-start gap-3 text-sm">
                          <input
                            className="mt-1 size-5 shrink-0"
                            type="checkbox"
                            required
                            checked={acknowledged}
                            onChange={(event) =>
                              setAcknowledged(event.target.checked)
                            }
                          />
                          I have read and acknowledge the booking policies.
                        </label>
                      </>
                    )}
                    <button
                      disabled={
                        busy ||
                        !quote ||
                        !policy ||
                        !acknowledged ||
                        availability === false
                      }
                      className="guest-primary-action min-h-11 w-full rounded-xl bg-booking px-4 font-semibold text-main disabled:opacity-50"
                    >
                      {busy ? "Creating hold…" : "Continue to GCash payment"}
                    </button>
                  </form>
                ) : (
                  <a
                    href="/verify?returnTo=%2Fbook"
                    className="guest-action inline-flex min-h-11 w-full items-center bg-booking font-semibold text-main"
                  >
                    Verify email
                  </a>
                )}
              </div>
            ) : (
              <button
                disabled
                className="mt-6 min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-white opacity-50"
              >
                Booking not open
              </button>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
