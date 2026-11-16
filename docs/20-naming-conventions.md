---
tags: [conventions, code]
status: proposed
---
# 20 — Naming, Folder and Coding Conventions

## Names and IDs

- `snake_case`: PostgreSQL tables, columns and migration identifiers (`room_bookings`, `scheduled_end_at`).
- `camelCase`: TypeScript variables/function names (`reservationId`, `calculateAmountDue`).
- `PascalCase`: React components/types (`PaymentReviewQueue`, `RoomBooking`).
- `UPPER_SNAKE_CASE`: constants and enum-like domain keys (`FAMILY_EXECUTIVE`, `GCASH`).
- Stable internal database IDs: UUID; public reservation reference is separate and non-authoritative for access.
- Phase/doc links use existing kebab-case filenames and preserve Obsidian wiki links.

## Domain glossary

- **Room category:** Double Standard or Family Executive.
- **Physical room:** staff-assignable numbered unit with readiness/maintenance state.
- **Reservation:** one primary guest, many independently scheduled **room bookings** and shared payments.
- **Room booking:** one scheduled room-category stay within a reservation.
- **Package block:** allowed priced duration for that category, combined for multi-day stays.
- **Hold:** temporary protected capacity while awaiting payment proof.
- **Protected review:** proof submitted before hold deadline; not automatically expired at 30m.
- **Actual check-in:** staff-confirmed room access; starts **walk-in** paid duration.
- **Standard occupancy:** comfort guidance, **not** automatically a legally verified max.
- **Inventory claim:** internal capacity block, not guest-selected physical room number.

## Engineering rules

- Add a dedicated service for each aggregate; keep controllers thin.
- Use explicit state transition functions; reject unknown transitions with clear errors.
- Do not store money as floats, guest-sensitive data in URLs, or secret keys in source.
- Every migration reversible where feasible, idempotent seeds, clear test fixtures.
- Error contracts include stable code, human message and request/correlation ID.
- Public-facing timestamps display `Nov 11, 2026, 2:10 PM` style.
- Document significant deviations in [[17-decisions]] and update [[15-testing-plan]].

## Suggested Git commit examples

`docs(phase-01): approve database migration strategy`
`feat(availability): add atomic category allocation lock`
`test(payment): cover proof submitted before hold expiry`
`fix(stay): anchor extension to original checkout timestamp`
