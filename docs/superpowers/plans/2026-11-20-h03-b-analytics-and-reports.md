# H03-B Analytics & Reports Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development if the owner selects delegation. Use test-driven development and track each step with its checkbox.

**Goal:** Deliver three reconciling staff reports with matching CSV and genuine XLSX downloads.

**Architecture:** Read scoped financial history in a read-only repeatable-read transaction. Compute cash events, attribution, and popularity in Express from one input model. Render the same projected rows in React and both export formats.

**Tech Stack:** Node.js 22+, Express, TypeScript, pg, React, Tailwind, PostgreSQL, and backend-only `write-excel-file@4.1.1` after verification.

**Spec:** [Approved specification](../specs/2026-11-20-h03-b-analytics-and-reports-design.md), commit `e3d8a1c`.

## Global constraints

- Apply all eight approved accounting decisions. Use Net Collections and immutable price and duration snapshots. Preserve uncertain history as unclassified or unattributed.
- Maximum range 366 Manila calendar days. Maximum export 10,000 data rows. Use Monday-start weeks, Manila calendar months, and half-open date intervals.
- Require existing active-staff authorization for both reads and downloads. Keep proof, payment references, contact information, and internal event keys out of output.
- Keep hosted Supabase untouched, live gates disabled, and hosted H01/H02 reconciliation pending. Any migration or index needs separate justification and approval.
- Deliver one H03-B development checkpoint on current `main`. The held badge, H04, and Function Hall are outside scope.

## Review focus

- Duplicate or conflicting registry ownership fails safely. Same-value cash records with distinct IDs both count.
- A released commitment and a refund can refer to money collected before the report period. Cash and attribution must still reconcile.
- PostgreSQL events can differ within a JavaScript millisecond. Preserve their order and reject unsupported replay assumptions.
- Export text can contain whitespace before formula markers. Protect CSV and verify XLSX stores literal strings.
- Signing out or changing filters while a report is in flight must clear private data and prevent stale results.

## File map

| Files | Responsibility |
|---|---|
| `packages/shared/src/analytics.ts`, `packages/shared/src/index.ts` | Filter and aggregate response contracts |
| `backend/src/analytics-calculator.ts`, `backend/test/analytics-calculator.test.mjs` | Exact cash replay, attribution, purchase counts and aggregation |
| `backend/src/analytics-data.ts`, `backend/test/h03-analytics-postgres.mjs`, `backend/test/zz-v02.integration.mjs` | Scoped snapshot queries and isolated integration fixtures |
| `backend/src/analytics.ts`, `backend/src/app.ts`, `backend/test/analytics.test.mjs` | Existing staff guard, validation, database loading and report routes |
| `backend/src/analytics-export.ts`, `backend/test/analytics-export.test.mjs`, `backend/package.json`, `package-lock.json` | CSV and XLSX generation and parity tests |
| `frontend/src/StaffAnalytics.tsx`, `frontend/src/StaffLogin.tsx`, `frontend/src/App.tsx`, `frontend/test/analytics.test.mjs` | Staff navigation, filters, report and download states |
| `docs/14-milestones.md`, `docs/17-decisions.md`, `docs/icm/PROJECT-CONTEXT.md`, `docs/phases/08-housekeeping-maintenance-and-reporting.md` | Checkpoint evidence and remaining acceptance |

### 1. Define the report contract and prove the calculator

- [ ] Write failing fixtures for exact-once cash recognition, partial and mixed collections, two-stage allocation, explicit allocations, timed releases, refunds, package eligibility, historical versions, and missing evidence. Include these hand-calculated assertions:

  ```js
  // Two room balances of 301 and 199 receive 101 centavos.
  assert.deepEqual(splitCentavos(101n, [301n, 199n]), [61n, 40n]);
  // The first room's balances are 201 package and 100 extra bed.
  assert.deepEqual(splitCentavos(61n, [201n, 100n]), [41n, 20n]);
  // A prior-period collection is refunded in the selected period.
  assert.deepEqual([gross, completedRefunds, net], [0n, 40n, -40n]);
  ```

- [ ] Run `npm run build -w backend` and `node --test backend/test/analytics-calculator.test.mjs`. Verify failure from the missing implementation or the specific financial assertion.
- [ ] Define `AnalyticsFilters` with inclusive Manila `from` and `through` dates, `grain` and optional `category`. Define `AnalyticsReport` with overall, transaction-period, category and package rows. Publish exact centavo amounts as decimal strings. Define normalized `AnalyticsInputs` in the calculator and expose `calculateAnalytics(inputs: AnalyticsInputs, filters: AnalyticsFilters): AnalyticsReport`. Use bigint internally. Split by integer quotient, then award leftover centavos in descending remainder order using the stable order of the inputs. Cap applications at supported outstanding balances and retain the remainder.
- [ ] Replay receipt, obligation and explicit allocation/release events through the cutoff with their full timestamp precision. Use recorded order to apply allocation changes and actual cash dates to bucket money. For example, an extension payment allocated before approval is gross cash immediately, but contributes to extension performance only once its funding and approval are established by the cutoff. Mark ambiguous historical line allocations unclassified. Deduct transfers on actual completion and link back to the original receipt and refundable item.
- [ ] Add cases for equal-value cash with distinct receipt IDs, join duplication, overage, tied centavos, revoked commitment, zero-price extension, below-minimum and qualifying deposits, approved cancellation and sibling preservation, unchanged confirmed-paid eligibility without check-in, and changed catalog rates. Prove gross, refunds and net reconcile separately at each applicable level. Rerun the targeted suite.

