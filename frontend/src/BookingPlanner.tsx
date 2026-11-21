import { useEffect, useState } from "react";
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
  try {
    const saved: unknown = JSON.parse(
      window.sessionStorage.getItem(draftKey) ?? "null",
    );
    if (
      Array.isArray(saved) &&
      saved.length > 0 &&
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
  return [newRoom(1)];
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

export default function BookingPlanner() {
  const guest = useGuestSession();
  const [items, setItems] = useState<Draft[]>(restoreDraft);
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
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [request, setRequest] = useState<{ body: string; key: string } | null>(
    null,
  );
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
          setMessage("No packages are currently available.");
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
            "Current packages are unavailable. Please try again later.",
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
        body: JSON.stringify({
          items: toInputs(items),
        }),
      });
      const data = (await response.json()) as BookingQuote & { error?: string };
      if (!response.ok)
        throw new Error(data.error || "Quote unavailable. Please try again.");
      setQuote(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Quote unavailable.");
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
        body: JSON.stringify({ items: toInputs(items) }),
      });
      const data = (await response.json()) as {
        available: boolean;
        quote: BookingQuote;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Availability is unavailable.");
      setQuote(data.quote);
      setAvailability(data.available);
      setMessage(
        data.available
          ? "Available now. Capacity is reserved only when your hold succeeds."
          : "These schedules are unavailable. Choose another time or category.",
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
      items: toInputs(items),
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
      window.sessionStorage.removeItem(commandKey);
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
    <section className="bg-canvas px-5 py-8 text-main sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle pb-6">
          <a href="/" className="font-bold tracking-tight text-primary">
            DANNY'S MICRO HOTEL{" "}
            <span className="ml-2 font-normal text-muted">/ StayTrack</span>
          </a>
          <nav className="flex gap-6 text-sm font-semibold text-primary">
            <a href="/rooms">Rooms & rates</a>
            <a href="/verify">Guest access</a>
          </nav>
        </header>
        <div className="mb-9 mt-12 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
            Plan your stay
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Together, on your own time.
          </h1>
          <p className="mt-4 leading-7 text-muted">
            One group, different arrivals. Choose each room's schedule and
            package blocks. All times are Philippine time (Asia/Manila).
          </p>
          <p className="mt-2 text-sm text-muted">
            {bookingEnabled
              ? "Isolated development booking. Do not send real money."
              : "Online booking is currently closed."}
          </p>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
          <form onSubmit={(event) => void submit(event)}>
            <fieldset
              disabled={busy || rates.length === 0}
              className="space-y-6 disabled:opacity-70"
            >
              <legend className="sr-only">Room schedules</legend>
              {items.map((item, index) => (
                <section
                  key={item.id}
                  aria-label={`Room ${index + 1}`}
                  className="rounded-2xl border border-subtle bg-white p-5 sm:p-7"
                >
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold">
                      <span className="mr-3 text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      Room {index + 1}
                    </h2>
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="min-h-11 text-sm font-semibold text-primary"
                        onClick={() => {
                          setItems((current) =>
                            current.filter((room) => room.id !== item.id),
                          );
                          setQuote(null);
                        }}
                      >
                        Remove room {index + 1}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="font-medium">
                      Category — room {index + 1}
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
                      Arrival date — room {index + 1}
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
                    <legend className="font-medium">
                      Arrival time — room {index + 1}
                    </legend>
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
                          Package {blockIndex + 1} — room {index + 1}
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
                            aria-label={`Remove package ${blockIndex + 1} from room ${index + 1}`}
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
                      + Add package block to room {index + 1}
                    </button>
                    <p className="text-sm text-muted">
                      Blocks run consecutively as one continuous stay. Prices
                      use your selected blocks.
                    </p>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-5">
                    {(["adults", "children"] as const).map((field) => (
                      <label key={field} className="font-medium">
                        {field === "adults" ? "Adults" : "Children"} — room{" "}
                        {index + 1}
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
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={secondary}
                  disabled={items.length >= 15}
                  onClick={() => {
                    setItems((current) => [
                      ...current,
                      newRoom(
                        Math.max(...current.map((room) => room.id)) + 1,
                        rates,
                      ),
                    ]);
                    setQuote(null);
                  }}
                >
                  + Add room
                </button>
                <button className="min-h-11 rounded-xl bg-booking px-6 font-bold text-main disabled:opacity-50">
                  {busy ? "Calculating…" : "Calculate server quote"}
                </button>
                <button
                  type="button"
                  className={secondary}
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
            aria-label="Stay summary"
            className="rounded-2xl border border-subtle bg-white p-6 lg:sticky lg:top-8"
          >
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
              Your stay
            </p>
            <h2 className="mt-3 text-2xl font-bold">
              {items.length} {items.length === 1 ? "room" : "rooms"}, one plan.
            </h2>
            <div className="mt-5 rounded-xl bg-lavender p-4 text-sm leading-6">
              <strong>
                {bookingEnabled ? "Booking review" : "Planning preview"}
              </strong>
              <p>
                {bookingEnabled
                  ? "Review the server price and policies before creating your 30-minute hold."
                  : "Online booking and payments are not open. A quote does not reserve availability."}
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
                    <p>Packages: {peso(item.baseCentavos)}</p>
                    {item.extraBedCentavos > 0 && (
                      <p>Extra bed (once): {peso(item.extraBedCentavos)}</p>
                    )}
                    <p className="font-bold">{peso(item.totalCentavos)}</p>
                    {item.advisory && (
                      <p className="mt-2 text-muted">{item.advisory}</p>
                    )}
                  </div>
                ))}
                <div>
                  <p className="text-sm text-muted">Full reservation amount</p>
                  <p className="mt-1 text-3xl font-bold text-primary">
                    {peso(quote.totalCentavos)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-muted">
                Choose each schedule, then calculate a quote using current
                server prices.
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
                        <p className="text-sm leading-6 text-muted">
                          {policy.text}
                        </p>
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
                      className="min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-white disabled:opacity-50"
                    >
                      {busy
                        ? "Creating hold…"
                        : "Create hold and continue to payment"}
                    </button>
                  </form>
                ) : (
                  <a
                    href="/verify?returnTo=%2Fbook"
                    className="inline-flex min-h-11 items-center font-semibold text-primary"
                  >
                    Verify email to continue booking
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
            {import.meta.env?.DEV && (
              <a
                href="/payment-preview"
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
              >
                Preview the payment proof screen
              </a>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
