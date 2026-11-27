---
tags: [requirements, source-of-truth]
status: approved-baseline-with-pending-settings
---
# 02 — Business & Functional Requirements

## Function Hall status and scheduled availability

Staff can mark the hall ready or take it out of service until a specified Manila date and time. The system derives reservation and event-in-progress status from the Hall calendar. An out-of-service period shares the same overlap protection as bookings and cannot replace an existing reservation or hold. The hall needs preparation after an event or an out-of-service period until staff mark it ready. Guests see whether their selected date and time is available. Current Hall status does not confirm a future slot.

## Function Hall walk-in start and payment

A confirmed Function Hall walk-in may start during its booked interval when the hall is ready and vacant and at least 50% of the price remains covered by verified payment after refunds and refund approvals. Staff can collect the outstanding balance separately. Full verified payment is still required to start events booked through other channels.

## Function Hall booking hours and package pricing

Owner approved same-day and overnight Function Hall bookings without a daily opening, closing, or minimum advance-notice cutoff. The start time in Asia/Manila selects the three-hour package. Starts from 8:00 AM until before 5:00 PM cost ₱3,000, and all other starts cost ₱5,000. Each additional full hour costs ₱1,000. Past starts are ineligible. Short-notice starts within the setup buffer require a Ready Hall, and all bookings still protect setup and cleanup against overlap. The existing advance booking horizon and payment verification still apply. This supersedes earlier provisional hours and notice statements.

## Unified Online Booking - UB-01 through UB-06, 2026-11-21

The owner's implementation request resolves the earlier mixed-booking policy questions. This section supersedes older statements below that describe these decisions as pending or restrict customer Hall bookings to staff inquiries. Implementation and acceptance evidence are recorded separately in [[unified-online-booking-requirements-sync]].

- **UB-01:** All online accommodation, Hall-only and combined reservations require 100% upfront verified payment. Staff-managed Hall reservations retain their existing minimum 50% deposit.
- **UB-02:** One full GCash transaction and a private screenshot of the receipt cover the online reservation. Staff verify the actual transaction in the hotel's GCash ledger and record its reference. Keep one authoritative payment and item allocations, separate room/Hall reporting and global reference uniqueness.
- **UB-03:** Check every selected resource and obtain all room/Hall claims atomically. One 30-minute proof deadline applies. Timely proof protects every selected item until staff resolves verification; otherwise expire all initial holds together. Preserve paid-late reconciliation and manual refund safeguards.
- **UB-04:** Staff verify the full amount and confirm all items atomically. The same persisted reservation appears in staff management without re-entry. Generate one itemized confirmation and enqueue its email; retain 15-minute review target and 30/60-minute escalation. Assignment, check-in and actual event start remain staff actions.
- **UB-05:** Free online cancellation ends at one hour after staff confirmation or that item's actual room check-in/Hall start, whichever is earlier. Cancel/refund independently, release only the cancelled capacity and preserve siblings. GCash refunds are manual, itemized, idempotent and bounded by attributable verified payments.
- **UB-06:** Independent rescheduling/extensions require staff approval and availability checks. Accommodation extensions retain at least 50% upfront; Hall extensions require 100% of additional cost. Preserve immutable prices, financial safeguards and unaffected items.

Theater Type (70 attendees) and Room Type (50) are configurations of **one exclusive physical Hall**, not separate inventory. Preserve existing configured operating hours, notice, buffers and approved start-time pricing. Provisional operational defaults are not new owner-approved facts. No hosted access/application, real payment/email, production gate, commit or push is authorized by this implementation task.
## Final Analytics scope revision - 2026-11-20

Owner-approved Analytics scope is **only Revenue Analytics, Room Category Performance and Package Popularity**, with date-range filtering and staff-only on-screen access; see [[future-analytics-and-reports]]. This supersedes the earlier six-feature proposal and related historical scope statements. Payment & Outstanding Balance Reports, Room Occupancy Analytics, Booking Analytics and Peak Hours & Demand Analytics are excluded as dedicated analytics/dashboard features and must not return under alternate labels. Existing operational availability, check-in/out, payments, balances, manual refunds, booking management and stay-duration monitoring remain unchanged.

Order: finish remaining core features, implement the three approved Analytics features, implement Function Hall Reservation & Management, then complete integration, testing, acceptance and deployment preparation. Preserve all confirmed [[future-function-hall-requirements|Function Hall requirements]] and pending owner decisions. X01-X03 checkpoints remain implemented; all 14 Supabase migrations remain owner-confirmed synchronized. Existing acceptance gaps stay open, live transactions stay disabled and both future modules remain unimplemented. Documentation only; no next implementation task begins.


> [!important] Priority
> These are the latest agreed rules. Older assumptions (such as a Family Executive 3-hour package, strict *standard* room capacity or pay-at-hotel online reservations) are superseded.

## Property and packages

