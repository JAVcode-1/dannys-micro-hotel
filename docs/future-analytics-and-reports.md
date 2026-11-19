---
tags: [requirements, analytics, future-scope]
status: approved-scope-not-implemented
---
# Future Analytics & Reports

Owner-confirmed scope recorded 2026-11-20. This specifies future StayTrack software, not an existing hotel reporting process or an implemented dashboard. Implement after remaining approved core features and before Function Hall Reservation & Management. See [[13-development-roadmap]].

## Six essential features

| Feature | Required reporting |
|---|---|
| Revenue Analytics | Daily, weekly and monthly revenue/collections, refunds and outstanding balances. Display verified collections separately from earned revenue. |
| Room Occupancy Analytics | Occupied room-hours divided by available room-hours; occupancy and utilization trends appropriate for 3-, 6-, 12- and 24-hour stays. |
| Room Category Performance | Revenue, bookings and utilization by accommodation category; derive categories dynamically so future additions do not require hard-coded report columns. |
| Package Popularity | Bookings and revenue by approved duration package; most frequently selected durations. Preserve historical package snapshots. |
| Booking Analytics | Online versus walk-in bookings; completed, cancelled and no-show statuses; trends over the selected period. |
| Payment and Outstanding Balance Reports | Cash and actually verified GCash collections, reconciliation, unpaid balances and manual refunds. Pending proof is not a verified collection. |

All six require date-range filters, CSV/Excel exports, staff-only access enforced through Express, Philippine-local-time reporting (Asia/Manila) and calculations from actual authoritative booking and financial records. Display user-facing times in 12-hour AM/PM format. Exports must apply the same authorization, filters and calculation definitions as the dashboard and exclude private payment proofs and unnecessary guest/payer data. Neutralize spreadsheet formula injection in exported text.

## Calculation and reconciliation requirements

- Define the reporting grain explicitly: reservation counts, room-item counts, package selections and payment events are different measures. Never multiply reservation-level money by joining it to multiple room items.
- Count each factual receipt once. Partial payments and later allocations of the same money are not new collections; unverified proof and pending extension commitments are not collected money. Show gross collections, completed refunds and net cash movement separately.
- Trace charges, approved extensions, credits, waivers, payment allocations and completed manual refunds to their authoritative immutable records. Do not count a cancellation credit as both a cash refund and a second reduction of the same revenue. Refund obligations and completed transfers are distinct.
- Calculate outstanding debt from approved charges/credits and actual allocated settlement records; keep unallocated funds and pending obligations separately identifiable. Reconcile item subtotals with reservation and overall totals, including independently cancelled/rescheduled/extended sibling room items.
- Earned revenue is distinct from receipt-date cash flow. Before implementation, specify and approve recognition timing, service-period allocation, treatment of cancellations/no-shows and allocation across categories/packages. Do not invent accounting policy or label deposits as earned revenue.
- Clip actual occupied intervals to the selected local reporting period, using recorded check-in/checkout; explicitly define how ongoing stays are measured as of the report instant. A scheduled end or zero countdown is not actual checkout. Compute time in UTC after translating Asia/Manila date boundaries; display the reporting timezone and as-of instant.
- Define and disclose the available-room-hours denominator, treatment of maintenance/cleaning blocks, overlapping blocks and incomplete historical inventory. Do not substitute guest headcount or booking counts for occupied room-hours, and do not fabricate missing historical availability. Final metric definitions and fixtures must be reviewed before implementation acceptance.
- Separate reservation-level status from independent room-item statuses and distinguish original package selections from subsequent extensions so trends and popularity cannot silently double count.

## Future Function Hall compatibility

Design report sources and dimensions to distinguish accommodation from separately bookable facilities. Later add separate Function Hall revenue, booking and utilization reports using hall-resource time and its eventual approved availability rules. Hall attendees never enter accommodation occupancy statistics, and hall utilization must not use the 15-room denominator. Reuse suitable reporting infrastructure without requiring a complete redesign or prematurely implementing hall tables.

AI forecasting and complex customer profiling are excluded from initial scope. No new runtime dependency, schema or implementation is selected here.

## Future acceptance evidence (not executed)

Require fixtures reconciling partial/mixed payments, duplicate retries, extensions, partial room-item cancellations, credits, outstanding refund obligations and completed refunds without double counting. Demonstrate local date boundaries, interval clipping, maintenance-denominator handling, dynamic categories, staff/guest authorization and CSV/Excel parity and export safety. Keep earned-revenue assertions gated on approved recognition definitions. All implementation and acceptance remain pending.
