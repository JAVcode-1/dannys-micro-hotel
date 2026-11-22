import { useState } from "react";

export default function ManilaDateTimeInput({
  label,
  name,
  value,
  onChange,
  required = false,
}: {
  label: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [partialClock, setPartialClock] = useState("00:00");
  const current = value ?? draft;
  const [date = "", clock = partialClock] = current.split("T");
  const [hour = "00", minute = "00"] = clock.split(":");
  function update(nextDate: string, nextHour: number, nextMinute: string) {
    const nextClock = `${String(nextHour).padStart(2, "0")}:${nextMinute}`;
    setPartialClock(nextClock);
    const next = nextDate ? `${nextDate}T${nextClock}` : "";
    setDraft(next);
    onChange?.(next);
  }
  const field = "min-h-11 rounded border border-subtle bg-white p-2 text-base";
  return (
    <fieldset className="my-2 min-w-0">
      <legend className="text-sm font-medium">{label}</legend>
      {name && <input type="hidden" name={name} value={current} />}
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          className={field}
          aria-label={`${label} date`}
          type="date"
          required={required}
          value={date}
          onChange={(e) => update(e.target.value, Number(hour), minute)}
        />
        <select
          className={field}
          aria-label={`${label} hour`}
          value={Number(hour) % 12 || 12}
          onChange={(e) =>
            update(
              date,
              (Number(e.target.value) % 12) + (Number(hour) >= 12 ? 12 : 0),
              minute,
            )
          }
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          className={field}
          aria-label={`${label} minute`}
          value={minute.slice(0, 2)}
          onChange={(e) => update(date, Number(hour), e.target.value)}
        >
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(
            (m) => (
              <option key={m}>{m}</option>
            ),
          )}
        </select>
        <select
          className={field}
          aria-label={`${label} AM or PM`}
          value={Number(hour) >= 12 ? "PM" : "AM"}
          onChange={(e) =>
            update(
              date,
              (Number(hour) % 12) + (e.target.value === "PM" ? 12 : 0),
              minute,
            )
          }
        >
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
    </fieldset>
  );
}
