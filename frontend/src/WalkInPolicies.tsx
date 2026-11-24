import { useId, useState } from "react";
import StaffIcon from "./StaffIcon";

const highlights = [
  [
    "Payment",
    "Cash, staff-verified GCash or mixed payments. Collect at least 50% before normal room access.",
    "payments",
  ],
  [
    "Room access",
    "Reserve capacity first. Staff must assign a Ready room and record check-in before room access.",
    "arrivals",
  ],
  [
    "Stay time",
    "Purchased time starts at recorded staff check-in. Countdown zero never checks a guest out automatically.",
    "clock",
  ],
  [
    "Extensions",
    "Staff approval and availability checks are required. Collect at least 50% of the extension charge before activation.",
    "changes",
  ],
  [
    "Checkout",
    "Settle the outstanding balance before checkout, or record an authorized unpaid departure with a reason.",
    "logout",
  ],
  [
    "Cancellations & refunds",
    "Review eligibility with the guest. Staff process any eligible GCash refund manually.",
    "audit",
  ],
  [
    "Hotel rules",
    "No smoking. Occupancy guidance is advisory; minor eligibility and safety requirements need staff review.",
    "rooms",
  ],
] as const;

export default function WalkInPolicies({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return (
    <section
      className="staff-booking-policies"
      aria-label="Walk-in booking policies"
    >
      <div className="staff-policy-heading">
        <h3>Booking policies</h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          aria-label={`${expanded ? "Hide" : "Show"} booking policies`}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      <div id={contentId} hidden={!expanded}>
        <ul>
          {highlights.map(([title, description, icon]) => (
            <li key={title}>
              <span className="staff-policy-icon">
                <StaffIcon name={icon} />
              </span>
              <div>
                <h4>{title}</h4>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ul>
        <details>
          <summary>Read the full policy</summary>
          <p>{text}</p>
        </details>
      </div>
    </section>
  );
}
