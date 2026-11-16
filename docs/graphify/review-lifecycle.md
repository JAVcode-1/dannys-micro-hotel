---
tags: [graphify, reviews, phase-08]
status: proposed-diagram
---
# Verified Guest Review Lifecycle

Diagram of approved Phase 08 guest reviews, public browsing, one-review-per-completed-reservation, and staff-only private feedback. This is a **proposed workflow**, not proof of implemented code.

```mermaid
flowchart TD
    A[Public visitor] --> B[Browse hotel and published reviews]
    A --> C{Recorded completed stay and verified primary guest?}
    C -- No --> D[Cannot submit public rating]
    C -- Yes --> E{Identity path}
    E --> F[Account ownership]
    E --> G[Verified online booking email: single-use link]
    E --> H[Verified walk-in contact]
    F --> I{Already reviewed this reservation?}
    G --> I
    H --> I
    I -- Yes --> J[Reject duplicate or replay]
    I -- No --> K[Submit 1-5 stars + optional comment OR private feedback]
    K --> L{Feedback visibility}
    L -- Private --> M[Staff-only feedback inbox]
    L -- Public --> N{Objective policy abuse flagged?}
    N -- No --> O[Publish genuine review, any star count]
    N -- Yes --> P[Moderation check with audit]
    P -- Valid content --> O
    P -- Policy violation --> Q[Hide with documented reason]
    O --> R[Public average includes published rating]
    Q --> S[Staff may restore with audit]
    S --> R
```

Related specification: [[24-verified-guest-reviews]].
