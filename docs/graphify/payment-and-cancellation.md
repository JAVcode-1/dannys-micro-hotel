---
tags: [graphify, diagram]
status: proposed
---
# Payment, Cancellation & Modification Flow

```mermaid
flowchart TD
  R[Reservation: shared guest + money account] --> I1[Booked room item A]
  R --> I2[Booked room item B]
  I1 --> C1{Change requested?}
  C1 -- Cancel --> C2{Within 1h since online staff confirmation and not checked-in?}
  C2 -- Yes --> RF[Staff-approved manual eligible GCash refund]
  C2 -- No --> NR[Non-refundable under normal policy; legal exception review]
  C1 -- Reschedule --> RS[Staff review + atomic new availability]
  C1 -- Extend --> EX[Staff check availability + 50% extension payment]
  RS --> R
  EX --> R
  RF --> L[Append itemized refund/ledger entry]
  NR --> L
  I2 --> UN[Other item schedule/status remains unchanged]
```

Refunds never execute automatically from an uploaded QR screenshot; staff logs verified recipient and transfer reference. Cancellation window is **not** renewed by rescheduling. See [[02-requirements]] and [[07-database-schema]].
