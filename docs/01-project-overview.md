---
tags: [scope, overview]
status: approved-baseline
---
# 01 — Project Overview

**Academic/proposal title:** StayTrack: Design and Development of a Web-Based Hotel Reservation and Management System with Automated Stay Duration Monitoring.

**Client:** Danny's Micro Hotel, a 24-hour micro hotel offering hourly room packages.

## Problem

Manual reservations, cash/GCash reconciliation, tracking of individual paid stay durations, room readiness, and managing online and walk-in demand create avoidable conflicts. Staff need a reliable timestamp-based countdown and shared inventory record.

## Goals

1. One guest online booking portal and one staff/admin dashboard for one hotel, designed for future multi-branch scalability.
2. Enforce offered packages, accurate financial totals, and true shared availability across online and walk-ins.
3. Implement staff-controlled check-in/out, cleaning, rescheduling, maintenance, payment verification, and audit.
4. Clearly surface approaching checkout, late arrivals, and long-pending payment verifications.
5. Deliver a testable cloud-based application that the hotel can operate and recover from outages using a documented procedure.

## Scope boundaries

- **Version 1:** single hotel, 15 rooms, category booking, independent booked-room schedules, manual GCash verification, cash/GCash walk-ins, staff management, and operational reports.
- **Not in v1:** automatic GCash payment gateway, automatic GCash refunds, local offline synchronization, multi-property staff UI, marketing e-commerce, third-party travel platform integration, sophisticated maintenance procurement.
- **Not promised:** legally compliant receipts/ID policies until local obligations are confirmed.

## User groups

- Guests (registered or verified no-account) — booking, payment proof, reservation view, eligible changes.
- Staff/Admin (individual accounts, one privilege tier) — full inventory, reservations, payments, room operations, settings, reconciliation, reports.

## Measures of success

- Zero successful conflicting room allocations in parallel-booking tests.
- All 15 room records tracked and filtered by their own physical status.
- Correct checkout countdown across reloads, delayed check-ins and approved extensions.
- 100% payment verification decisions and adjustments auditable by staff identity.
- Tested re-entry/reconciliation procedure for a simulated outage.

Next: [[02-requirements]] · [[13-development-roadmap]]
