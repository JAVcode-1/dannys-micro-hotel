import { useEffect, useState } from "react";
import { apiBase } from "./staff-auth";

type Package = {
  code: string;
  name: string;
  standard_occupancy_note: string | null;
  duration_minutes: number;
  price_centavos: number;
};

export default function Catalog({
  hallEnabled = false,
}: {
  hallEnabled?: boolean;
}) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/catalog`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setPackages((await response.json()) as Package[]);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Rates are temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="guest-catalog text-main">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-primary">
          Our stays
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Rooms and rates
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Choose your stay length. You can book rooms and the Function Hall
          together when online booking is available.
        </p>
        <a
          href="/book"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-booking px-5 font-bold text-main"
        >
          Plan your reservation
        </a>
        {error && (
          <p role="status" className="mt-8 text-red-700">
            {error}
          </p>
        )}
        {!error && packages.length === 0 && (
          <p role="status" className="mt-8 text-muted">
            Loading current rates…
          </p>
        )}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {["double_standard", "family_executive"].map((code) => {
            const rows = packages.filter((item) => item.code === code);
            if (!rows.length) return null;
            return (
              <section
                key={code}
                className="guest-rate-card rounded-3xl border border-subtle bg-white p-7 shadow-sm sm:p-9"
              >
                <figure className="guest-room-photo">
                  <img
                    src={
                      code === "double_standard"
                        ? "/hotel/standard-760.webp"
                        : "/hotel/family-760.webp"
                    }
                    alt={
                      code === "double_standard"
                        ? "Double Standard room at Danny’s Micro Hotel"
                        : "Family Executive room at Danny’s Micro Hotel"
                    }
                    width="760"
                    height="1013"
                    loading="lazy"
                  />
                </figure>
                <h2 className="text-2xl font-bold">{rows[0].name}</h2>
                <p className="mt-2 text-sm font-semibold text-primary">
                  {code === "double_standard"
                    ? "Usually comfortable for 2 guests"
                    : "Usually comfortable for 3 guests"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Guidance only; staff can review other guest counts.
                </p>
                <ul className="mt-8 divide-y divide-subtle">
                  {rows.map((item) => (
                    <li
                      key={item.duration_minutes}
                      className="flex items-center justify-between py-4"
                    >
                      <span>{item.duration_minutes / 60} hours</span>
                      <strong className="text-xl text-primary">
                        ₱{(item.price_centavos / 100).toLocaleString("en-PH")}
                      </strong>
                    </li>
                  ))}
                </ul>
                <a
                  href={`/book?category=${code}`}
                  className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-booking px-5 font-bold text-main"
                >
                  Book {rows[0].name}
                </a>
              </section>
            );
          })}
        </div>
        {hallEnabled && (
          <section className="mt-6 rounded-3xl border border-subtle bg-white p-7 sm:p-9">
            <h2 className="text-2xl font-bold">Function Hall</h2>
            <p className="mt-3 text-muted">
              One exclusive hall: Theater Type for up to 70 attendees, or Room
              Type for up to 50.
            </p>
            <p className="mt-4">
              Three-hour package: <strong>₱3,000.00</strong> for starts from
              8:00 AM to before 5:00 PM, or <strong>₱5,000.00</strong> for other
              start times. Additional full hours:{" "}
              <strong>₱1,000.00 each</strong>.
            </p>
            <div className="mt-5 flex flex-wrap gap-4">
              <a
                href="/book?service=hall&setup=theater"
                className="inline-flex min-h-11 items-center rounded-xl bg-booking px-5 font-bold text-main"
              >
                Book Theater Type
              </a>
              <a
                href="/book?service=hall&setup=room"
                className="inline-flex min-h-11 items-center font-semibold text-primary"
              >
                Book Room Type
              </a>
              <a
                href="/function-hall"
                className="inline-flex min-h-11 items-center font-semibold text-primary"
              >
                Hall details
              </a>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
