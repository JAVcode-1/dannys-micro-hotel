import StaffLogin from "./StaffLogin";
import GuestAccess from "./GuestAccess";
import Catalog from "./Catalog";
import { staffInviteCallback } from "./staff-auth";

export default function App() {
  const inviteCallback =
    staffInviteCallback ||
    (typeof window !== "undefined" &&
      (new URLSearchParams(window.location.hash.slice(1)).get("type") ===
        "invite" ||
        new URLSearchParams(window.location.search).get("type") === "invite"));
  if (
    typeof window !== "undefined" &&
    (window.location.pathname === "/staff" ||
      window.location.pathname === "/staff/rooms" ||
      window.location.pathname === "/staff/settings" ||
      inviteCallback)
  )
    return (
      <main className="min-h-svh bg-canvas px-6 py-16 text-main">
        <StaffLogin />
      </main>
    );
  if (
    typeof window !== "undefined" &&
    ["/verify", "/login", "/register"].includes(window.location.pathname)
  )
    return (
      <main className="min-h-svh bg-canvas px-6 py-16 text-main">
        <GuestAccess />
      </main>
    );
  if (typeof window !== "undefined" && window.location.pathname === "/rooms")
    return <Catalog />;
  return (
    <main className="min-h-svh bg-canvas px-6 py-8 text-main sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-16">
        <header className="flex items-center justify-between border-b border-subtle pb-5">
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-xl bg-primary font-bold text-white"
              aria-hidden="true"
            >
              D
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight text-primary">
                DANNY'S MICRO HOTEL
              </p>
              <p className="text-xs text-muted">StayTrack</p>
            </div>
          </div>
          <span className="rounded-full bg-selected px-3 py-1 text-xs font-semibold text-primary">
            <a href="/rooms">Rooms and rates</a>
          </span>
        </header>

        <section className="grid items-center gap-10 rounded-3xl border border-subtle bg-white p-8 shadow-sm sm:p-12 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Danny's Royal Horizon
            </p>
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              A clearer way to welcome every stay.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted">
              The StayTrack foundation is ready. Booking and staff tools will
              arrive in later phases.
            </p>
            <div className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-booking px-5 font-bold text-main">
              Coming soon
            </div>
          </div>
          <div className="relative min-h-64 overflow-hidden rounded-2xl bg-lavender p-6">
            <div
              className="absolute -right-14 -top-14 size-52 rounded-full border-[28px] border-primary/10"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-20 -left-12 size-60 rounded-full bg-primary/10"
              aria-hidden="true"
            />
            <div className="relative flex h-full min-h-52 flex-col justify-end rounded-xl border border-white/80 bg-white/75 p-6">
              <span className="text-sm font-semibold text-primary">
                StayTrack
              </span>
              <span className="mt-2 text-2xl font-bold tracking-tight">
                Thoughtful stays start here.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
