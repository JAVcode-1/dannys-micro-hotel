---
tags: [navigation, ux]
status: planned
---
# 11 — Pages and Navigation

## Unified booking routes - 2026-11-21

`/book` is the single room/Hall planner: Add room, Add Function Hall, independent schedules, Check availability and Continue reservation. Room rate links may preselect the category and Hall links the setup. `/rooms` and `/function-hall` expose approved Hall rates and booking entry points. Guest payment/history/detail use one parent reservation and itemized charges. The staff sidebar exposes Function Hall only when the capability is enabled; the same reservation connects staff management/payment review to separate room assignment/check-in and Hall calendar/event operations. Preserve the approved landing design and Royal Horizon theme. Production activation and device acceptance remain pending; see [[unified-online-booking-requirements-sync]].
## Simplified guest navigation — 2026-11-21

The booking page uses the shared header only. Each numbered room groups its own room type, arrival, stay length and guest-count fields, so labels do not repeat the room number. Guest-facing copy says “See total price” and “Add more time” while existing server pricing, independent schedules and availability rules remain unchanged.

The shared guest header now presents four destinations: Rooms & rates, Function Hall, My bookings and Book a room. The hotel name returns Home. Reviews remain reachable through their public content and completed-stay invitations, while email verification appears contextually when booking or opening a reservation. Sign out appears only for an authenticated guest. The booking planner no longer renders a second local navigation. Existing direct routes, authorization and feature gates remain unchanged.

## Implemented correction-sprint routes — 2026-11-21

This section supersedes the suggested routes below. Guest routes: `/`, `/rooms`, `/function-hall`, `/reviews`, `/book`, `/verify`, `/reservations`, `/reservations/:id`, `/reservations/:id/payment`, `/reviews/submit`, `/feedback/private`. `/login` and `/register` remain OTP compatibility routes. Reviews enforce completed-stay eligibility and verified ownership/grants. Future Function Hall booking is customer self-service with public availability and full verified payment before confirmation; its online route/flow is not implemented or enabled yet. The current gated hall workflow remains staff-managed. Disabled modules have unavailable states, unknown routes have not-found, and synthetic previews are development-only.

Staff routes: `/staff/sign-in`, `/staff`, `/staff/reservations`, `/staff/reservations/:id`, `/staff/walkins`, `/staff/check-ins`, `/staff/stays`, `/staff/payments`, `/staff/cancellations`, `/staff/reschedules`, `/staff/stay-changes`, `/staff/rooms`, `/staff/hall`, `/staff/analytics`, `/staff/reviews`, `/staff/feedback`, `/staff/audit`, `/staff/settings`, `/staff/settings/catalog`. `/staff/catalog` redirects to settings/catalog. Navigation groups: Today, Reservations, Active Stays, Payments, Rooms, Function Hall, Management. Sessions remain mounted during protected navigation.

Staff detail includes per-room schedules, contextual actions, contact/policy evidence, verified payment/refund history and a printable statement explicitly labelled **not an official fiscal receipt**. The dashboard uses operational queues, not excluded analytics. See [[functional-completion-tracker]] for actual verification status.

## Guest pages

| Route (suggested) | Purpose |
|---|---|
| `/` | Home, hotel categories, open 24h, policies |
| `/rooms` | Room comparison, base prices and advisory usual occupancy on each card; the separate occupancy checker is removed from this guest page |
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
| `/staff/reports` | Planned Revenue Analytics, Room Category Performance and Package Popularity only; date filters and staff-only on-screen access |
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
