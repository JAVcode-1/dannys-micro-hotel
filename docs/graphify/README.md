---
tags: [graphify, diagrams]
status: prepared-not-indexed
---
# Graphify — Code Graph Preparation & Diagrams

**These are design diagrams, not a generated Graphify knowledge graph.** Graphify Labs' tool indexes actual source files, Markdown docs and architecture decisions when **installed and executed** in your local environment. This ZIP does not claim a Graphify run.

## Documentation diagrams usable now

- [[architecture-map]] — guest/staff/api/db architecture
- [[booking-lifecycle]] — guest hold/verification/reservation lifecycle
- [[payment-and-cancellation]] — money and room-item changes
- [[data-relationships]] — proposed relational entity map

Each page contains an Obsidian-renderable Mermaid block. Corresponding `.mmd` files are included for tools that render standalone Mermaid.

## When code begins

1. Keep this docs folder beside `frontend`, `backend`, and `packages/shared` in the project root.
2. Install **Graphify Labs** using its official current instructions: <https://github.com/Graphify-Labs/graphify>.
3. Optionally install its coding-agent integration via an officially supported platform setup command (e.g. `graphify install --platform agents`, subject to current docs/version).
4. From project root, run the Graphify command/skill according to your installed version to index **both code and docs**. Its output is tool/version-specific, so do **not** fake a prebuilt `graph.json` here.
5. After every architecture-changing phase, re-index as required and ask Graphify about cross-file dependencies; persist approved decisions in [[17-decisions]] first.

## Useful future Graphify queries

- What functions can create or release an inventory claim?
- Which write paths could mark a reservation `confirmed` without a staff GCash verification?
- Where does a room booking's `scheduled_end_at` get updated?
- Which changes affect a multi-room reservation's balance and item cancellations?
- What modules handle maintenance blocks, turnover and Ready state?

**Official source:** https://github.com/Graphify-Labs/graphify (verified Nov 2026). All diagram text below is the project's own proposed architecture.
