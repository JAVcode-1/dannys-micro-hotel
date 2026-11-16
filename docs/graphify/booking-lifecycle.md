---
tags: [graphify, diagram]
status: proposed
---
# Booking & Hold Lifecycle

```mermaid
flowchart TD
  A[Guest chooses allowed packages & independent schedules] --> B{Atomic category capacity feasible?}
  B -- No --> X[Offer different available schedule]
  B -- Yes --> C[Create 30-minute payment-proof hold]
  C --> D{Proof and reference submitted before deadline?}
  D -- No --> E[Expire hold and release claims]
  E --> F[If money transferred anyway: staff reconciliation]
  D -- Yes --> G[Protected pending manual GCash review]
  G --> H{Staff verified actual GCash transfer?}
  H -- No / disputed --> I[Reject / investigate; avoid silent paid-money loss]
  H -- Yes --> J{Final atomic feasibility + verification transaction succeeds?}
  J -- No --> K[Staff reconcile conflict / alternative or manual refund]
  J -- Yes --> L[Confirm reservation & each room-item]
  L --> M[Staff assigns Ready physical room and checks guest in]
  M --> N[Count down to scheduled end; overdue means flag only]
  N --> O[Staff checkout; mark Needs Cleaning]
  O --> P[Staff cleaning + Ready action]
```

**Timer dependencies:** On-time proof protects capacity past 30m; 15/30/60m review escalations don't auto-release. No-show after 1h arrival grace requires staff review. See [[04-feature-specification]].
