import { useEffect, useState } from "react";
import { apiBase } from "./staff-auth";
import OccupancyGuide from "./OccupancyGuide";

type Package = {
  code: string;
  name: string;
  standard_occupancy_note: string | null;
  duration_minutes: number;
  price_centavos: number;
};

export default function Catalog() {
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
    <section className="bg-canvas py-6 text-main">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle pb-6">
          <a href="/" className="font-bold text-primary">
            DANNY'S MICRO HOTEL
          </a>
          <a
            href="/verify"
            className="rounded-xl bg-booking px-5 py-3 font-bold text-main"
          >
            Guest access
          </a>
        </header>
        <p className="mt-14 text-sm font-bold uppercase tracking-[.2em] text-primary">
          Our stays
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Rooms and rates
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Choose the stay length that suits you. Online booking is not open yet.
        </p>
        <a
          href="/book"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-booking px-5 font-bold text-main"
        >
          Plan a multi-room stay
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
                className="rounded-3xl border border-subtle bg-white p-7 shadow-sm sm:p-9"
              >
                <h2 className="text-2xl font-bold">{rows[0].name}</h2>
                {rows[0].standard_occupancy_note && (
                  <p className="mt-2 text-sm text-muted">
                    {rows[0].standard_occupancy_note}
                  </p>
                )}
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
              </section>
            );
          })}
        </div>
        <OccupancyGuide />
      </div>
    </section>
  );
}
