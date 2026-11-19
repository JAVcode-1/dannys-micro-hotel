---
tags: [requirements, function-hall, future-scope]
status: confirmed-facility-planned-software
---
# Future Function Hall Reservation & Management

Owner-confirmed requirements recorded 2026-11-20. Danny's Micro Hotel offers a Function Hall in addition to its accommodation categories. The real facility exists; its StayTrack reservation module is planned, **not implemented**. This document does not describe or invent the hotel's existing manual operating processes. Academic **4.0 — The Existing System** is a separate subsequent task and is not rewritten here.

## Confirmed facility and setup options

Model the hall as a separate bookable facility/resource, never as a bedroom or accommodation category. Preserve all approved hotel rates, 10 Double Standard rooms, 5 Family Executive rooms, no Family 3-hour package and the one-time Family-only extra-bed rule.

| Setup | Maximum attendees |
|---|---:|
| Theater Type | 70 persons |
| Room Type | 50 persons |

Validate attendee count against the selected setup's maximum. These are confirmed hall setup capacities, not accommodation occupancy figures or a claim of independently verified legal compliance.

## Confirmed pricing by reservation start time

| Package | Starting-time coverage (Asia/Manila) | Price |
|---|---|---:|
| Daytime, 3 hours | From 8:00 AM up to, but before, 5:00 PM | ₱3,000 |
| Evening, 3 hours | Beginning at 5:00 PM; latest permissible start/end still pending | ₱5,000 |
| Additional full hour | Beyond the 3-hour base | ₱1,000 per excess hour |

The **reservation's start time** selects the 3-hour base price. Crossing 5:00 PM does not change a daytime-start reservation to the evening base.

| Example | Approved calculation |
|---|---|
| 4:00 PM–7:00 PM | ₱3,000 |
| 5:00 PM–8:00 PM | ₱5,000 |
| 4:00 PM–8:00 PM | ₱3,000 + one additional full hour at ₱1,000 = ₱4,000 |

Do not infer partial-hour rounding/proportional charging, prices for starts before 8:00 AM, latest event times or cross-midnight rules. Those cases require owner decisions before implementation; missing policy must block the affected quote/booking rather than silently supply a default. Shorter-than-base bookings also need clarification if offered; no shorter package is approved here.

Confirmed inclusions are **air-conditioning, sound system and mineral water**. No extra inclusion or water quantity is specified.

## Planned software capabilities

- Reservation creation with setup selection, validated attendee count, event date and start/end times.
- Server-calculated approved base package and excess hours, with immutable booked price/rule evidence and clear unsupported-policy blocking.
- Time-slot availability and transactional overlapping-reservation prevention for the eventual confirmed resource model and preparation/cleaning buffers.
- Staff reservation management, reservation statuses and actor/timestamp audit history.
- Payment tracking and receipts, subject to approved hall payment/refund rules and the existing unresolved receipt/compliance requirements. Do not claim an internal statement is an official receipt.
- Function Hall calendar and booking overview, plus separate revenue, booking and utilization reporting through [[future-analytics-and-reports]]. Attendees never count toward accommodation occupancy.

Reuse suitable authentication, scheduling, inventory-locking patterns, payment records and auditing where safe. Keep hall-resource capacity separate from room inventory; do not reuse accommodation categories or assume room state transitions fit events. Core business operations still route through the separate Express API with server authorization, transactional capacity safeguards and sensitive-record protection.

Accommodation-specific deposits, payment methods, cancellation/refund/rescheduling policies, cleaning, check-in and extension rules do **not** automatically apply to hall bookings. Hall reservation/payment/readiness state definitions require their own reviewed design before implementation. No hall migration, feature or live transaction is authorized by this documentation.

## Open owner decisions — required before Function Hall implementation

| Question | Safe planning boundary |
|---|---|
| Is there exactly one function hall? | Do not assume resource count. |
| Is the entire hall reserved exclusively for one booking? | Do not assume exclusivity or allow shared capacity without approval. |
| Are partial excess hours rounded up or charged proportionally? | Do not quote unsupported fractional-hour charges. |
| What is the latest allowed event ending time? | Do not promise unrestricted evening hours. |
| Can events extend past midnight? | Do not infer cross-midnight availability or prices. |
| Is a deposit required, and how much? | Do not import accommodation payment thresholds. |
| Are cash, GCash, or both accepted? | No hall payment method is confirmed yet. |
| What are the cancellation, rescheduling and refund policies? | Do not import room terms or automate refunds. |
| How much preparation/cleaning buffer is required between events? | No guessed turnaround duration. |
| Are there extra charges for equipment or other services? | Do not invent optional charges. |
| Are mineral-water quantities limited? | Do not promise unlimited water or invent a quantity. |

Also clarify starts before 8:00 AM before supporting them. Confirmed prices and inclusions above remain valid while unanswered policies remain explicitly pending.

## Dependencies and future acceptance (not executed)

Implement only after remaining approved core work and Analytics & Reports, with owner decisions resolved and a reviewed module design. Later demonstrate the three approved price examples, exact 5:00 PM boundary, setup-capacity limits, unsupported-rule blocking, competing overlapping bookings, staff authorization, payment reconciliation/auditing and room-inventory/report isolation. These are planned checks, not passing evidence. See [[13-development-roadmap]] and [[phases/09-hardening-pilot-and-release]].
