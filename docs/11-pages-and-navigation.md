---
tags: [navigation, ux]
status: planned
---
# 11 — Pages and Navigation

## Implemented correction-sprint routes — 2026-11-21

This section supersedes the suggested routes below. Guest routes: `/`, `/rooms`, `/function-hall`, `/reviews`, `/book`, `/verify`, `/reservations`, `/reservations/:id`, `/reservations/:id/payment`, `/reviews/submit`, `/feedback/private`. `/login` and `/register` remain OTP compatibility routes. Reviews enforce completed-stay eligibility and verified ownership/grants. Hall booking is staff-assisted only. Disabled modules have unavailable states, unknown routes have not-found, and synthetic previews are development-only.

Staff routes: `/staff/sign-in`, `/staff`, `/staff/reservations`, `/staff/reservations/:id`, `/staff/walkins`, `/staff/check-ins`, `/staff/stays`, `/staff/payments`, `/staff/cancellations`, `/staff/reschedules`, `/staff/stay-changes`, `/staff/rooms`, `/staff/hall`, `/staff/analytics`, `/staff/reviews`, `/staff/feedback`, `/staff/audit`, `/staff/settings`, `/staff/settings/catalog`. `/staff/catalog` redirects to settings/catalog. Navigation groups: Today, Reservations, Active Stays, Payments, Rooms, Function Hall, Management. Sessions remain mounted during protected navigation.

Staff detail includes per-room schedules, contextual actions, contact/policy evidence, verified payment/refund history and a printable statement explicitly labelled **not an official fiscal receipt**. The dashboard uses operational queues, not excluded analytics. See [[functional-completion-tracker]] for actual verification status.

## Guest pages

| Route (suggested) | Purpose |
|---|---|
| `/` | Home, hotel categories, open 24h, policies |
| `/rooms` | Room comparison, base prices and standard occupancy advice |
| `/book` | Choose independent per-room packages/time slots and occupants |
| `/checkout` | Price summary and terms acknowledgment |
| `/pay/:holdRef` | Static GCash QR + countdown + screenshot/ref form |
| `/reservation/:reference` | Guest OTP-protected reservation status, individual room schedules |
| `/reservation/:reference/changes` | Request item cancellation/reschedule |
| `/login`, `/register`, `/verify` | Registered and no-account guest verification |
| `/reviews` | **Public** list/average of verified published hotel ratings, readable by all visitors without a login |
| `/reviews/submit` | Review form visible only after verified completed stay; authenticated owner or expiring single-use email invitation |
| `/feedback/private` | Verified former guest sends a **private** message to hotel management; never public |

## Staff/Admin pages

| Route (suggested) | Purpose |
|---|---|
| `/staff/login` | Individual staff credentials |
| `/staff` | Today overview, urgent proof reviews, overdue rooms |
| `/staff/reservations` | All reservations and room items |
| `/staff/reservations/:id` | Charges, payments, item states, approvals and audit |
| `/staff/rooms` | Physical room board and assignments |
| `/staff/check-in` | Walk-in reservation creation, payments, official check-in |
| `/staff/payment-reviews` | Queue + GCash receipt verification decisions |
| `/staff/housekeeping` | Dirty/cleaning/Ready workflow |
| `/staff/maintenance` | Blocks, reasons, repair progress and impacts |
| `/staff/incidents` | Smoking/other incident record, charge/waiver reasons |
| `/staff/reports` | Planned Revenue Analytics, Room Category Performance and Package Popularity only; date filters and staff-authorized CSV/Excel exports |
| `/staff/settings` | Room catalog, packages, buffer/alerts, QR, policies |
| `/staff/audit` | Staff activity log with filters |
| `/staff/reviews` | Moderate flagged public reviews, respond, hide/restore with mandatory policy reason and audit |
| `/staff/feedback` | View and manage private verified guest feedback; staff-only |

## Navigation rules

- Guest sees only verified-own reservation; backend authorizes every direct route.
- Staff has a persistent sidebar with urgent queues visible.
- Hide/show links according to capability, but enforce authorization in API.
- Use 12-hour displayed times and date for overnight stays.
- Navigation to changing payment state must fetch server truth, not cached optimistic 'confirmed' state.

See [[09-ui-ux-design-system]].

## Approved design baseline for navigation

- Guest header: **white** background, **Royal Blue `#2443B6`** active links/underline, **Sunset Orange `#F97316`** `Book a Room` action with **Midnight Navy `#17213D`** text.
- Staff sidebar: **white** (minimalist ClkiQ-style reference), with Royal Blue active navigation and subtle Sky Blue `#EAF1FF` selected states; Royal Blue buttons with white text. Operational status colors remain semantic.
- Mobile navigation remains easy to reach, with 44px minimum tap targets and visible focus.
- Full specification and sample layout: [[09-ui-ux-design-system]] and [[design/brand-and-navigation-brief]].

Analytics scope follows [[future-analytics-and-reports]]. Operational payments, balances, refunds and booking/stay management remain in their existing staff workflows.
