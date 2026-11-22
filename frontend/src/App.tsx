import { useState } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  NavLink,
  Navigate,
  Outlet,
  useParams,
  useLocation,
} from "react-router";
import "./guest-booking.css";
import { staffRoutes } from "./StaffRoutes";
import GuestAccess from "./GuestAccess";
import Catalog from "./Catalog";
import BookingPlanner from "./BookingPlanner";
import { guestAuth, staffAuth, staffInviteCallback } from "./staff-auth";
import GuestReviews from "./GuestReviews";
import GuestReviewAccess from "./GuestReviewAccess";
import { HallInformation } from "./HallDesk";
import LandingPage from "./LandingPage";
import { GuestSessionProvider, useGuestSession } from "./GuestSession";
import {
  GuestReservationsPage,
  GuestReservationPage,
} from "./GuestReservations";
import { PaymentReviewPreview } from "./StaffPaymentReviews";
import { WalkInPreview } from "./WalkInDesk";
import { StayChangesPreview } from "./StayChangesDesk";
import { ReschedulePreview } from "./RescheduleDesk";
import CancellationDesk from "./CancellationDesk";
import CheckInDesk from "./CheckInDesk";
import StayMonitor from "./StayMonitor";

type AppOptions = {
  reviewsEnabled?: boolean;
  hallEnabled?: boolean;
  staffAuthClient?: typeof staffAuth;
  guestAuthClient?: typeof guestAuth;
};
function GuestLayout() {
  const session = useGuestSession();
  const { pathname } = useLocation();
  const bookingPage =
    /^\/(book|rooms|function-hall|verify|login|register|reservations)(\/|$)/.test(pathname);
  const step =
    pathname === "/book" ? 1
      : ["/verify", "/login", "/register"].includes(pathname) ? 2
        : /^\/reservations\/[^/]+\/payment$/.test(pathname) ? 3 : 0;
  const [message, setMessage] = useState("");
  return (
    <div className="guest-journey min-h-svh bg-canvas text-main">
      <a href="#guest-main" className="guest-skip">Skip to main content</a>
      <header className="guest-header print:hidden">
        <nav
          aria-label="Guest navigation"
          className="guest-navigation"
        >
          <Link to="/" className="guest-brand">
            <img src="/hotel/logo-full.webp" alt="" width="64" height="48" />
            <span>
              Danny’s <small>MICRO HOTEL</small>
            </span>
          </Link>
          <div className="guest-navigation-links">
            <NavLink to="/rooms">Rooms &amp; rates</NavLink>
            <NavLink to="/function-hall">Function Hall</NavLink>
            <NavLink to="/reservations">My bookings</NavLink>
            {session?.access.status === "authenticated" ? (
              <button
                onClick={() =>
                  void session
                    .signOut()
                    .catch(() => setMessage("Sign-out failed. Try again."))
                }
              >
                Sign out
              </button>
            ) : null}
          </div>
          <NavLink to="/book" className="guest-book-now">
            Book now
          </NavLink>
        </nav>
      </header>
      {message && (
        <p role="alert" className="guest-session-message">{message}</p>
      )}
      {step > 0 && (
        <div className="guest-progress-wrap">
          <ol className="guest-progress" aria-label="Booking steps">
            {["Choose your stay", "Verify email", "Payment & review"].map((label, index) => (
              <li key={label} aria-current={step === index + 1 ? "step" : undefined}>
                <span className="guest-step-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <main
        id="guest-main"
        className={bookingPage
          ? `guest-content guest-booking-area${/^\/(rooms|verify|login|register|function-hall)\/?$/.test(pathname) ? " guest-compact-top" : ""}`
          : "mx-auto max-w-6xl px-4 py-8"}
      >
        <Outlet />
      </main>
      {bookingPage && (
        <footer className="guest-footer print:hidden">
          <span>Danny’s Micro Hotel</span>
          <span>All schedules shown in Philippine time.</span>
          <Link to="/reservations">
            Manage your reservation <span aria-hidden="true">↗</span>
          </Link>
        </footer>
      )}
    </div>
  );
}
function ReservationRoute({
  payment = false,
  reviewsEnabled = false,
}: {
  payment?: boolean;
  reviewsEnabled?: boolean;
}) {
  const { id } = useParams();
  return (
    <GuestReservationPage
      reservationId={id ?? ""}
      payment={payment}
      reviewsEnabled={reviewsEnabled}
    />
  );
}
function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p>This address does not match an available page.</p>
      <Link to="/">Return home</Link>
    </section>
  );
}

export default function App({
  reviewsEnabled = false,
  hallEnabled = false,
  staffAuthClient,
  guestAuthClient,
}: AppOptions = {}) {
  const [invitePath] = useState(() => {
    if (typeof window === "undefined") return null;
    const { hash, search, pathname } = window.location;
    return staffInviteCallback ||
      new URLSearchParams(hash.slice(1)).get("type") === "invite" ||
      new URLSearchParams(search).get("type") === "invite"
      ? pathname
      : null;
  });
  if (typeof window === "undefined")
    return (
      <LandingPage reviewsEnabled={reviewsEnabled} hallEnabled={hallEnabled} />
    );
  return (
    <BrowserRouter>
      <Routes>
        {staffRoutes({
          authClient: staffAuthClient,
          reviewsEnabled,
          hallEnabled,
          invitePath,
        })}
        <Route
          element={
            <GuestSessionProvider authClient={guestAuthClient}>
              <Outlet />
            </GuestSessionProvider>
          }
        >
          <Route
            path="/"
            element={
              <LandingPage
                reviewsEnabled={reviewsEnabled}
                hallEnabled={hallEnabled}
              />
            }
          />
          <Route element={<GuestLayout />}>
            <Route
              path="/rooms"
              element={<Catalog hallEnabled={hallEnabled} />}
            />
            <Route
              path="/book"
              element={<BookingPlanner hallEnabled={hallEnabled} />}
            />
            {["/verify", "/login", "/register"].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <GuestAccess
                    authClient={guestAuthClient}
                    reviewsEnabled={reviewsEnabled}
                  />
                }
              />
            ))}
            <Route
              path="/reservations"
              element={
                <GuestReservationsPage reviewsEnabled={reviewsEnabled} />
              }
            />
            <Route
              path="/reservations/:id"
              element={<ReservationRoute reviewsEnabled={reviewsEnabled} />}
            />
            <Route
              path="/reservations/:id/payment"
              element={
                <ReservationRoute payment reviewsEnabled={reviewsEnabled} />
              }
            />
            <Route
              path="/function-hall"
              element={
                hallEnabled ? (
                  <HallInformation />
                ) : (
                  <p>Function Hall is unavailable pending activation.</p>
                )
              }
            />
            <Route
              path="/reviews"
              element={
                reviewsEnabled ? (
                  <GuestReviews />
                ) : (
                  <p>Reviews are unavailable pending activation.</p>
                )
              }
            />
            <Route
              path="/reviews/submit"
              element={
                reviewsEnabled ? (
                  <GuestReviewAccess />
                ) : (
                  <p>Reviews are unavailable pending activation.</p>
                )
              }
            />
            <Route
              path="/feedback/private"
              element={
                reviewsEnabled ? (
                  <GuestReviewAccess initial="feedback" />
                ) : (
                  <p>Private feedback is unavailable pending activation.</p>
                )
              }
            />
            <Route path="/payment-preview" element={<Navigate to="/book" replace />} />
            {import.meta.env?.DEV && (
              <>
                <Route
                  path="/staff/payment-review-preview"
                  element={<PaymentReviewPreview />}
                />
                <Route
                  path="/staff/walkin-preview"
                  element={<WalkInPreview />}
                />
                <Route
                  path="/staff/stay-changes-preview"
                  element={<StayChangesPreview />}
                />
                <Route
                  path="/staff/reschedule-preview"
                  element={<ReschedulePreview />}
                />
                <Route
                  path="/staff/check-in-preview"
                  element={<CheckInDesk />}
                />
                <Route path="/staff/stay-preview" element={<StayMonitor />} />
                <Route
                  path="/staff/cancellation-preview"
                  element={<CancellationDesk />}
                />
              </>
            )}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
