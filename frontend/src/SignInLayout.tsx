import { useApiQuery } from "./api-query";
import type { ReactNode } from "react";
import type { PublishedReviewPage } from "@staytrack/shared";
import StaffIcon from "./StaffIcon";
import ThemeToggle from "./ThemeToggle";

export default function SignInLayout({
  children,
  staff = false,
  reviewsEnabled = false,
}: {
  children: ReactNode;
  staff?: boolean;
  reviewsEnabled?: boolean;
}) {
  const reviews = useApiQuery<PublishedReviewPage>(
    !staff && reviewsEnabled ? "/reviews?page=1" : null,
  );
  const review = reviews.data?.reviews.find((entry) => entry.comment?.trim());

  if (staff)
    return (
      <div className="staff-signin-shell">
        <div className="staff-signin-form-panel">
          <div className="staff-signin-toolbar">
            <a className="signin-back" href="/">
              ← Back to the hotel
            </a>
            <ThemeToggle />
          </div>
          <div className="staff-signin-form-wrap">
            <a href="/" className="staff-signin-mobile-brand">
              <img
                src="/hotel/logo.webp"
                width="48"
                height="48"
                alt="Danny's Micro Hotel"
              />
            </a>
            <p className="staff-signin-eyebrow">STAYTRACK · STAFF & ADMIN</p>
            {children}
          </div>
          <p className="staff-signin-footer">
            Individual access. A shared standard of care.
          </p>
        </div>
        <aside className="staff-signin-hotel" aria-label="Danny's Micro Hotel">
          <a href="/" className="signin-brand">
            <img src="/hotel/logo.webp" width="48" height="48" alt="" />
            <span>
              Danny’s <small>MICRO HOTEL</small>
            </span>
          </a>
          <div className="staff-signin-hotel-copy">
            <p className="signin-eyebrow">BEHIND EVERY WARM WELCOME</p>
            <h2>
              Great stays.
              <br />
              Thoughtful hospitality.
            </h2>
            <p>One workspace for the people who make every stay feel right.</p>
          </div>
          <div className="staff-signin-hotel-scene">
            <figure className="staff-signin-hotel-photo">
              <img
                src="/hotel/daytime-960.webp"
                width="720"
                height="540"
                alt="Danny's Micro Hotel exterior in daylight"
              />
            </figure>
            <div className="staff-signin-glass staff-signin-glass-arrival">
              <span>
                <StaffIcon name="arrivals" />
              </span>
              <div>
                <small>FRONT DESK</small>
                <strong>Every arrival, taken care of.</strong>
              </div>
            </div>
            <div className="staff-signin-glass staff-signin-glass-rooms">
              <span>
                <StaffIcon name="stays" />
              </span>
              <div>
                <small>ROOMS & STAYS</small>
                <strong>Double Standard</strong>
                <p>Family Executive</p>
              </div>
            </div>
            <div className="staff-signin-glass staff-signin-glass-care">
              <span>
                <StaffIcon name="rooms" />
              </span>
              <div>
                <small>EVERYDAY HOTEL CARE</small>
                <strong>From check-in to checkout.</strong>
              </div>
            </div>
          </div>
          <div className="staff-signin-hotel-footer">
            <p>Your team. Your hotel. A better day at the front desk.</p>
            <span>Danny’s Micro Hotel · Staff workspace</span>
          </div>
        </aside>
      </div>
    );

  return (
    <div className="signin-shell signin-shell-compact">
      <div className="signin-form-panel">
        <a className="signin-back" href="/">
          ← Back to the hotel
        </a>
        <div className="signin-form-wrap">
          <p className="signin-form-eyebrow">
            {staff ? "STAFF WORKSPACE" : "WELCOME TO DANNY’S"}
          </p>
          {children}
        </div>
        <p className="signin-form-footer">
          {staff
            ? "Individual access. A shared standard of care."
            : "A few hours of rest. A whole lot of possibility."}
        </p>
      </div>
      <aside className="signin-brand-panel" aria-label="Danny's Micro Hotel">
        <a href="/" className="signin-brand">
          <img src="/hotel/logo.webp" width="238" height="225" alt="" />
          <span>
            Danny’s <small>MICRO HOTEL</small>
          </span>
        </a>
        <div className="signin-brand-copy">
          <p className="signin-eyebrow">
            {staff ? "BEHIND EVERY WARM WELCOME" : "YOUR TIME. YOUR STAY."}
          </p>
          <h2>
            {staff ? (
              <>
                Good stays start
                <br />
                with your team.
              </>
            ) : (
              <>
                A little rest.
                <br />A brighter day.
              </>
            )}
          </h2>
          <p>
            {staff
              ? "Bring arrivals, room readiness and everyday hotel care together."
              : "A short break or a night away. Make room for a stay that fits your day."}
          </p>
        </div>
        <div className="signin-card-scene" aria-hidden="true">
          <div className="signin-photo-card">
            <img
              src="/hotel/family-window-760.webp"
              srcSet="/hotel/family-window-420.webp 420w, /hotel/family-window-760.webp 760w, /hotel/family-window-1040.webp 1040w"
              sizes="(max-width: 52rem) 70vw, 340px"
              width="760"
              height="1013"
              alt=""
            />
          </div>
          <div className="signin-floating-card signin-floating-top">
            <span className="signin-card-symbol">↗</span>
            <div>
              <small>{staff ? "RESERVATIONS" : "ROOMS & STAYS"}</small>
              <strong>
                {staff ? "Every arrival, together" : "Stay on your time"}
              </strong>
              <span>
                {staff
                  ? "Online & walk-in bookings"
                  : "Short stays & overnight"}
              </span>
            </div>
          </div>
          <div className="signin-floating-card signin-floating-bottom">
            <span className="signin-card-symbol">⌂</span>
            <div>
              <small>{staff ? "ROOM READINESS" : "A LITTLE MORE ROOM"}</small>
              <strong>
                {staff ? "Care in every detail" : "Bring everyone along"}
              </strong>
              <span>
                {staff ? "Inspected by your team" : "Family Executive stays"}
              </span>
            </div>
          </div>
        </div>
        {reviewsEnabled && review ? (
          <figure className="signin-quote">
            <p className="signin-eyebrow">
              FROM A VERIFIED STAY · {review.stars}/5
            </p>
            <blockquote>“{review.comment}”</blockquote>
            <figcaption>
              {review.alias} <span>· Verified guest</span>
            </figcaption>
          </figure>
        ) : (
          <div className="signin-quote">
            <p className="signin-eyebrow">THE DANNY’S WAY</p>
            <p className="signin-brand-promise">
              Your time matters.
              <br />
              Make a little room for rest.
            </p>
            <p className="signin-quote-caption">Danny’s Micro Hotel</p>
          </div>
        )}
      </aside>
    </div>
  );
}
