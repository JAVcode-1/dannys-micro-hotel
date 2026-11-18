import React from "react";
import { apiBase } from "./staff-auth";

type Result = {
  advisory: string | null;
  extraBedCentavos: number;
  legalLimitVerified: boolean;
};

export default function OccupancyGuide() {
  const [categoryCode, setCategory] = React.useState("double_standard");
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(0);
  const [extraBed, setExtraBed] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [message, setMessage] = React.useState("");
  async function check(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    try {
      const response = await fetch(`${apiBase}/occupancy-advisory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryCode, adults, children, extraBed }),
      });
      if (!response.ok) throw new Error();
      setResult((await response.json()) as Result);
      setMessage("");
    } catch {
      setMessage("Occupancy guidance is unavailable.");
    }
  }
  return (
    <section className="mt-10 rounded-3xl border border-subtle bg-lavender p-6 sm:p-8">
      <h2 className="text-2xl font-bold">Plan your room</h2>
      <p className="mt-2 text-sm text-muted">
        Usual occupancy is guidance only. Final suitability and safety
        requirements need staff review.
      </p>
      <form
        onSubmit={(event) => void check(event)}
        className="mt-6 grid gap-4 sm:grid-cols-2"
      >
        <label className="text-sm font-medium">
          Room type
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white px-3"
            value={categoryCode}
            onChange={(event) => {
              setCategory(event.target.value);
              setExtraBed(false);
              setResult(null);
            }}
          >
            <option value="double_standard">Double Standard</option>
            <option value="family_executive">Family Executive</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Adults
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white px-3"
            type="number"
            min="1"
            value={adults}
            onChange={(event) => setAdults(Number(event.target.value))}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Children
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white px-3"
            type="number"
            min="0"
            value={children}
            onChange={(event) => setChildren(Number(event.target.value))}
            required
          />
        </label>
        {categoryCode === "family_executive" && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={extraBed}
              onChange={(event) => setExtraBed(event.target.checked)}
            />
            One extra bed · ₱100 once per continuous stay
          </label>
        )}
        <button className="min-h-11 rounded-xl bg-booking px-5 font-bold text-main">
          Check guidance
        </button>
      </form>
      {result && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-white p-4 text-sm text-main"
        >
          {result.advisory ?? "Within the usual occupancy guidance."}{" "}
          {result.extraBedCentavos > 0 &&
            "Extra bed: ₱100 once per continuous stay. Stock is pending confirmation."}{" "}
          Legal and fire-safety maximum has not been verified.
        </p>
      )}
      {message && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {message}
        </p>
      )}
    </section>
  );
}