| Category | Inventory | Duration | Price (PHP) |
|---|---:|---:|---:|
| Double Standard | 10 rooms | 3h | ₱200 |
| Double Standard | 10 rooms | 6h | ₱400 |
| Double Standard | 10 rooms | 12h | ₱600 |
| Double Standard | 10 rooms | 24h | ₱1,000 |
| Family Executive | 5 rooms | 6h | ₱600 |
| Family Executive | 5 rooms | 12h | ₱900 |
| Family Executive | 5 rooms | 24h | ₱1,200 |

There is **no 3h Family Executive package**. Multi-day stays consist of permitted packaged blocks (e.g., Family 48h = 24h + 24h). Rates/packages can be changed by staff; historical reservation pricing must never be recomputed from the latest rate. Price combination rule for competing equally long choices is an open configuration decision; see [[18-backlog]].

## Occupants and extra bed

- **Standard, advisory occupancy only:** Double Standard usually 2 persons, or 3 when one is a child; Family Executive normally 3 persons, often 5–6 with an extra bed.
- Hotel permits more than **standard/comfortable occupancy**; no per-person extra charge. Never misrepresent these figures as a verified statutory or fire-safety maximum. Any absolute legal/safety limit remains pending verification.
- Only Family Executive offers an optional extra bed: **₱100 per extra bed, paid once for a continuous stay**, not per hour/day/package; avoid recharging the same extra-bed item on an approved extension. Quantity/stock policy requires confirmation.
- Store primary guest contact for the whole reservation and occupant counts per booked room. Minor ID may be checked by staff, verification status/time/staff recorded; do not default to storing ID photos or infer checking alone establishes legal eligibility.

## Booking inventory model

- Both online and staff/walk-in entries consume **one shared live room inventory**; no reserved walk-in allotment.
- Guest selects category, dates/start time, allowed duration(s), number of rooms and occupants; actual room number is assigned later by staff.
- One reservation may have multiple booked-room items, each with **independent** package(s), scheduled start/end, check-in/out, status, occupants, extensions, and cancellations. Overall primary guest and payment account are shared, but monetary charges/refunds trace to line items.
- Availability checks all overlapping holds, confirmed room bookings, physically blocked rooms, maintenance, and cleaning turnover; use database-level concurrency/transaction safeguards.

## Online reservations — manual GCash verification

- Online guest must pay **full reservation amount before confirmation**, via hotel-owned QR uploaded/configured by staff.
- The guest uploads a screenshot of the GCash receipt. Staff verify the full payment in the hotel's GCash ledger and record the verified transaction reference before confirmation.
- Create temporary 30-minute category-capacity hold while payment proof is being submitted; 5m on-screen reminder, 15m and 25m email nudges if feasible.
- If no proof at 30m, hold expires/releases. If guest actually paid but failed to submit before expiry, staff reconcile money and availability; with guest consent propose a replacement schedule/room or manually refund verified payment.
- If proof submitted within 30m, capacity remains protected pending staff review, even after the initial hold expires; 15m review target, overdue at 15m, urgent at 30m, critical at 60m; do not silently auto-release just because staff are late.
- After actual staff confirmation of payment and safe final availability transaction, mark reservation confirmed. Reject/reconcile fraudulent/duplicate proof safely.
- No-account guest uses email OTP; guests with accounts may also book. Throttle OTP/proof submission and protect images.

## Walk-ins and payment ledger

- Walk-ins: **cash, GCash, or mixed installments**; at least **50% of the selected booking amount** before normal room access. GCash verified by staff, cash recorded by receiving staff.
- Walk-in stay begins when **Staff/Admin actually confirms check-in and room access**, not at arrival or deposit collection. Checkout time = this official start + purchased duration.
- Online late check-in does not slide scheduled checkout automatically. Online one-hour arrival grace starts at scheduled arrival; after grace, staff review/flag no-show manually; no automatic release.
- Outstanding balance must normally be paid before checkout; exception with documented unpaid departure must exist to prevent an indefinitely occupied room.
- Extensions require ≥50% of extension charge before activation. Additional purchased duration starts from **the original scheduled checkout**, even if request arrives 15 minutes late. Availability/turnover and staff approval are mandatory. Full balance due at normal final checkout.

## Changes, cancellation, no-show

- Online full refund for free cancellation **within 1 hour after staff payment verification and reservation confirmation**, only before **that room** has checked in; not a package-specific 24h-before-arrival rule. Rescheduling does not restart the cancellation clock.
- Individual room cancellations permitted in a multi-room reservation, while other rooms remain booked. Staff processes eligible GCash refunds manually, logs refund recipient/reference, and safely releases the cancelled item's capacity.
- Customers request rescheduling; only staff approves/rejects after conflict-safe availability check. Can change an individual booked-room schedule, with audit and price adjustments as necessary.
- Staff may mark a no-show after manual review; confirmed online no-show generally nonrefundable according to disclosed policy and applicable law. No auto-cancel or auto-release after grace timer.
- Approved early check-in for online guests requires available Ready room; paid duration preserved with moved earlier end unless separate paid extension.

