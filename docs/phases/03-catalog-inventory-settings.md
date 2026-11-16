---
tags: [phase-03, implementation]
status: not-started
---
# Phase 03 — Catalog, Room Inventory & Settings

**Goal:** Model 15 physical rooms and offered packages without wrong Family 3h pricing.

**Dependencies:** [[01-foundation-and-tooling]], [[02-auth-and-authorization]], [[19-seed-data]].

## Task sequence

### C01 — Categories, packages and prices
- [ ] Create category/package tables and versioned pricing migration.
- [ ] Seed exactly 7 package rows: Double 3/6/12/24; Family 6/12/24.
- [ ] Public catalog endpoint only returns active category-supported packages.
- [ ] Staff settings CRUD with audit; history snapshot rules defined.

**Acceptance:** T01 and T02 pass; 3-hour Family request rejected on server.

### C02 — Physical room catalog
- [ ] Model ten Double and five Family units.
- [ ] Placeholder room labels in dev only; obtain actual identifiers before pilot.
- [ ] Physical statuses (Ready, Occupied, Cleaning, Maintenance) separate from reservation states.
- [ ] Show staff category/inventory board with safe status badges.

**Acceptance:** 15 rooms count; room status cannot be spoofed from guest API.

### C03 — Occupants, extras, operational settings
- [ ] Record adults/children and standard occupancy **advisories**, not invented hard caps.
- [ ] Family extra bed option with ₱100 single-stay charge; Double cannot buy extra bed.
- [ ] Configure cleaning buffer, alerts, GCash QR metadata and cancellation display settings with audit.
- [ ] Flag unverified compliance/legal maximum instead of treating unlimited booking as certified safe.

**Acceptance:** T03/T04 initial tests; owner-dependency safeguards documented in [[18-backlog]].

## Exit gate

- [ ] Catalog/pricing tests pass; no real production room numbers guessed.
- [ ] No future setting change rewrites booked prices.
- [ ] Update [[14-milestones]].

**Next:** [[04-availability-and-holds]].
