import TimePartInput, { manilaClock } from "./TimePartInput";
import { parsePesoInput } from "./peso-input";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  BookingItemInput,
  BookingQuote,
  WalkInBooking,
  WalkInPaymentInput,
} from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { hotelTime, peso } from "./BookingPlanner";
import WalkInPolicies from "./WalkInPolicies";

type Rate = {
  code: BookingItemInput["category"];
  name: string;
  duration_minutes: number;
  price_centavos: number;
};
type Arrival = { date: string; hour: string; minute: string; period: string };
type Contact = {
  phone: string;
  email: string;
  policyVersion: string;
  policyAcknowledged: boolean;
  minorIdStatus: string;
};
type Draft = Arrival & {
  category: BookingItemInput["category"];
  blocks: number[];
  adults: number;
  children: number;
  extraBed: boolean;
};
const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white p-2 text-base";
const buttonClass =
  "min-h-11 rounded-lg border border-subtle px-4 py-2 font-semibold text-primary disabled:opacity-50";
const arrival = (offset = 120000): Arrival => {
  const d = new Date(
    Math.floor((Date.now() + offset) / 60000) * 60000 + 8 * 3600000,
  );
  return {
    date: d.toISOString().slice(0, 10),
    hour: String(d.getUTCHours() % 12 || 12),
    minute: String(d.getUTCMinutes()).padStart(2, "0"),
    period: d.getUTCHours() < 12 ? "AM" : "PM",
  };
};
const instant = (value: Arrival) => {
  const clock = manilaClock(value.hour, value.minute, value.period);
  return value.date && clock ? `${value.date}T${clock}:00+08:00` : "";
};
const draft = (rates: Rate[]): Draft => ({
  ...arrival(),
  category: rates[0].code,
  blocks: [rates[0].duration_minutes],
  adults: 2,
  children: 0,
  extraBed: false,
});
function ArrivalFields({
  value,
  onChange,
  label,
  shortLabels = false,
}: {
  value: Arrival;
  onChange: (patch: Partial<Arrival>) => void;
  label: string;
  shortLabels?: boolean;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <legend
        className={shortLabels ? "sr-only" : "mb-2 text-sm font-semibold"}
      >
        {label} · Manila
      </legend>
      <label className="text-sm">
        {shortLabels ? "Date" : `${label} date`}
        <input
          aria-label={`${label} date`}
          type="date"
          required
          value={value.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className={inputClass}
        />
      </label>
      <div className="text-sm">
        {shortLabels ? "Hour" : `${label} hour`}
        <TimePartInput
          part="hour"
          label={`${label} hour`}
          value={value.hour}
          onChange={(value) => onChange({ hour: value })}
          className={inputClass}
        />
      </div>
      <div className="text-sm">
        {shortLabels ? "Minute" : `${label} minute`}
        <TimePartInput
          part="minute"
          label={`${label} minute`}
          value={value.minute}
          onChange={(value) => onChange({ minute: value })}
          className={inputClass}
        />
      </div>
      <label className="text-sm">
        {shortLabels ? "AM/PM" : `${label} AM/PM`}
        <select
          aria-label={`${label} AM/PM`}
          value={value.period}
          onChange={(e) => onChange({ period: e.target.value })}
          className={inputClass}
        >
          <option>AM</option>
          <option>PM</option>
        </select>
      </label>
    </fieldset>
  );
}
function WalkInPlanner({
  rates,
  enabled,
  preview,
  onQuote,
  onCreate,
  policy,
}: {
  rates: Rate[];
  enabled: boolean;
  preview: boolean;
  onQuote: (items: BookingItemInput[]) => Promise<BookingQuote>;
  onCreate: (
    name: string,
    items: BookingItemInput[],
    key: string,
    contact?: Contact,
  ) => Promise<void>;
  policy?: { version: string; text: string; pendingOwnerApproval: boolean };
}) {
  const [items, setItems] = useState<Draft[]>([draft(rates)]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [minorIdChecked, setMinorIdChecked] = useState(false);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const payload = () =>
    items.map(({ date, hour, minute, period, ...item }) => ({
      ...item,
      startAt: instant({ date, hour, minute, period }),
    }));
  function update(index: number, patch: Partial<Draft>) {
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    setQuote(null);
    setMessage("");
  }
  async function quoteItems(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      setQuote(await onQuote(payload()));
    } catch (error) {
      setQuote(null);
      setMessage(error instanceof Error ? error.message : "Quote unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!name.trim() || !quote) {
      setMessage("Enter a primary guest name and calculate a current quote.");
      return;
    }
    if (!preview && (!phone.trim() || !acknowledged || !policy)) {
      setMessage(
        "Enter contact details and acknowledge the disclosed booking policy.",
      );
      return;
    }
    const contact: Contact | undefined = preview
      ? undefined
      : {
          phone: phone.trim(),
          email: email.trim(),
          policyVersion: policy!.version,
          policyAcknowledged: acknowledged,
          minorIdStatus: items.some((item) => item.children > 0)
            ? minorIdChecked
              ? "checked"
              : "not_checked"
            : "no_minors",
        };
    const body = JSON.stringify({
      name: name.trim(),
      items: payload(),
      contact,
    });
    if (attempt.current?.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await onCreate(name.trim(), payload(), attempt.current!.key, contact);
      if (!preview)
        notifySuccess("Walk-in booking recorded. Check-in is still required.");
      attempt.current = null;
      setQuote(null);
      setMessage(
        "Walk-in recorded with provisional capacity only. No check-in or room access was performed.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Booking result is uncertain. Retry unchanged or reconcile before creating another.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border border-subtle bg-white p-5">
      <h2 className="text-xl font-bold">New walk-in</h2>
      <p className="mt-2 text-sm text-muted">
        Add guest details and rooms, review the total, then record payment. The
        stay starts at staff check-in.
      </p>
      <form onSubmit={(e) => void quoteItems(e)} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <legend className="font-semibold">Guest details</legend>
          <label className="block font-medium">
            Primary guest name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className={inputClass}
              autoComplete="off"
            />
          </label>
          {!preview && (
            <div className="space-y-3 rounded border border-subtle p-4">
              <label className="block">
                Contact number
                <input
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                  className={inputClass}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
              <label className="block">
                Contact email (optional, unverified)
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  className={inputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {policy ? (
                <WalkInPolicies text={policy.text} />
              ) : (
                <p role="status" className="text-sm">
                  Booking policy is unavailable. Creation remains blocked.
                </p>
              )}
              {policy?.pendingOwnerApproval && (
                <p className="text-sm text-muted">
                  Development disclosure; owner/legal approval remains pending.
                </p>
              )}
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                Guest has acknowledged the disclosed booking policy
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={minorIdChecked}
                  onChange={(event) => setMinorIdChecked(event.target.checked)}
                />
                Staff checked minor ID where applicable
              </label>
              <p className="text-sm text-muted">
                No ID photographs, ID numbers or birth dates are stored.
                Checking an ID does not establish legal eligibility. Unchecked
                minors remain pending staff review.
              </p>
            </div>
          )}
          {items.map((item, index) => (
            <fieldset
              key={index}
              className="space-y-4 rounded-lg border border-subtle p-4"
            >
              <legend className="px-2 font-semibold">Room {index + 1}</legend>
              <label className="block text-sm">
                Category — room {index + 1}
                <select
                  value={item.category}
                  onChange={(e) => {
                    const rate = rates.find((r) => r.code === e.target.value)!;
                    update(index, {
                      category: rate.code,
                      blocks: [rate.duration_minutes],
                      extraBed: false,
                    });
                  }}
                  className={inputClass}
                >
                  {[...new Set(rates.map((r) => r.code))].map((code) => (
                    <option key={code} value={code}>
                      {rates.find((r) => r.code === code)!.name}
                    </option>
                  ))}
                </select>
              </label>
              <ArrivalFields
                value={item}
                onChange={(patch) => update(index, patch)}
                label="Arrival"
                shortLabels
              />
              {item.blocks.map((duration, blockIndex) => (
                <div key={blockIndex} className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 text-sm">
                    Package {blockIndex + 1} — room {index + 1}
                    <select
                      value={duration}
                      onChange={(e) =>
                        update(index, {
                          blocks: item.blocks.map((n, i) =>
                            i === blockIndex ? Number(e.target.value) : n,
                          ),
                        })
                      }
                      className={inputClass}
                    >
                      {rates
                        .filter((r) => r.code === item.category)
                        .map((r) => (
                          <option
                            key={r.duration_minutes}
                            value={r.duration_minutes}
                          >
                            {r.duration_minutes / 60}h ·{" "}
                            {peso(r.price_centavos)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {item.blocks.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove package ${blockIndex + 1} from room ${index + 1}`}
                      className={buttonClass}
                      onClick={() =>
                        update(index, {
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
                className={buttonClass}
                onClick={() =>
                  update(index, {
                    blocks: [...item.blocks, item.blocks.at(-1)!],
                  })
                }
              >
                Add package to room {index + 1}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Adults — room {index + 1}
                  <input
                    type="number"
                    min={1}
                    value={item.adults}
                    onChange={(e) =>
                      update(index, { adults: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-sm">
                  Children — room {index + 1}
                  <input
                    type="number"
                    min={0}
                    value={item.children}
                    onChange={(e) =>
                      update(index, { children: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              {item.category === "family_executive" && (
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.extraBed}
                    onChange={(e) =>
                      update(index, { extraBed: e.target.checked })
                    }
                  />
                  One Family extra bed · ₱100 once per stay (stock pending)
                </label>
              )}
              {items.length > 1 && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    setItems(items.filter((_, i) => i !== index));
                    setQuote(null);
                  }}
                >
                  Remove room {index + 1}
                </button>
              )}
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={items.length >= 15}
              className={buttonClass}
              onClick={() => {
                setItems([...items, draft(rates)]);
                setQuote(null);
              }}
            >
              Add room
            </button>
            <button className={buttonClass}>
              {preview ? "Preview total" : "Review total"}
            </button>
          </div>
        </fieldset>
      </form>
      {quote && (
        <div className="mt-5 rounded-lg bg-selected p-4" aria-live="polite">
          {quote.items.map((item, index) => (
            <p key={index} className="mb-2 text-sm">
              Room {index + 1}: {hotelTime(item.startAt)} →{" "}
              {hotelTime(item.endAt)} · {peso(item.totalCentavos)}
            </p>
          ))}
          <p className="font-bold">
            Total {peso(quote.totalCentavos)} · Minimum deposit{" "}
            {peso(Math.ceil(quote.totalCentavos / 2))}
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={!enabled || busy || !quote || !name.trim()}
        onClick={() => void create()}
        className="mt-4 min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {preview ? "Create synthetic walk-in" : "Create walk-in"}
      </button>
      {message && (
        <p role="status" className="mt-3 text-sm text-primary">
          {message}
        </p>
      )}
    </section>
  );
}

export function WalkInLedger({
  booking,
  enabled,
  preview,
  onPayment,
}: {
  booking: WalkInBooking;
  enabled: boolean;
  preview: boolean;
  onPayment: (value: WalkInPaymentInput) => Promise<void>;
}) {
  const [method, setMethod] = useState<"cash" | "gcash">("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [recipient, setRecipient] = useState("");
  const [received, setReceived] = useState<Arrival>(() => arrival(0));
  const [checks, setChecks] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const attempt = useRef<{ body: string; key: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    let amountCentavos: number;
    try {
      amountCentavos = parsePesoInput(amount);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    if (amountCentavos <= 0) {
      setMessage("Enter a positive amount with up to two decimal places.");
      return;
    }
    if (
      method === "gcash" &&
      (!checks.every(Boolean) ||
        !reference.trim() ||
        !recipient.trim() ||
        !instant(received))
    ) {
      setMessage(
        "Verify actual GCash receipt, recipient, time and reference first.",
      );
      return;
    }
    const body = JSON.stringify({
      method,
      amountCentavos,
      ...(method === "gcash"
        ? {
            verification: {
              reference,
              recipient,
              receivedAt: instant(received),
              ledgerChecked: checks[0],
              receivingAccountChecked: checks[1],
              timeChecked: checks[2],
            },
          }
        : {}),
    });
    if (attempt.current?.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await onPayment({
        ...JSON.parse(body),
        requestKey: attempt.current!.key,
      });
      if (!preview) notifySuccess("Collected payment recorded.");
      attempt.current = null;
      setAmount("");
      setMessage(
        preview
          ? "Synthetic payment recorded locally. No real money collected."
          : "Collected payment recorded and audited.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Payment result uncertain. Retry unchanged or reconcile first.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border border-subtle bg-white p-5">
      <h2 className="break-words text-xl font-bold">{booking.primaryName}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt>Total amount</dt>
          <dd className="text-xl font-bold">{peso(booking.totalCentavos)}</dd>
        </div>
        <div>
          <dt>Amount paid</dt>
          <dd className="text-xl font-bold">
            {peso(booking.collectedCentavos)}
          </dd>
        </div>
        <div>
          <dt>Remaining balance</dt>
          <dd>{peso(booking.balanceCentavos)} (original booking)</dd>
          {booking.settlementDueCentavos !== undefined && (
            <>
              <dt>Remaining balance including additions</dt>
              <dd>{peso(booking.settlementDueCentavos)}</dd>
              <dt>Additional charges</dt>
              <dd>{peso(booking.additionalNetCentavos ?? 0)}</dd>
            </>
          )}
        </div>
        <div>
          <dt>Minimum deposit (50%)</dt>
          <dd>{peso(booking.minimumCentavos)}</dd>
        </div>
      </dl>
      <p className="mt-4 rounded-lg bg-selected p-3 font-semibold text-primary">
        {booking.paymentMinimumMet
          ? "Payment minimum met"
          : "Deposit required before check-in"}
      </p>
      <p className="mt-2 text-sm text-muted">
        Assign a Ready room and record check-in before giving room access.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {booking.items.map((item, index) => (
          <li key={item.id} className="rounded-lg border border-subtle p-3">
            <strong>
              Room {index + 1} ·{" "}
              {item.category === "family_executive"
                ? "Family Executive"
                : "Double Standard"}
            </strong>
            <p>
              {hotelTime(item.startAt)} → {hotelTime(item.endAt)}
            </p>
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer font-semibold text-primary">
                Reservation details
              </summary>
              <p>
                Capacity held against {item.provisionalRoomCode} ·{" "}
                {item.claimState.replaceAll("_", " ")}. Physical room assignment
                is separate.
              </p>
            </details>
            <p>{peso(item.totalCentavos)}</p>
          </li>
        ))}
      </ul>
      <details className="mt-5 border-t border-subtle pt-3">
        <summary className="min-h-11 cursor-pointer font-semibold text-primary">
          Charges and payment history
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Entry</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Staff / recorded time</th>
              </tr>
            </thead>
            <tbody>
              {booking.ledger.map((entry) => (
                <tr key={entry.id} className="border-t border-subtle">
                  <td className="p-2">
                    {entry.kind === "charge" ? "Room charge" : entry.method}
                    <span className="block break-all text-xs text-muted">
                      {entry.transactionReference}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-2">
                    {peso(entry.amountCentavos)}
                  </td>
                  <td className="p-2">
                    <span className="block break-all text-xs">
                      {entry.actorId}
                    </span>
                    {hotelTime(entry.recordedAt)}
                    {entry.receivedAt && (
                      <span className="block text-xs">
                        GCash received: {hotelTime(entry.receivedAt)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <form onSubmit={(e) => void submit(e)} className="mt-5">
        <fieldset
          disabled={!enabled || busy || booking.balanceCentavos <= 0}
          className="space-y-3"
        >
          <legend className="font-semibold">Record payment</legend>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "cash" | "gcash")}
                className={inputClass}
              >
                <option value="cash">Cash</option>
                <option value="gcash">Verified GCash</option>
              </select>
            </label>
            <label>
              Payment amount (PHP)
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          {method === "gcash" && (
            <fieldset className="space-y-3 rounded-lg border border-subtle p-3">
              <legend className="font-semibold">Verify GCash receipt</legend>
              <label className="block">
                GCash reference
                <input
                  value={reference}
                  maxLength={100}
                  onChange={(e) => setReference(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                Receiving account name
                <input
                  value={recipient}
                  maxLength={120}
                  onChange={(e) => setRecipient(e.target.value)}
                  className={inputClass}
                />
              </label>
              <ArrivalFields
                value={received}
                onChange={(patch) => setReceived({ ...received, ...patch })}
                label="Received"
              />
              {[
                "I checked actual receipt and amount in the hotel GCash ledger.",
                "I matched the hotel receiving account.",
                "I matched the transaction time and unused reference.",
              ].map((label, i) => (
                <label key={label} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={(e) =>
                      setChecks(
                        checks.map((v, index) =>
                          index === i ? e.target.checked : v,
                        ),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          <button className="min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">
            {preview ? "Record synthetic payment" : "Record payment"}
          </button>
        </fieldset>
      </form>
      {!preview && (
        <a
          href="/staff/check-ins"
          className={`${buttonClass} mt-4 inline-flex items-center`}
        >
          Open check-in desk
        </a>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-primary">
          {message}
        </p>
      )}
    </section>
  );
}

const fixtureRates: Rate[] = [
  ...[180, 360, 720, 1440].map((duration_minutes, i) => ({
    code: "double_standard" as const,
    name: "Double Standard",
    duration_minutes,
    price_centavos: [20000, 40000, 60000, 100000][i],
  })),
  ...[360, 720, 1440].map((duration_minutes, i) => ({
    code: "family_executive" as const,
    name: "Family Executive",
    duration_minutes,
    price_centavos: [60000, 90000, 120000][i],
  })),
];
export default function WalkInDesk({
  token,
  preview = false,
}: {
  token?: string;
  preview?: boolean;
}) {
  const [rates, setRates] = useState<Rate[]>(preview ? fixtureRates : []);
  const [booking, setBooking] = useState<WalkInBooking | null>(null);
  const [list, setList] = useState<{ id: string; primaryName: string }[]>([]);
  const [enabled, setEnabled] = useState(preview);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [policy, setPolicy] = useState<{
    version: string;
    text: string;
    pendingOwnerApproval: boolean;
  }>();
  const usedRefs = useRef(new Set(["SYNTHETICONLINEUSED"]));
  const headers = { Authorization: `Bearer ${token}` };
  async function api(path: string, body?: unknown) {
    const response = await fetch(`${apiBase}/staff/walkins${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...headers,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "Walk-in service unavailable.");
    return data;
  }
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    setBooking(null);
    setEnabled(false);
    void Promise.all([
      fetch(`${apiBase}/catalog`, { signal: controller.signal }).then(
        async (r) => {
          if (!r.ok) throw new Error("Catalog unavailable.");
          return r.json();
        },
      ),
      fetch(`${apiBase}/staff/walkins?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Walk-in desk requires authorized staff and the approved W01 migration. Live writes remain closed.",
          );
        return r.json();
      }),
    ])
      .then(([catalog, data]) => {
        if (controller.signal.aborted) return;
        setRates(catalog);
        setList(data.bookings);
        setHasMore(data.hasMore);
        setEnabled(data.writesEnabled);
        setPolicy(data.policy);
        setMessage("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setMessage(error.message);
          setList([]);
        }
      });
    return () => controller.abort();
  }, [token, preview, page]);
  async function quoteItems(items: BookingItemInput[]): Promise<BookingQuote> {
    if (!preview) return api("/quote", { items });
    const quoted = items.map((item) => {
      const packages = item.blocks.map((block) => {
        const r = fixtureRates.find(
          (r) => r.code === item.category && r.duration_minutes === block,
        );
        if (!r) throw new Error("Unsupported fixture package.");
        return {
          id: `fixture-${item.category}-${block}`,
          version: 1,
          durationMinutes: block,
          priceCentavos: r.price_centavos,
        };
      });
      const baseCentavos = packages.reduce((n, p) => n + p.priceCentavos, 0);
      const extraBedCentavos = item.extraBed ? 10000 : 0;
      return {
        ...item,
        endAt: new Date(
          Date.parse(item.startAt) +
            item.blocks.reduce((a, b) => a + b, 0) * 60000,
        ).toISOString(),
        packages,
        baseCentavos,
        extraBedCentavos,
        totalCentavos: baseCentavos + extraBedCentavos,
        advisory: null,
      };
    });
    return {
      items: quoted,
      totalCentavos: quoted.reduce((n, item) => n + item.totalCentavos, 0),
    };
  }
  async function create(
    name: string,
    items: BookingItemInput[],
    key: string,
    contact?: Contact,
  ) {
    if (!preview) {
      const result = await api("", {
        primaryName: name,
        items,
        requestKey: key,
        contact,
      });
      setBooking(result.booking);
      setList([
        { id: result.booking.id, primaryName: name },
        ...list.filter((row) => row.id !== result.booking.id),
      ]);
      return;
    }
    const quote = await quoteItems(items);
    const id = crypto.randomUUID();
    const recordedAt = new Date().toISOString();
    setBooking({
      id,
      primaryName: name,
      createdAt: recordedAt,
      totalCentavos: quote.totalCentavos,
      collectedCentavos: 0,
      balanceCentavos: quote.totalCentavos,
      minimumCentavos: Math.ceil(quote.totalCentavos / 2),
      paymentMinimumMet: quote.totalCentavos === 0,
      normalCheckInEligible: quote.totalCentavos === 0,
      items: quote.items.map((item, i) => ({
        id: `fixture-item-${i}`,
        category: item.category,
        startAt: item.startAt,
        endAt: item.endAt,
        totalCentavos: item.totalCentavos,
        provisionalRoomCode: `SYNTHETIC SLOT ${i + 1} — not a hotel room ID`,
        claimState: "walkin_reserved",
      })),
      ledger: quote.items.map((item, i) => ({
        id: `fixture-charge-${i}`,
        kind: "charge",
        method: null,
        amountCentavos: item.totalCentavos,
        transactionReference: null,
        actorId: "SYNTHETIC STAFF",
        recordedAt,
        receivedAt: null,
      })),
    });
  }
  async function payment(value: WalkInPaymentInput) {
    if (!booking) return;
    if (!preview) {
      const result = await api(`/${booking.id}/payments`, value);
      setBooking(result.booking);
      return;
    }
    if (value.amountCentavos > booking.balanceCentavos)
      throw new Error("Payment exceeds the remaining balance.");
    const ref = value.verification?.reference
      .replace(/[ -]/g, "")
      .toUpperCase();
    if (ref && usedRefs.current.has(ref))
      throw new Error("Synthetic reference already collected.");
    if (ref) usedRefs.current.add(ref);
    const collected = booking.collectedCentavos + value.amountCentavos;
    setBooking({
      ...booking,
      collectedCentavos: collected,
      balanceCentavos: booking.totalCentavos - collected,
      paymentMinimumMet: collected >= booking.minimumCentavos,
      normalCheckInEligible: collected >= booking.minimumCentavos,
      ledger: [
        ...booking.ledger,
        {
          id: crypto.randomUUID(),
          kind: "payment",
          method: value.method,
          amountCentavos: value.amountCentavos,
          transactionReference: ref ?? null,
          actorId: "SYNTHETIC STAFF",
          recordedAt: new Date().toISOString(),
          receivedAt: value.verification?.receivedAt ?? null,
        },
      ],
    });
  }
  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="mb-3 text-3xl font-bold">Walk-in desk</h1>
      <p className="mb-5 rounded-lg bg-selected p-4 text-sm text-primary">
        {preview
          ? "Synthetic preview · fixture prices and slots only; no network booking, payment or real money."
          : "Room access requires payment eligibility, a Ready room and recorded staff check-in."}
      </p>
      {!preview && !enabled && (
        <p role="status" className="mb-4 text-sm text-muted">
          Walk-in transactions are currently unavailable.
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 text-muted">
          {message}
        </p>
      )}
      {!preview && (
        <nav
          aria-label="Walk-in reservations"
          className="mb-5 flex flex-wrap gap-2"
        >
          <button
            className={buttonClass}
            disabled={page === 0}
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </button>
          <span className="self-center">Page {page + 1}</span>
          <button
            className={buttonClass}
            disabled={!hasMore}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </button>
          {list.map((row) => (
            <button
              key={row.id}
              className={buttonClass}
              onClick={() => {
                void api(`/${row.id}`)
                  .then(setBooking)
                  .catch((error) => setMessage(error.message));
              }}
            >
              {row.primaryName}
            </button>
          ))}
        </nav>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {rates.length > 0 && (
          <WalkInPlanner
            key={rates.map((r) => `${r.code}:${r.duration_minutes}`).join()}
            rates={rates}
            enabled={enabled}
            preview={preview}
            onQuote={quoteItems}
            onCreate={create}
            policy={policy}
          />
        )}
        {booking ? (
          <WalkInLedger
            key={booking.id}
            booking={booking}
            enabled={enabled}
            preview={preview}
            onPayment={payment}
          />
        ) : (
          <div className="rounded-xl border border-subtle bg-white p-5">
            <h2 className="font-bold">Select or create a walk-in</h2>
            <p className="mt-3 text-sm text-muted">
              Choose a guest above to view charges, payments and remaining
              balance.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
export function WalkInPreview() {
  return (
    <main className="min-h-svh bg-canvas p-5 text-main sm:p-10">
      <WalkInDesk preview />
    </main>
  );
}
