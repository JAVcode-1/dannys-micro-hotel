---
tags: [design, ux, brand, approved, accessibility]
status: approved-for-development
approved_by: project-requester
approved_on: 2026-11-12
version: 1.2
---
# 09 — UI/UX Design System: Danny's Royal Horizon

## Customer booking presentation - 2026-11-22

The owner authorized visual refinement of the customer journey only. Guest booking surfaces use an editorial hospitality treatment: the existing Palatino-family display typography paired with the current body font, the approved Royal Horizon tokens, actual hotel imagery and quiet white cards. Selection, verification and payment/review receive consistent guidance; no navigation step claims payment confirmation. Price summaries preserve server amounts, and pending proof remains explicitly different from verified payment. Orange primary actions always use navy text. Customer styles are scoped to guest booking surfaces; staff/admin and landing styles are separate. Source includes responsive controls/focus treatment, but browser/device/accessibility acceptance remains pending.

## Landing button override - 2026-11-22

Owner-approved landing buttons use static geometry and an immediate 85% opacity hover on hover-capable fine pointers. This supersedes earlier button lift, scale, arrow movement and hover-shadow guidance for the landing page. Keep keyboard focus styling and existing touch target sizes.

> [!success] APPROVED FOR IMPLEMENTATION — 2026-11-12
> The project requester chose **Danny's Royal Horizon** for the **digital product** after reviewing Danny's Micro Hotel's real exterior/signage photographs, website concepts and the clean ClkiQ-style rooms inventory reference. Use these tokens throughout the guest booking site and Staff/Admin dashboard. This approval does **not** claim formal signoff from hotel management for trademarks, published imagery or production deployment.

## 1. Brand evidence and design goal

- The actual property features bold blue signage, vivid orange partitions, lavender/pink and blue wall panels, and limited green details. Keep this recognizable **without repeating every bright exterior color** across the interface.
- The website should feel **friendly, contemporary and trustworthy**; the Staff/Admin dashboard should be **minimal, fast to scan and readable for long shifts**.
- Main direction: **Royal Blue 75% visually neutral interface / selective blue and orange with lavender as a rare supporting surface**. The approximate 75/20/5 balance is a visual guideline, not a literal CSS requirement.
- Hotel imagery provided by the requester is reference material. The signage in the images includes *historical package prices*; the **current source of truth is [[19-seed-data]]** (particularly **Family Executive has NO 3-hour package**).
- Reference photos: ![[assets/brand/hotel-exterior-reference.jpg]] and ![[assets/brand/hotel-corridor-reference.jpg]]. The originally supplied signage is ![[assets/brand/hotel-signage-reference.png]].

## 2. Approved light-theme color tokens

| Token | HEX | Role |
|---|---|---|
| `--brand-primary` | `#2443B6` | Royal Blue: logo emphasis, primary navigation, primary secondary buttons, links |
| `--brand-primary-hover` | `#1B3595` | Hover/pressed blue; derived, designer-selected |
| `--accent-booking` | `#F97316` | Sunset Orange: *guest* Book Now / Check Availability CTA, targeted attention |
| `--accent-lavender` | `#EEE9FA` | Soft Lavender: selected subtler cards, decorative hotel identity |
| `--surface-canvas` | `#FAFAFD` | Warm White: default main page background |
| `--surface-card` | `#FFFFFF` | Cards, tables, dialogs, forms |
| `--text-main` | `#17213D` | Midnight Navy: headings and body text |
| `--surface-selected` | `#EAF1FF` | Sky Blue: hover and selected tabs/sidebar rows |
| `--text-muted` | `#475569` | Secondary text, metadata |
| `--border-subtle` | `#DDE4F2` | Lines and form borders |
| `--focus-ring` | `#2443B6` | Visible keyboard focus, with sufficient contrast |

### Semantic status colors — not brand colors

| Status | Text/icon | Background | Always show label + icon |
|---|---|---|---|
| Ready / Available | `#166534` | `#DCFCE7` | Check-circle + `Ready` |
| Occupied | `#6D45C6` | `#F3E8FF` | Bed icon + `Occupied` |
| Cleaning | `#92400E` | `#FEF3C7` | Broom icon + `Cleaning` |
| Under Maintenance | `#475569` | `#E2E8F0` | Wrench icon + `Maintenance` |
| Pending Review | `#92400E` | `#FEF3C7` | Clock icon + `Awaiting review` |
| Overdue / Error | `#B42318` | `#FEE4E2` | Alert icon + text |
| Confirmed payment | `#166534` | `#DCFCE7` | Only on backend-verified state |