## Checkout, housekeeping, maintenance

- The countdown uses persisted server timestamps and survives a page reload. Staff can configure one reminder in minutes before scheduled checkout. At zero, the stay is flagged overdue and staff still record checkout.
- Staff may grant chargeable overtime or free overtime. Every waiver stores reason, authorizing staff, timestamp and waived minutes.
- The cleaning buffer is configurable. Staff must confirm **Ready** before the next guest enters. That confirmation ends any remaining checkout turnover block after cleaning. Buffer expiry alone never marks Ready.
- Maintenance: block room, record reason/repair progress, exclude from feasible room allocation, flag any already scheduled booking requiring room reassignment. Staff manually restores Ready after clearance.

## Policy and organization

- Single Staff/Admin permissions tier with **individual staff login**, actions auditable per staff user.
- No-smoking policy shown/acknowledged. Incident logged; configurable penalty only applied after explicit staff review, or waived with a recorded reason. Disclose policy beforehand and confirm legal enforceability.
- Cloud-first v1. During internet outage use manual log and reconcile after recovery; connected backup/mobile hotspot recommended because remote online bookings can continue while hotel's local internet is down.
- Use Asia/Manila for business-local scheduling, 12-hour AM/PM in **all user-facing UI**.

## Source-of-truth links

[[04-feature-specification]] · [[07-database-schema]] · [[17-decisions]] · [[18-backlog]]

## Verified Guest Reviews & Private Feedback — Phase 08 enhancement (D-038)

- Public website visitors may browse hotel information, room rates/availability and **published reviews/average ratings** without logging in, booking, or entering an email. Browsing alone **never** permits a review.
- Only the verified **primary guest** associated with a real reservation that has at least one **staff-recorded check-in and subsequent completed checkout** may submit a public hotel rating/review. Both online and walk-in guests qualify; a booking alone, payment proof, cancelled/no-show reservation, or mere account registration does **not** qualify.
- **At most one public rating/review per completed reservation**, not one per room item. An online guest with an account uses authenticated ownership; no-account online guests use their **already-verified booking email** and an expiring, single-use, reservation-scoped review link. Walk-ins must have a verified contact method to claim review access; the verified-email invitation flow is proposed, with another secure staff-assisted path pending confirmation.
- Public rating is **1–5 stars**, with an optional written comment; private feedback is separately selected, never published, and accessible only to authorized staff. The backend enforces eligibility, rate limiting and uniqueness with database constraints, not merely a disabled UI button.
- Eligible genuine **1-star through 5-star** reviews receive equal publication treatment. Staff can reply publicly; they cannot edit a guest's words/stars. Staff may **temporarily hide and restore** policy-violating reviews (e.g., threats, spam, personal data, fraudulent submission) only with a documented reason and actor/timestamp audit. Negative sentiment alone is **not** a removal reason. Potentially suspicious submissions may await content moderation, not a blanket staff positivity-approval gate.
- The public aggregate displays eligible **published** ratings, including negative ratings. Private feedback never affects public averages. Keep review links/tokens, contact information and moderation logs private, apply documented retention/privacy policy, and test against forged IDs/OTP/link replay.
- **Implementation timing:** optional **Phase 08 enhancement**, after authoritative reservation and checkout workflows exist. Not part of initial Phase 01 foundation; feature must not be activated without the acceptance tests in [[15-testing-plan]]. Full design: [[24-verified-guest-reviews]].

## Owner-confirmed future modules - 2026-11-20

**Function Hall online-booking update — 2026-11-21:** Customers may start a hall booking online without a prior staff inquiry. Show availability and block unavailable/in-use time slots, with final allocation protected by one transaction. Require full verified payment before online confirmation; evidence upload alone is insufficient. This is planned behavior, not an implemented or enabled customer flow. Hall payment method, timeout, refunds and other pending hall policies remain unresolved; see [[future-function-hall-requirements]].

Approved future Analytics scope: [[future-analytics-and-reports]]. The hotel also offers a separate Function Hall resource with Theater Type maximum 70 persons / Room Type maximum 50 persons; approved start-time-based pricing and inclusions are in [[future-function-hall-requirements]]. Neither software module is implemented. Hall inventory is not bedroom inventory; all existing accommodation counts/rates remain unchanged.

Hall resource count/exclusivity, fractional excess-hour treatment, latest ending time/cross-midnight use, deposit, payment methods, cancellation/rescheduling/refunds, preparation/cleaning buffer, equipment/service charges and mineral-water quantities remain owner questions required before hall implementation. Starts before 8:00 AM are unsupported until clarified. Do not import accommodation policies. Analytics revenue recognition and contribution definitions also require review before their acceptance. No new official backlog/task IDs are assigned here. Approved sequence is recorded in [[13-development-roadmap]].