### 2. Read authoritative data within a bounded snapshot

- [ ] Add a named isolated subtest through `zz-v02.integration.mjs`. Seed mixed-source GCash attempts, unverified proof, same-amount cash, pre-window history, a refund with a prior-window payment, microsecond timestamp differences, and a concurrent insert between two reads. Assert the registry rejects the cross-source GCash duplicate and the report transaction observes one snapshot. Exercise malformed registry projections at the calculator/data boundary without weakening database constraints.
- [ ] Run `npm run test:db` against the existing disposable loopback test database and verify the new assertions fail for absent reporting support. Verify the target is local and isolated before running, and use the harness's existing local migrations.
- [ ] Implement `loadAnalyticsInputs(client: PoolClient, filters: AnalyticsFilters): Promise<AnalyticsInputs>`. The caller owns transaction lifetime. Select in-range financial and purchase candidates before expanding reservation history. Include referenced receipts, bookings, snapshots, cancellations, check-in/out, debits, credits, and allocation history before the cutoff. Resolve normalized GCash references privately against registry ownership and return validated source identities to the calculator. Deduplicate join rows by stable source identity. Use parameterized SQL and explicit projections.
- [ ] Start with a cumulative ceiling of 50,000 projected input rows, at most 10,000 candidate reservations, and a five-second transaction budget with a statement timeout constrained to the remaining time. Use limit-plus-one checks, abort the whole request on overflow, and run representative isolated `EXPLAIN (ANALYZE, BUFFERS)` for narrow and maximum accepted windows with unrelated historical rows. Record runtime and query shape, and adjust internal limits only from measured evidence. Confirm results under concurrency and prove the cap does not silently drop history. Keep schema unchanged.

### 3. Serve the staff report

- [ ] Write failing API tests for absent, guest, inactive and active staff credentials, validation, missing schema or query timeout, and sensitive-field exclusion. Seed transactions exactly at Manila midnight and around a Monday/month transition. Accept day 366 and reject day 367.
- [ ] Run `npm run build -w backend` and `node --test backend/test/analytics.test.mjs`; confirm the new route assertions fail.
- [ ] Implement `registerAnalytics(app: Express, staff: RequestHandler)` and mount it with the same active-staff guard used by `registerAudit`. Register `GET /staff/analytics`. Validate dates as real calendar dates and reject unknown grains or malformed category filters. Call `loadAnalyticsInputs` inside `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, commit or roll back and release the client, and project the calculator output. Return explicit validation, limit and unavailable responses with safe error bodies and private, non-cacheable headers.
- [ ] Rerun the API and isolated database tests. Confirm guest and inactive requests never reach report queries.

### 4. Export the report as CSV and XLSX

- [ ] Write failing tests that independently parse generated CSV and XLSX from the same report fixture. Compare ordered logical rows and monetary values. Include formula-like labels with leading space, tabs, commas, quotes and newlines. Assert literal XLSX cell types, no formula elements, and explicit failures for 10,001 rows or numbers that cannot preserve centavo precision in Excel.
- [ ] Verify the published MIT license, lockfile candidate integrity and resolved advisories before adding the pinned `write-excel-file@4.1.1` backend dependency. Check `fflate` against GHSA-px8p-9vwx-vf98. Document the result and stop dependency adoption if the required security checks cannot pass. Use an independent reader in acceptance.
- [ ] Implement `exportAnalytics(report: AnalyticsReport, format: "csv" | "xlsx"): Promise<Buffer>`. Build one ordered table of report rows for both serializers. In CSV escape quotes and delimiters and neutralize formula-leading text. In XLSX use literal text and numeric cells. Extend `registerAnalytics` with `GET /staff/analytics/export` using the same validation, snapshot and aggregation path and a validated format, fixed filename and correct MIME type.
- [ ] Run `npm run build -w backend` and `node --test backend/test/analytics-export.test.mjs backend/test/analytics.test.mjs`. Verify that filtered output and totals agree for the same snapshot.

### 5. Render the staff dashboard

- [ ] Add failing frontend coverage for staff navigation, filter submission, loading, empty, unavailable and export errors, session changes, and stale requests. Verify that a pending response from a prior session cannot render.
- [ ] Implement `StaffAnalytics({ token }: { token: string })` in the authenticated staff shell at `/staff/analytics`. Use date inputs, grain control and dynamic package category selection. Render gross, completed refunds, Net Collections, trends, category totals, package counts and package-only collections. Use accessible, responsive Royal Horizon components. Use the same applied filters for downloads and abort stale reads on filter or session changes.
- [ ] Run `npm test -w frontend`. Check desktop and narrow layouts, keyboard navigation, session clearing and each report state using synthetic data.

### 6. Verify and checkpoint

- [ ] Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and isolated `npm run test:db`. Record pass/fail/skip counts and the fixture reconciliation results. Keep formal phase acceptance open where evidence is absent, including explicit no-show cohort verification.
- [ ] Update the listed checkpoint notes with actual results, query bounds, XLSX dependency evidence, cash identity limitation and deployment conditions. Inspect the complete in-scope diff including new files. Stage explicit paths, review the staged diff and run Gitleaks with redaction. Keep unrelated workspace edits and private files out.
- [ ] Create the Conventional Commit for H03-B, push current `main` to existing `origin`, and verify remote state. Report the commit and push result and stop at H03-B.