> [!warning] Payment and inventory state must never depend on colors alone
> An uploaded GCash proof is **not** a verified payment; pending proofs cannot use the same visual treatment as confirmed reservations. Use explicit text, icon and accessible announcement.

### Measured accessibility checks (WCAG contrast, relative)

| Foreground on background | Ratio | Normal text |
|---|---:|---|
| White `#FFFFFF` on Royal Blue `#2443B6` | ~8.22:1 | AA pass |
| Midnight Navy `#17213D` on Sunset Orange `#F97316` | ~5.67:1 | AA pass |
| White on Sunset Orange | ~2.80:1 | **Fails AA**; DO NOT use |
| Midnight Navy on Warm White | ~15.26:1 | AA pass |
| Royal Blue on Sky Blue | ~7.26:1 | AA pass |
| Midnight Navy on Soft Lavender | ~13.37:1 | AA pass |

Use **Midnight Navy text on orange buttons**, not white. Validate contrast again after hover, disabled, opacity, overlays, inputs, charts and photography are implemented. The numbers above are design-token checks, not a claim of full app accessibility certification.

## 3. Recommended typography and sizing

| UI use | Font | Size/weight |
|---|---|---|
| Headings and hero | Plus Jakarta Sans, fallback `Inter, Arial, sans-serif` | 24–40 px at appropriate breakpoints, 650–750 |
| Dashboard headings | Plus Jakarta Sans, fallback Inter | 20–28 px, 650–700 |
| Body, tables and forms | Inter, fallback `Arial, sans-serif` | **16 px default** (comfortable 16–18 px) |
| Metadata and helper text | Inter | Usually 13–14 px; avoid tiny text for essential controls |
| Countdown and room numbers | Inter or tabular numeral font setting | 18–30 px, tabular numbers |

Fonts are a design preference; self-host or load responsibly with font-display swap and robust system fallbacks. Focus on accessibility and responsiveness rather than a heavy design library.

## 4. Layout system

### Guest website

- **White sticky header**, Danny's name/logo in blue, Home / Rooms / Rates / Contact and a distinct orange **Book Now** action.
- Hero includes **real hotel imagery**, Royal Blue/soft gradient area, clear call-to-action, and 'Open 24 Hours' message.
- Room cards for **Double Standard** (3, 6, 12, 24h) and **Family Executive** (6, 12, 24h only). Never advertise a Family 3h rate.
- Separate date, arrival time (AM/PM), permitted package, guest count and optional extra bed (Family only). Multi-room booking supports independent schedules.
- Reservation flow: category+schedule → quote/terms → 30-minute hold → GCash proof+reference → **staff review** → confirmed. Do not label a proof upload `Paid` or `Confirmed`.
- On narrow screens: one-column room cards, accessible date/time selectors, 44x44 px minimum actionable controls; persistent booking CTA if it doesn't obscure content.

### Staff/Admin dashboard

- Adopt the **clean white-sidebar, white-card, pale-background inventory layout** the requester liked (ClkiQ reference), **with Royal Blue instead of purple for active navigation**.
- Orange reserved for actual calls to action (e.g. new walk-in) **not every dashboard card**.
- Top section: current hotel status and urgent actionable work (awaiting GCash review / checkout approaching / overdue). Always show **15 total physical rooms**: 10 Double Standard + 5 Family Executive; counts of current states are live data only.
- Room grid: physical room number, category, Ready/Occupied/Cleaning/Maintenance, current occupancy, independent countdown, next assignment, actions (assign/check in/check out/maintenance); only display real room numbers when provided.
- Search + filters for category, room number, arrival time and status. Consistent labels and accessible forms.
- Navigation sidebar: Dashboard, Bookings, Rooms, Check-in/Checkout, Payments, Housekeeping, Maintenance, Reports, Settings, Audit.
- Responsive staff layout: collapsible navigation, status-first card rows, tables with usable mobile overflow.

## 5. Component rules

### Landing-page compact sizing — owner approved 2026-11-21

The John Aldrin Villa portfolio screenshot is the sizing reference for the guest landing page: a centered, rounded white navigation surface with a 56 px minimum inner height, 13 px navigation text, and rounded 36 px minimum desktop CTA buttons. Keep Royal Horizon tokens, including navy text on orange. The header has an 8 px top inset, preserves its floating state on scroll and measures its actual height for anchor clearance. Mobile and coarse-pointer CTAs retain at least 44 px touch height; content may expand at larger text sizes. These compact desktop dimensions supersede the earlier blanket 44 px landing-control guidance only for desktop CTAs.

