---
tags: [hotel, home, planning]
status: baseline
---
# StayTrack — Danny's Micro Hotel

**Start of planning vault · No feature implementation started in this package**

> [!important] Project sequence
> Business-rule baseline → Architecture and schema design → Phase-by-phase build → Verification and release. **Coding is the next stage, not part of this deliverable.**

## Navigation

- [[docs/01-project-overview]] · Purpose, scope, outcomes
- [[docs/02-requirements]] · Confirmed business rules (source of truth)
- [[docs/03-user-roles-and-permissions]] · Access
- [[docs/04-feature-specification]] · Behavior and acceptance rules
- [[docs/05-tech-stack]] · Stack
- [[docs/06-architecture]] · Components and consistency
- [[docs/07-database-schema]] · Conceptual data model
- [[docs/08-security-and-risks]] · Controls
- [[docs/09-ui-ux-design-system]] · UI conventions
- [[docs/10-animation-and-motion]] · Motion accessibility
- [[docs/11-pages-and-navigation]] · Guest/staff sitemap
- [[docs/12-api-and-service-layer]] · API contract outline
- **[[docs/13-development-roadmap]]** · **What to build and in what order**
- **[[docs/14-milestones]]** · **Progress tracker (initially unchecked)**
- [[docs/15-testing-plan]] · Release gates
- [[docs/16-deployment]] · Cloud and outage plan
- [[docs/17-decisions]] · Approved decisions / pending clarifications
- [[docs/18-backlog]] · Pending owner answers and future scope
- [[docs/19-seed-data]] · Config and test fixtures
- [[docs/20-naming-conventions]] · Coding standards
- [[docs/21-before-coding-checklist]] · Prerequisites before Phase 01 F01 coding
- **[[docs/22-supabase-setup]] · Supabase setup, Auth/Storage proposal, secure key handling and migrations**

## Implementation phase checklist

- [[docs/phases/00-phase-gates]] — Rules for starting/finishing a phase
- [[docs/phases/01-foundation-and-tooling]] — Repository and developer tooling
- [[docs/phases/02-auth-and-authorization]] — Individual staff identity
- [[docs/phases/03-catalog-inventory-settings]] — Physical rooms, packages, settings
- [[docs/phases/04-availability-and-holds]] — Conflict-safe inventory engine
- [[docs/phases/05-online-booking-and-gcash]] — Guest flow and manual GCash verification
- [[docs/phases/06-walkins-and-stay-monitoring]] — Staff operations and countdown
- [[docs/phases/07-changes-refunds-and-ledger]] — Changes, extensions, cancellations, financial ledger
- [[docs/phases/08-housekeeping-maintenance-and-reporting]] — Physical operations and reports
- [[docs/phases/09-hardening-pilot-and-release]] — Security, testing, pilot, deployment

## Diagrams and agent integrations

- [[docs/graphify/README]] · Architectural Mermaid maps; future Graphify indexing
- [[docs/icm/README]] · ICM memory seeding instructions
- [[docs/icm/PROJECT-CONTEXT]] · Compact handoff for new coding sessions
- [[AGENTS]] · Guardrails for AI coding agents

## Rule for every new work session

1. Read [[docs/icm/PROJECT-CONTEXT]], [[docs/17-decisions]] and the current phase page.
2. Identify one unchecked task, its dependency, and measurable tests.
3. Make changes in a small branch/commit after the design phase begins.
4. Update the task checklist and record any new decision **in Markdown first**; optionally sync to ICM and update the Graphify index.

**Local timezone:** Asia/Manila. **User-visible times:** 12-hour AM/PM only.

## Approved visual baseline — Danny's Royal Horizon

- [[docs/09-ui-ux-design-system|Approved color, accessibility and component spec]]
- [[docs/design/brand-and-navigation-brief|Royal Horizon palette, real hotel photographs and sample navigation]]
- **[[docs/21-before-coding-checklist|START HERE BEFORE CODING — required preparation and phase gates]]**
- Approved by project requester for software design on **2026-11-12**. This does not replace operational requirements or assert hotel-management trademark signoff.

## Platform selection update — 2026-11-12

**Supabase-managed PostgreSQL is approved** as D-035; the React frontend, separate Node/Express API and approved Royal Horizon theme are unchanged. Start with [[docs/22-supabase-setup|Supabase setup checklist]]. This is a **documentation revision only** and does not mean Supabase is configured.
