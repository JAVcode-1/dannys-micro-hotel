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


**C01 development checkpoint (2026-11-18):** Existing F02 migration already defines categories, versioned packages and seven approved rows. Added public active-package catalog, /rooms rate view, and a staff-only audited price revision with a staff editor. Server rejects Family 3-hour and invalid prices. Build, typecheck, lint and 39 application tests pass (25 backend, 14 frontend). Full staff settings CRUD, isolated price-version transaction test, hosted catalog verification and booked-price snapshot behavior remain pending; C01 and Phase 03 exit checkboxes stay open. No migration was added or applied. A01/A02/A03/F02/F03 acceptance debt remains open.


**C01 follow-up (2026-11-18):** Staff-only catalog history read, package activate/deactivate, and category name/active updates now use Express membership checks and transactional staff audit. Price revision transaction tests cover new version insertion and rollback on audit failure; route tests deny anonymous and non-staff users. A read-only check against the configured hosted development project verified all seven active approved rates. Build, typecheck, lint and 43 application tests passed (29 backend, 14 frontend). No migration or hosted write was performed. Booked-price snapshots still require reservation tables in Phase 05; isolated PostgreSQL write/rollback integration remains pending. Existing A01/A02/A03/F02/F03 debt stays open. C01 remains a verified development checkpoint, not a Phase 03 exit gate.


**C02 development checkpoint (2026-11-18):** The F02 migration already defines staytrack.rooms with category, unique code, active=false and a physical operational state; no new migration is necessary or applied. Added protected Express /staff/rooms and a responsive staff room board with labelled Ready/Occupied/Cleaning/Maintenance/Unverified states. There is no guest room-state API or guest write route. A test-only isolated PostgreSQL fixture inserts DS-TEST-01..10 and FE-TEST-01..05 inside a rolled-back transaction; it has not run without TEST_DATABASE_URL. Hosted room rows remain absent pending owner-confirmed real identifiers, so 15-live-room acceptance remains open. Phase 02 and C01 acceptance debt remains documented.
