export const hourPattern = /^(?:0?[1-9]|1[0-2])$/;
export const minutePattern = /^[0-5]?[0-9]$/;
export const hours = Array.from({ length: 12 }, (_, index) =>
  String(index + 1),
);
export const minutes = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

const durationHours = Array.from({ length: 22 }, (_, index) => String(index + 3));
const parts = {
  hour: {
    pattern: hourPattern,
    options: hours,
    hint: "Enter an hour from 1 to 12.",
  },
  minute: {
    pattern: minutePattern,
    options: minutes,
    hint: "Enter minutes from 0 to 59.",
  },
  duration: {
    pattern: /^(?:[3-9]|1[0-9]|2[0-4])$/,
    options: durationHours,
    hint: "Enter 3 to 24 whole hours.",
  },
};

export function manilaClock(hour: string, minute: string, period: string) {
  if (!hourPattern.test(hour) || !minutePattern.test(minute)) return "";
  const hour24 = (Number(hour) % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export const timePickerButton =
  "absolute bottom-0 right-0 flex h-11 w-10 cursor-pointer items-center justify-center rounded-lg text-muted focus-within:ring-2 focus-within:ring-primary";
export const timePickerInputPadding = { paddingInlineEnd: "2.5rem" };

export function TimePickerChevron() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none -mt-1 size-2 rotate-45 border-b-2 border-r-2 border-current"
    />
  );
}

export default function TimePartInput({
  part,
  label,
  value,
  onChange,
  className,
  required = true,
  invalid = false,
}: {
  part: keyof typeof parts;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  required?: boolean;
  invalid?: boolean;
}) {
  const { pattern, options, hint } = parts[part];
  return (
    <span className="relative grid min-w-0">
      <input
        aria-label={label}
        aria-invalid={invalid || (value !== "" && !pattern.test(value))}
        className={className + " w-full min-w-0"}
        style={timePickerInputPadding}
        inputMode="numeric"
        pattern={pattern.source}
        title={hint}
        maxLength={2}
        size={2}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={timePickerButton}>
        <select
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value=""
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>Choose {part}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {part === "duration" ? `${option} hours` : option}
            </option>
          ))}
        </select>
        <TimePickerChevron />
      </span>
    </span>
  );
}
