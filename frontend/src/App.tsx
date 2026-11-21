import { useState } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  Outlet,
  useParams,
} from "react-router";
import { staffRoutes } from "./StaffRoutes";
import GuestAccess from "./GuestAccess";
import Catalog from "./Catalog";
import BookingPlanner from "./BookingPlanner";
import { staffAuth, staffInviteCallback } from "./staff-auth";
import GuestReviews from "./GuestReviews";
import GuestReviewAccess from "./GuestReviewAccess";
import { HallInformation } from "./HallDesk";
import LandingPage from "./LandingPage";
import { GuestSessionProvider, useGuestSession } from "./GuestSession";
import {
  GuestReservationsPage,
  GuestReservationPage,
} from "./GuestReservations";
import { PaymentPreview } from "./GuestPayment";
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
  guestAuthClient?: typeof staffAuth;
};
function GuestLayout() {
  const session = useGuestSession();
  const [message, setMessage] = useState("");
  return (
    <div className="min-h-svh bg-canvas text-main">
      <header className="border-b border-subtle bg-white px-4 py-4 print:hidden">
        <nav
          aria-label="Guest navigation"
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 text-primary"
        >
          <Link to="/" className="font-bold">
            Danny’s Micro Hotel
          </Link>
          <Link to="/rooms">Rooms and rates</Link>
          <Link to="/function-hall">Function Hall</Link>
          <Link to="/reviews">Reviews</Link>
          <Link to="/book">Book a room</Link>
          <Link to="/reservations">My reservations</Link>
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
          ) : (
            <Link to="/verify">Verify email</Link>
          )}
        </nav>
      </header>
      {message && <p role="alert">{message}</p>}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
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
            <Route path="/rooms" element={<Catalog />} />
            <Route path="/book" element={<BookingPlanner />} />
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
            {import.meta.env?.DEV && (
              <>
                <Route path="/payment-preview" element={<PaymentPreview />} />
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
