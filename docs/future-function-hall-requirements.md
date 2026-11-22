---
tags: [requirements, function-hall, future-scope]
status: confirmed-facility-planned-software
---
# Future Function Hall Reservation & Management

## Current Unified Online Booking authority - 2026-11-21

The owner's UB-01 through UB-06 implementation request supersedes the earlier staff-inquiry-only customer restriction and all pending mixed-payment/hold/cancellation questions. Customers may reserve the Hall alone or with independently scheduled rooms in one planner. One exclusive physical Hall has alternative Theater Type/Room Type setups; it is not two halls.

All online items require 100% upfront through one GCash transaction/reference/private screenshot with item allocations and actual staff verification. Staff-managed Hall bookings retain the minimum 50% deposit. Atomically claim all selected room/Hall inventory, apply one 30-minute proof deadline and protect every timely-proof item until review. Staff confirm the full reservation atomically and generate one itemized confirmation/outbox email. Physical event start and completion remain staff-managed.

Online Hall cancellation follows the same one-hour-after-confirmation window, ending sooner at actual event start. Individual cancellation releases only the Hall claim; eligible refunds are manual and capped against its share of the verified payment. Independent staff-approved rescheduling preserves the original cancellation clock. Hall extensions require 100% of additional cost; room extensions retain at least 50%. Existing pricing, configured hours/notice/buffers and immutable history remain in force. See [[unified-online-booking-requirements-sync]] for implementation evidence and deferred acceptance.

This task permits local implementation and disposable PostgreSQL only. No hosted access/application, real payments/email, production activation, commit or push. Earlier documentation-only restrictions below are historical where superseded here.

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

### Online Function Hall workflow

Choose setup, date/start time, full-hour duration (minimum three hours), attendees and additional requests. Display server-priced availability before creating an atomic unified hold. Full payment, one proof deadline, protected review, confirmation and independent changes follow UB-01 through UB-06 above. Staff inquiry is not a prerequisite. A displayed available slot is not a guarantee until its transactional claim is created. No screenshot-only confirmation or automatic refund is allowed.

- Reservation creation with setup selection, validated attendee count, event date and start/end times.
- Server-calculated approved base package and excess hours, with immutable booked price/rule evidence and clear unsupported-policy blocking.
- Time-slot availability and transactional overlapping-reservation prevention for the eventual confirmed resource model and preparation/cleaning buffers.
- Staff reservation management, reservation statuses and actor/timestamp audit history.
- Payment tracking and receipts, subject to approved hall payment/refund rules and the existing unresolved receipt/compliance requirements. Do not claim an internal statement is an official receipt.
- Function Hall calendar and booking overview, plus separate revenue, booking and utilization reporting through [[future-analytics-and-reports]]. Attendees never count toward accommodation occupancy.

Reuse suitable authentication, scheduling, inventory-locking patterns, payment records and auditing where safe. Keep hall-resource capacity separate from room inventory; do not reuse accommodation categories or assume room state transitions fit events. Core business operations still route through the separate Express API with server authorization, transactional capacity safeguards and sensitive-record protection.

Accommodation policies apply to online Hall items only where explicitly approved by UB-01 through UB-06. Preserve separate room and event states and the staff-managed Hall deposit workflow.

## Operational configuration and remaining owner acceptance

Existing Hall code provides configurable opening/closing, minimum notice, booking horizon, preparation/cleanup, no-show grace and reminders. Current provisional defaults are 8:00 AM-10:00 PM, three-hour notice, 90-day horizon and 30-minute preparation/cleanup; these are existing development settings, **not a fresh owner approval of operating policy**. Public bookings cannot bypass minimum notice with a staff override. Reject starts before priced hours, fractional excess hours and cross-midnight events. No shorter-than-three-hour package is offered.

Pending before activation: management acceptance of configured hours/notice/buffers, any outside-hours staff operation, optional equipment/service charges and mineral-water quantities, real payee/QR, receipt/privacy/legal terms and hosted/device acceptance. Do not invent equipment fees, unlimited water or compliant fiscal receipts. One exclusive Hall, full online GCash payment, shared hold/confirmation, cancellation and change policies are resolved by the current owner request and are no longer open questions.

## Dependencies and future acceptance (not executed)

The current request authorizes unified implementation over existing gated core and Hall modules. Before activation, demonstrate the three approved price examples, exact 5:00 PM boundary, setup-capacity limits, unsupported-rule blocking, competing overlapping bookings, staff authorization, payment reconciliation/auditing and room-inventory/report isolation. These are planned checks, not passing evidence. See [[13-development-roadmap]] and [[phases/09-hardening-pilot-and-release]].


## Function Hall development checkpoint - 2026-11-20

The gated staff workflow covers one exclusive hall with Theater Type and Room Type configurations, private staff inquiries, Manila quotes, a calendar, audited settings and verified cash or GCash receipts. The gated public information page describes approved capacities, prices, inclusions and inquiry channels. PostgreSQL excludes overlapping protected intervals across setups. The private global reference registry permits exactly one accommodation or hall source per GCash reference. Paid schedule failures retain receipts and flag manual resolution. Schedule changes use expected claim IDs and immutable revisions.

Event operations enforce verified net funding and physical readiness before start. An outstanding refund approval that would underfund the event must be resolved before starting. Countdown and preparation-conflict alerts and actual completion are separate from reserved schedule time. Rescheduling, extensions, no-show release, cancellations and manual refunds keep attributable history. Hall-only reports separate verified collections, completed refunds, scheduled utilization and actual occupancy.

Candidates 20261120001700 through 20261120001900 are isolated PostgreSQL migrations only. Hosted Supabase, existing transaction and H04 gates, hosted inventory blockers, and UI Refinement assets remain outside this checkpoint. Provisional operating defaults, outside-hours staff access, public inquiry details and a staff/device pilot require owner confirmation before activation. Formal major-milestone and predeployment acceptance remain open.

Build, typecheck, lint and formatting passed. All 152 application tests (108 backend, 44 frontend) and 27 isolated PostgreSQL tests passed with zero failures or skips. The single independent review found five major issues, addressed before these runs. Isolated coverage includes concurrent claims and GCash uniqueness, both cross-module GCash directions, paid conflict recovery, stale schedule rejection, readiness and refund/start checks, refund caps, hall reconciliation and accommodation isolation.
