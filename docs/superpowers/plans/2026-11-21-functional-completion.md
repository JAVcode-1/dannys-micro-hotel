# Functional completion sprint implementation plan

**Goal:** Execute the owner-approved C01–C20 correction sprint while preserving UI-01 and keeping production writes closed.

**Architecture:** Reuse the existing Express transactional operations and React desks. Main owns shared routing/composition; guest, staff operations and Hall implementers own disjoint modules. The owner's sprint request supplies execution authorization and supersedes routine design/plan approval handoffs. No hosted database, real delivery or production activation is authorized.

## Baseline

Local main `4e573dd` is six commits ahead of cached origin/main `33d3cf4`. Existing tracked changes are Obsidian preferences; untracked editor, skill, nested-project and prototype files stay excluded. Preserve all six commits without rewriting. Review their complete diff and secrets before any push. The referenced full audit artifact is absent from canonical docs; the supplied sprint's descriptions define the correction mapping below.

## Ordered work and evidence

- [ ] C01: explicit early check-in approval, preserve purchased duration, conflict-safe claims; test earlier checkout, late arrival and sibling isolation.
- [ ] C02: authoritative readiness and explicit legacy inspection/reconciliation; test no fabricated Ready, concurrent maintenance and stale inspection.
- [ ] C03: persistent guest OTP session, refresh/logout and safe local return navigation; test restoration/event races and external redirect rejection.
- [ ] C04: public authoritative availability and booking review/atomic hold; test no-capacity, server pricing and duplicate hold replay.
- [ ] C05: owned payment/proof navigation; test foreign reservations, expired holds and pending-proof protection.
- [ ] C06: persisted accommodation no-show review/decisions; test authorization, grace boundary and no automatic release.
- [ ] C07: all-channel staff index/detail and guest history/detail; test pagination, search, ownership and financial summaries.
- [ ] C08: staff-assisted reschedule and maintenance resolution; test sibling isolation and overlapping claims.
- [ ] C09: catalog/category and physical administration controls; test active staff and audit.
- [ ] C10: funded Hall alternate schedule recovery; test preserved verified receipts and exclusive scheduling.
- [ ] C11: Hall payment/refund history and pending approvals; test financial reconciliation.
- [ ] C12: transactional delivery outbox, bounded retries, fake adapter and jobs; test crash retry, deduplication and protected holds.
- [ ] C13: durable Hall command recovery and duplicate cash prevention; test repeated/lost responses.
- [ ] C14: contextual navigation, actions and status labels; test unavailable states and held-review badge.
- [ ] C15: shared guest layout and routing; test selections across authentication/payment and explicit not-found.
- [ ] C16: contact capture, minor verification metadata and policy evidence; test no ID-photo persistence.
- [ ] C17: Hall conflict/overdue alerts and buffer reporting; test buffer-only period and AM/PM/PHP display.
- [ ] C18: PUT/PATCH CORS, proxy-aware limiting, transaction staff rechecks and audit attribution; test denied/retired actors and spoofed forwarding.
- [ ] C19: internal printable financial statement; test balances and explicit non-fiscal label.
- [ ] C20: isolated executable composition, schema readiness and synchronized contracts; test closed production defaults and loopback-only activation.

## Verification and delivery

For each change: write regression, observe failure, implement minimum correction, run focused check, inspect diff. Integrate without reverting another implementer's edits. Run build, typecheck, lint, format, complete application and isolated PostgreSQL suites, authorization/financial/concurrency regressions, browser checks and scanners. Independently review final diff and fix confirmed major/critical findings. Record absent checks honestly. Review explicit staged paths and secrets, commit verified checkpoints, push only after unpublished history is reviewed. Update milestones/decisions/context with actual evidence. No formal production acceptance or full quality-gate completion is claimed by this sprint.