Main navigation includes Rooms & Rates, How to book, Function Hall and Contact, plus Book a room linking to `/book`. Guest access is footer-only. The five-step online-booking guide explains room/schedule selection, email verification without requiring account registration, price/policy review and the 30-minute hold, full GCash payment with reference and screenshot, and actual staff verification before confirmation. Timely proof remains protected during staff review. The guide defers booking-open status to the existing booking page; it does not activate payments or alter reservation rules.

| Component | Default | Interactions |
|---|---|---|
| Guest primary CTA | Sunset Orange fill + **Midnight Navy** text | Slight shadow/lift, visible focus, disabled state |
| Staff primary button | Royal Blue fill + white text | Blue hover, clear loading/disabled states |
| Secondary button | White surface + Royal Blue border/text | Soft Sky Blue hover |
| Navigation active | Royal Blue text/underline for guest; Sky Blue fill + blue text for staff | Preserve accessible aria-current |
| Cards | White + subtle border/shadow + 12–16px radius | No mandatory hover animation |
| Inputs | White, neutral border, visible label, focus ring | Inline validation and helper text |
| Dialog | White card on readable overlay, labelled title | Escape/return focus, danger confirmation |
| System status badges | Semantic foreground/background, icon and text | Do not substitute only color dots |
| Booking timers | Tabular numeric text with AM/PM checkout information | Server-synchronized; time alone never checks out |

### CSS/Tailwind-ready starter tokens (design reference only)

```css
:root {
  --brand-primary: #2443B6;
  --brand-primary-hover: #1B3595;
  --accent-booking: #F97316;
  --accent-lavender: #EEE9FA;
  --surface-canvas: #FAFAFD;
  --surface-card: #FFFFFF;
  --text-main: #17213D;
  --surface-selected: #EAF1FF;
  --text-muted: #475569;
  --border-subtle: #DDE4F2;
  --focus-ring: #2443B6;
}
```

Do not implement two competing hard-coded copies of these colors. Put tokens in the frontend theme file, reference in Tailwind config/CSS variables, and use semantic component variants.

## 6. Motion, data and UI constraints

- Transitions 150–220ms; respect `prefers-reduced-motion`. No blinking alerts or blocking animations.
- Store time as server instants and render in **12-hour AM/PM** (Asia/Manila). Room countdown must derive from persisted timestamps after tab refresh.
- Display price in Philippine pesos with correct package availability. Money calculated in backend; client estimates are never authoritative.
- Distinguish booking/financial states from physical room readiness. `Ready`, `Occupied`, `Cleaning`, `Maintenance` are physical operational statuses.
- The guest and staff headers offer a shared light/dark preference. Light is the default. The dark palette uses the same semantic color roles and retains the Royal Horizon action colors.
- Do not treat conceptual AI-generated mockups as accurate price tables, actual room-number maps or real guest records.

## 7. Phase-by-phase UI design delivery

- **Pre-code:** theme tokens approved and recorded; choose basic typography, browser/mobile targets and source photo use rights. See [[21-before-coding-checklist]].
- **Phase 01:** implement theme tokens, typography shell and reusable primitive layout (no booking logic).
- **Phase 02:** login, OTP fields, role-protected navigation, form states.
- **Phase 03:** room catalog and dashboard room cards with validated category/package data.
- **Phases 04–05:** booking availability, 30-minute holds, payment-proof review states.
- **Phase 06:** staff room grid, check-in, checkout and stay countdown.
- **Phases 07–09:** refunds/change forms, housekeeping/maintenance, reporting and mobile/accessibility audit.

## 8. Design acceptance checklist

- [x] Theme direction and color tokens approved by project requester, November 12, 2026.
- [ ] Confirm official hotel logo and usage rights for supplied photos before publication.
- [ ] Guest and Staff/Admin layouts use **one shared design token source**.
- [ ] Every interactive color/focus/disabled pair passes relevant accessibility tests.
- [ ] Guest pages use accurate packages and prices; Family Executive 3h never appears.
- [ ] Screen-reader/keyboard access, responsive testing and reduced motion verified.
- [ ] Images compressed/optimized and safe to publish.
- [ ] Actual hotel management performs optional final visual signoff before launch.

Links: [[11-pages-and-navigation]] · [[10-animation-and-motion]] · [[17-decisions]] · [[21-before-coding-checklist]]
