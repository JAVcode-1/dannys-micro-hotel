import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { staffRoutes } from "./StaffRoutes";
import { StayChangesPreview } from "./StayChangesDesk";
import CancellationDesk from "./CancellationDesk";
import { ReschedulePreview } from "./RescheduleDesk";
import GuestAccess from "./GuestAccess";
import Catalog from "./Catalog";
import BookingPlanner from "./BookingPlanner";
import { PaymentPreview } from "./GuestPayment";
import { PaymentReviewPreview } from "./StaffPaymentReviews";
import { WalkInPreview } from "./WalkInDesk";
import StayMonitor from "./StayMonitor";
import CheckInDesk from "./CheckInDesk";
import { staffAuth, staffInviteCallback } from "./staff-auth";
import GuestReviews from "./GuestReviews";
import GuestReviewAccess from "./GuestReviewAccess";
import { HallInformation } from "./HallDesk";
import LandingPage from "./LandingPage";

type AppOptions = {
  reviewsEnabled?: boolean;
  hallEnabled?: boolean;
  staffAuthClient?: typeof staffAuth;
};

export default function App({
  reviewsEnabled = false,
  hallEnabled = false,
  staffAuthClient,
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
  const publicPages = (
    <PublicPages reviewsEnabled={reviewsEnabled} hallEnabled={hallEnabled} />
  );

  if (typeof window === "undefined") return publicPages;
  return (
    <BrowserRouter>
      <Routes>
        {staffRoutes({
          authClient: staffAuthClient,
          reviewsEnabled,
          hallEnabled,
          invitePath,
        })}
        <Route path="*" element={publicPages} />
      </Routes>
    </BrowserRouter>
  );
}

function PublicPages({
  reviewsEnabled,
  hallEnabled,
}: Required<Pick<AppOptions, "reviewsEnabled" | "hallEnabled">>) {
  if (
    hallEnabled &&
    typeof window !== "undefined" &&
    window.location.pathname === "/function-hall"
  )
    return <HallInformation />;
  if (reviewsEnabled && typeof window !== "undefined") {
    const path = window.location.pathname;
    if (
      path === "/reviews" ||
      path === "/reviews/submit" ||
      path === "/feedback/private"
    ) {
      return (
        <main className="min-h-svh bg-canvas px-6 py-12 text-main">
          {path === "/reviews" ? (
            <GuestReviews />
          ) : (
            <GuestReviewAccess
              initial={path === "/feedback/private" ? "feedback" : "review"}
            />
          )}
        </main>
      );
    }
  }
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/staff/stay-changes-preview"
  )
    return (
      <main className="min-h-svh bg-canvas p-6 text-main">
        <StayChangesPreview />
      </main>
    );
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/staff/reschedule-preview"
  )
    return (
      <main className="min-h-svh bg-canvas p-6 text-main">
        <ReschedulePreview />
      </main>
    );
  if (
    typeof window !== "undefined" &&
    ["/verify", "/login", "/register"].includes(window.location.pathname)
  )
    return (
      <main className="min-h-svh bg-canvas px-6 py-16 text-main">
        <GuestAccess reviewsEnabled={reviewsEnabled} />
      </main>
    );
  if (typeof window !== "undefined" && window.location.pathname === "/rooms")
    return <Catalog />;
  if (typeof window !== "undefined" && window.location.pathname === "/book")
    return <BookingPlanner />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/payment-preview"
  )
    return <PaymentPreview />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/staff/payment-review-preview"
  )
    return <PaymentReviewPreview />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/staff/walkin-preview"
  )
    return <WalkInPreview />;
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/staff/check-in-preview"
  )
    return (
      <main className="min-h-svh bg-canvas p-6 text-main">
        <CheckInDesk />
      </main>
    );
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/staff/stay-preview"
  )
    return (
      <main className="min-h-svh bg-canvas p-6 text-main">
        <StayMonitor />
      </main>
    );
  if (
    typeof window !== "undefined" &&
    window.location.pathname === "/staff/cancellation-preview"
  )
    return (
      <main className="min-h-svh bg-canvas p-6 text-main">
        <CancellationDesk />
      </main>
    );
  return (
    <LandingPage reviewsEnabled={reviewsEnabled} hallEnabled={hallEnabled} />
  );
}
