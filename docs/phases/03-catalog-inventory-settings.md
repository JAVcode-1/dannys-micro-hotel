---
tags: [phase-03, implementation]
status: not-started
---
# Phase 03 — Catalog, Room Inventory & Settings

**Cross-phase status reconciliation - 2026-11-19 (after W03):** C01-C03 are development checkpoints. Later O01/W01-W03 code and reused CI now demonstrate persisted per-room bookings and immutable booked-price snapshots; older statements that reservation tables do not exist or snapshots have no automated test are historical. Verified actual 10 Standard + 5 Family room identities, owner operational/legal settings and full hosted/phase acceptance remain pending. The formal Phase 03 exit remains FAIL. This documentation review reuses W03 CI (96 application + 11 isolated PostgreSQL tests); no new tests or hosted operations are claimed. Phase 06 also fails formal acceptance; Phase 07 X01 is identified only, not started. See [[06-walkins-and-stay-monitoring]].


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


**C03 development checkpoint (2026-11-18):** Added server-side adults/children advisory evaluation and Family-only one-extra-bed ₱100 single-stay quote; no Double extra bed or per-person surcharge. The public /rooms guide labels legal/safety limits unverified and requires staff review above usual occupancy. Prepared unapplied 20261118000200_operational_settings.sql with nullable cleaning buffer, checkout alert, private GCash QR metadata and cancellation text; protected Express staff settings reads/writes audit the actor. Existing reservation tables do not exist, so per-room occupant persistence and extension-safe one-time extra-bed charge remain pending for the booking phase. QR storage and legal policy approval remain gated. Isolated SQL/RLS test is prepared but unrun without TEST_DATABASE_URL; no hosted migration or settings write occurred. Phase 02, C01 and C02 acceptance debt remains open.

**Phase 03 exit-gate review (2026-11-18): FAIL for formal completion.** The F02 catalog migration contains exactly seven approved package rows (Double 3/6/12/24 hours; Family 6/12/24 hours), and the server rejects Family 3 hours. Public reads show active packages; staff-only price, package, category and settings writes use actor authorization and transactional audit. The staff room board reads physical state without a guest write route. GitHub Actions CI run [#17](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44250093933) passed build, typecheck, lint, formatting, application tests and four isolated PostgreSQL tests, including a rolled-back fixture of exactly ten Double and five Family rooms and settings RLS/role-denial checks. A read-only hosted catalog check previously confirmed the seven active rates. No production room identifiers were guessed.

**Exit evidence update:** Owner-confirmed identifiers and 15 real room entities are absent; the CI fixture is not live inventory. Reservation tables do not exist, so accepted-price snapshots and the rule that future setting changes cannot rewrite booked prices are untested. The C03 operational-settings migration was subsequently applied; its version was verified in migration history and the staff screen persisted the 15-minute cleaning buffer and 30-minute checkout alert (owner-reported verification). The missing room inventory and snapshot evidence still block the Phase 03 milestone and any live booking rollout. Development-stage debt retained: per-room occupant persistence, one-time extra-bed charge across extensions, QR Storage, legal/policy values, and earlier Phase 01/02 acceptance gaps. No full milestone quality gate or comprehensive acceptance result is claimed. Exit checkboxes remain open; next documented task is Phase 04 V01, only when instructed.
