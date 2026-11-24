import { useState } from "react";
import TimePartInput, { manilaClock } from "./TimePartInput";

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
  const [draft, setDraft] = useState<{
    serialized: string;
    date: string;
    hour: string;
    minute: string;
    period: string;
  } | null>(null);
  const current = value ?? draft?.serialized ?? "";
  const [savedDate = "", savedClock = "00:00"] = current.split("T");
  const [savedHour, savedMinute = "00"] = savedClock.split(":");
  const hour24 = Number(savedHour);
  const { date, hour, minute, period } =
    draft?.serialized === current
      ? draft
      : {
          date: savedDate,
          hour: String(hour24 % 12 || 12),
          minute: savedMinute.slice(0, 2),
          period: hour24 >= 12 ? "PM" : "AM",
        };

  function update(
    nextDate: string,
    nextHour: string,
    nextMinute: string,
    nextPeriod: string,
  ) {
    const clock = manilaClock(nextHour, nextMinute, nextPeriod);
    const serialized = nextDate && clock ? `${nextDate}T${clock}` : "";
    setDraft({
      serialized,
      date: nextDate,
      hour: nextHour,
      minute: nextMinute,
      period: nextPeriod,
    });
    onChange?.(serialized);
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
          onChange={(e) => update(e.target.value, hour, minute, period)}
        />
        <TimePartInput
          part="hour"
          label={`${label} hour`}
          className={field}
          required={required || Boolean(date)}
          value={hour}
          onChange={(next) => update(date, next, minute, period)}
        />
        <TimePartInput
          part="minute"
          label={`${label} minute`}
          className={field}
          required={required || Boolean(date)}
          value={minute}
          onChange={(next) => update(date, hour, next, period)}
        />
        <select
          className={field}
          aria-label={`${label} AM or PM`}
          value={period}
          onChange={(e) => update(date, hour, minute, e.target.value)}
        >
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
    </fieldset>
  );
}
