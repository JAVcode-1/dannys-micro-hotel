# C01–C20 functional completion tracker

Owner-authorized sprint, 2026-11-21. All corrections below have implementation and automated regression evidence. **Browser/staff-device acceptance remains unverified**, so these are development checkpoints, not formal phase completion or a production gate. UI refinement stays paused. Production writes and hosted migrations remain closed.

| ID | Implemented correction | Evidence |
|---|---|---|
| C01 | Explicit early-arrival reason, purchased duration preserved, conflict-safe claims, extension branch retained | Check-in unit tests; staff PostgreSQL duration/extension test |
| C02 | Authoritative readiness, current legacy inspection after checkout, no fabricated cleaning events, buffer protection | Staff PostgreSQL and room-correction UI tests |
| C03 | OTP session restoration/refresh/logout and safe return paths | Guest session/OTP tests |
| C04 | Server quote, authoritative public availability, contact/policy review, atomic hold, accepted-price check | Planner tests and isolated HTTP booking flow |
| C05 | Owned payment page, official configured QR interface, proof/reference, countdown, protected review, verified historical receipt state | Payment unit/UI tests and isolated HTTP hold→proof→staff verification |
| C06 | Persisted manual no-show/expected decisions, actor/reason, serialized latest decision, no automatic release | Staff PostgreSQL no-show ordering/replay tests |
| C07 | Paginated guest history/detail, all-channel staff search/detail, payments/refunds and effective stay times | Guest/workspace UI, isolated HTTP and extension detail regression |
| C08 | Contextual staff-assisted per-item reschedule and maintenance-affected reassignment preserving money/siblings | Workspace UI, X02 races and staff PostgreSQL reassignment |
| C09 | Category name/activation/package controls; existing physical-room identifier and active-state administration | Catalog authorization tests; staff PostgreSQL admin/capacity tests |
| C10 | Funded Hall inquiry alternate schedule recovery preserving verified receipts | Hall operations PostgreSQL recovery/replay regression |
| C11 | Hall verified payment/refund history and retrievable pending approvals | Hall operations DB and rendered recovery/refund UI tests |
| C12 | Private transactional outbox, bounded leased retry, fake adapter, reminders/hold expiry, atomic OTP/invitations and scheduled consented invitations | Outbox/review transaction tests and isolated PostgreSQL |
| C13 | Durable subject-scoped Hall command retry/result retrieval and duplicate cash-command prevention | Hall command-state/UI and financial replay DB tests |
| C14 | Contextual actions, correct proof-pending label, protected navigation and explicit unavailable states | Navigation/workspace/payment/room UI tests |
| C15 | Shared guest layout, actual guest routes, preserved selections across OTP/payment, explicit not-found | Navigation/session/planner tests |
| C16 | Guest and walk-in contact/policy snapshots; minor ID check status/actor/time without ID image/number persistence | Contact parser/UI and private immutable rollback/replay PostgreSQL tests |
| C17 | Hall refresh/preparation/overdue alerts, buffer-only reporting, PHP and AM/PM presentation | Hall tests and buffer-only PostgreSQL reporting regression |
| C18 | PUT/PATCH CORS, explicit proxy trust, optional shared PostgreSQL rate limits, transaction staff rechecks and cross-module audit | CORS/auth tests, 40-contender shared-limit DB test, audit regressions and source scans |
| C19 | Internal printable reservation/financial statement, effective checkout, verified history; explicit non-fiscal label | Workspace UI and extension detail DB regression |
| C20 | Explicit loopback-only composition, development-only fixture auth/modules, complete workflow readiness probe, local schema generation | Isolation tests, integrated HTTP flow and full migrated catalog types |

## Verification

- Full application suite: **195 passed** — 123 backend and 72 frontend; zero failures/skips.
- Expanded isolated PostgreSQL suite: **39 passed**, zero failures/skips. Includes migrations/ACLs, actor/ownership, financial reconciliation, concurrent requests, no-show ordering, item isolation, recovery and rollback.
- Build, typecheck, lint and formatting checks passed. Existing frontend bundle-size warning remains; this is not a performance acceptance result.
- Gitleaks reviewed six unpublished UI commits with no leaks. Current source scan found only five synthetic idempotency identifiers; scoped comments document these false positives, without disabling rules. Final rescanning recorded in [[sprint-verification]].
- OSV lockfile scan exited 0. Semgrep local starter rules ran 4 rules on 107 targets with zero findings; limited coverage, not a comprehensive security gate.
- Independent reviews identified and corrected maintenance pool leakage, non-atomic review delivery, missing forward extension support, stale readiness recovery, no-show ordering, effective-checkout printing, fixture token/module/readiness wiring and verified-payment history after item release.
- Actual Windows browser checks were attempted but Computer Use stopped because it could not determine the URL confidently. Automated rendered UI tests and HTTP integration are **not** a substitute for completed browser/staff-device acceptance.

## Remaining external acceptance and deployment dependencies

Owner-confirmed room identifiers and actual inventory reconciliation; legal/privacy/minor/policy approvals; real hotel GCash QR/payee verification; official email adapter/credentials and durable provider idempotency; real staff/device/browser checks; separately approved hosted migrations and full predeployment quality gate. Existing physical-room rows can be administered; no identifiers or additional inventory were invented. Hall stays staff-assisted, refunds manual and no fiscal-receipt compliance claim is made.

Read [[isolated-development]] and [[11-pages-and-navigation]]. No Graphify/ICM executable integration was claimed. Unrelated Obsidian/editor/prototype/nested-project files remain excluded. Commit/push evidence is in [[sprint-verification]].

**Verdict: NOT READY — FUNCTIONAL DEVELOPMENT REMAINS.** Implementation is at an automated development checkpoint; required browser acceptance remains blocked, and external activation dependencies remain open. No formal functional freeze is claimed.
