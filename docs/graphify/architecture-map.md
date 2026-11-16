---
tags: [graphify, diagram, supabase]
status: proposed
---
# Architecture Map — React, Express and Supabase

```mermaid
flowchart LR
  Guest[Online Guest] --> Web[React + TypeScript]
  Staff[Staff/Admin] --> Web
  Web -->|Business API| API[Node.js / Express]
  Web -.->|Login / OTP only| Auth[Supabase Auth]
  API -->|Validate identity| Auth
  API --> Booking[Reservation + Pricing Service]
  API --> Inv[Atomic Availability + Hold Engine]
  API --> Money[Manual Payment Review + Ledger]
  API --> Stay[Stay Countdown + Hotel Ops]
  Booking --> PG[(Supabase PostgreSQL)]
  Inv -->|Transactional locks| PG
  Money --> PG
  Stay --> PG
  Money --> Files[Supabase Storage: Private GCash Proofs]
  API --> Mail[Email Notifications]
```

## Boundaries

- Browser cannot approve payment, release room claim or mutate room price.
- Supabase manages data/identity/file services; **separate Express API** retains business rules.
- All channels share one PostgreSQL inventory, with maintenance and cleaning buffers.
- Staff verifies actual GCash and manually handles refunds.
- One reservation may contain multiple independently scheduled room bookings.
- Payment proof uploads stay private; never expose secret key to browser.

See [[06-architecture]] · [[12-api-and-service-layer]] · [[22-supabase-setup]].
