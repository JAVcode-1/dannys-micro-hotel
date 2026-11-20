# Function Hall Reservation and Management

This specification records the 13 approved development decisions and the approved technical design following checkpoint `f4b067e`. Provisional operating defaults and staff access outside event hours require owner confirmation before production activation.

## Channels and resource

Authorized staff record walk-in, telephone and Facebook Messenger reservations in one calendar. Publish capacities, approved pricing, inclusions and inquiry channels. Public inquiries create no confirmed reservation or schedule claim. Guest self-service booking is outside the initial release.

One exclusive physical hall supports Theater Type up to 70 attendees and Room Type up to 50. Require a positive attendee count within the selected limit. Both configurations include air-conditioning, sound system and mineral water. Water quantities remain unspecified. Staff can record additional requests for manual follow-up. Requests carry no charge or fulfillment guarantee.

## Scheduling and quotes

Use Asia/Manila for calendar rules and 12-hour AM/PM display. Store exact UTC instants. Events begin and end on the same Manila calendar day. Default event hours are 8:00 AM–10:00 PM. Authorized staff configure opening, closing, minimum notice, booking horizon, preparation, cleanup, no-show grace and countdown reminders. Defaults are three hours of notice, 90 calendar days ahead, 30 minutes of preparation, 30 minutes of cleanup and one hour of no-show grace. Same-day booking is allowed. Minimum-notice overrides may apply to any otherwise eligible booking or rescheduling and require a documented reason. They do not override operating hours, booking horizon, preparation, overlap checks or payment. Record all settings changes in the audit trail. Existing confirmed events retain their booked schedule and buffer snapshots.

Guest operating hours bound the entire scheduled event. Staff preparation and cleanup may extend outside guest hours where staff access is authorized. Validate that preparation can still be accommodated before confirming a booking or rescheduling. A hall claim covers the half-open interval from preparation start to cleanup end, so touching endpoints can coexist. PostgreSQL must enforce cross-configuration exclusivity with a GiST exclusion constraint on active hall claims. Express validates the quote and claim inside a transaction. Calendar previews cannot guarantee final availability.

Compute quotes on the server using integer centavos. The three-hour base is ₱3,000 for scheduled starts from 8:00 AM to before 5:00 PM and ₱5,000 for starts at or after 5:00 PM. Starts before 8:00 AM remain unavailable for quotes or confirmation even if operating hours allow them. Add ₱1,000 per scheduled full hour beyond three hours. An event crossing 5:00 PM keeps its scheduled-start rate. Early completion does not change price or release the claim. Store immutable schedule and pricing revisions with the applicable rules, duration, rates and buffer snapshots.

## Payments, confirmation and changes

Record actual cash received and GCash independently verified in the hotel receiving account. Accept multiple partial and mixed payments. Screenshots are supporting evidence only. Hall receipts and refunds stay in hall financial records. Extend the existing private GCash reference registry to recognize a hall receipt as another mutually exclusive source. Canonicalize references using the existing normalization rules, claim the reference in the receipt transaction, and enforce global uniqueness for accommodation and hall writers. Verify both cross-module directions and concurrent submissions in isolated PostgreSQL.

Record verified receipts durably before, or independently of, a schedule action that can fail. A retry cannot book the receipt twice. Confirm only once net verified payment meets the ceiling-rounded 50% threshold and a valid claim can be committed. Confirmation and claim acquisition commit atomically. An unpaid or below-threshold inquiry has no hold. If a funded action cannot get the slot or otherwise fails validation, retain the receipt, leave any existing claim intact, and flag unresolved payment for an alternative schedule or approved refund.

Rescheduling is available only before both scheduled and actual start. It requires a documented reason and validates the new schedule against operating hours, notice, horizon, buffers and availability. Reprice from the new scheduled start and duration, retain the previous revisions, and carry verified payments forward net of completed refunds. Require 50% of the revised total before committing the atomic move and full payment before actual start. Flag overpayment for manual resolution. There is no automatic rescheduling fee.

Extensions are available for confirmed or in-progress events before the current scheduled end. Require a documented reason, full verified payment of the revised total, and validation of operating hours and the revised protected interval including cleanup. Add full hours to the current scheduled end at ₱1,000 per hour and retain the current booked base rate. Preserve revision history. A failed extension leaves the original claim and all verified payments intact. A successful extension updates the countdown target.

## Lifecycle, readiness and refunds

| Action | Allowed state and effect |
|---|---|
| Confirm | Inquiry to confirmed after verified deposit and successful claim. A failed attempt leaves the inquiry and receipts intact. |
| Reschedule | Confirmed to confirmed, before scheduled and actual start. Atomically replace the claim and append a revision. |
| Start | Confirmed to in progress. Require verified collections less completed refunds to cover the current total, and require the hall to be vacant, clean and ready. Record the actual start. |
| Extend | Confirmed or in progress, before scheduled end. Keep lifecycle state and atomically append the paid schedule and pricing revision. |
| Complete | In progress to completed. Record actual completion, flag an unapproved overrun, and retain the protected schedule. Track physical cleanup and readiness separately. |
| Mark no-show | Confirmed, without an actual start, after the grace period. Require a reason. Keep the claim by default. |
| Release no-show claim early | Separate audited action after no-show, subject to hall readiness. Later bookings still require their full valid preparation and protected intervals. |
| Cancel | Open inquiry or confirmed reservation before actual start, with a documented reason. Release any active claim when cancellation takes effect. |

Cancelled, completed and no-show reservations cannot start or extend. Staff-recorded actual start and completion are required. Late arrival does not shift the scheduled end. Countdown expiry triggers an alert rather than a lifecycle transition. A current event occupying the next preparation window triggers a conflict alert. Preserve both schedules and prohibit the next start until the hall is actually clear, clean and ready. Serialize readiness, occupancy and start changes at the hall resource. Record unauthorized overruns without extending the claim. Manual overtime charges require approval, a documented reason and audit. Automatic partial-hour proration, rounding and shorter packages are outside scope.

Refund approval and completion are separate from cancellation, no-show and rescheduling. Support full, partial and no-refund resolutions with reasons. Outstanding approval amounts plus completed refunds cannot exceed verified collections. Serialize receipt, refund and start actions on the same reservation so start always sees the authoritative current balance. An approval alone moves no cash and cannot unlock start. A completed transfer decreases net verified payment immediately. Require staff verification of the actual cash return or GCash transfer and record its actual completion date. Preserve the original receipts and the refund history. There is no automatic penalty schedule or money transfer.

## Architecture, privacy and evidence

Use the existing React Royal Horizon shells, Express API, individual active-staff authorization and Supabase-managed PostgreSQL. Keep hall reservations, availability claims, readiness, financial records and reporting separate from accommodation. The shared GCash identity registry enforces receipt uniqueness across modules and does not combine their financial records. Hall bookings do not affect room inventory or H03-B totals.

Use private hall tables and least-privilege grants. Enforce foreign keys, immutable revisions and receipts, legal transitions, and unique actor-scoped idempotency keys bound to requests. Recheck active staff membership on sensitive actions. Within each mutation transaction record the actor, database timestamp, reason where required, affected record and prior/new state or revision. Keep guest details, payment references and evidence out of public projections. Retain failed confirmation or change resolution flags without rolling back verified receipts.

Report hall-only gross verified collections, completed refunds and Net Collections by actual transaction date and Manila period. Report reservations separately from utilization and distinguish event time from setup and cleanup. Reconcile reports against hall records and test isolation against accommodation totals.

## Sequence and acceptance

1. Implement scheduling and quotes. Test capacity, pricing boundaries, pre-8:00 AM rejection, Manila date and horizon boundaries, notice override, buffer snapshots, and concurrent overlapping claims across both configurations.
2. Add staff reservations, manual payments and public information. Test partial and mixed deposits, global GCash uniqueness, verified-payment preservation after slot loss, atomic confirmation and audit retries.
3. Add event operations, rescheduling, extensions, cancellation and refunds. Test illegal transitions, readiness blocking, on-time and late starts, countdown expiry, approved extensions, failed atomic moves, no-show release, refund caps under concurrency and refund versus event-start balance checks.
4. Add separate hall reports and verify reconciliation, authorization, privacy and accommodation isolation. Run build, typecheck, lint, formatting, full application tests and isolated PostgreSQL tests. Use native execution with one final independent review after implementation approval.

Keep hosted Supabase untouched and candidate migrations unapplied there. Keep existing live transaction and H04 gates closed and preserve deployment blockers. Keep hall activation gated pending owner confirmation and acceptance. UI Refinement, hotel photographs and the official GCash QR image remain outside scope.
