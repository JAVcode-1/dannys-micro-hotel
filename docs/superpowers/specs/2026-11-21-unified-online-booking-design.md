# Unified Online Booking implementation design

Owner authorization: the 2026-11-21 implementation request and UB-01–UB-06 supersede the unresolved mixed-booking policies in the earlier requirements synchronization report. Implement without routine approval pauses; leave all work uncommitted for inspection.

## Intended result

Guests can select independently scheduled rooms, one exclusive Function Hall, or both, obtain server prices and availability, verify their email, and create one reservation. One GCash reference and private screenshot cover 100% of its itemized total. Staff verify the actual transaction before atomic confirmation and an itemized confirmation notification. Staff retain physical room assignment/check-in and actual Hall start/completion.

## Architecture

Reuse the accommodation reservation, proof, verification, audit and notification infrastructure as the authoritative online transaction. Associate the existing Hall reservation/claim with its parent reservation; preserve separate Hall inventory, immutable pricing and event operations. Add explicit item payment allocations instead of duplicate Hall receipts or duplicated GCash references. Existing staff-managed Hall receipts retain their 50% minimum policy.

Cross-resource creation and confirmation use one PostgreSQL transaction and a consistent Hall-resource-before-reservation/category/claim lock order. Room-only hold creation preserves the existing category path; proof/review coordination takes the Hall lock when the unified schema is installed. Acquire every selected claim or roll back all changes. One 30-minute proof deadline applies to all selected items. Timely submitted proof protects every claim until staff resolves it; expiration releases all unpaid claims together. Guest ownership and active staff authorization remain mandatory in Express and privileged SQL paths.

Cancellation remains per item, eligible strictly before one hour after staff confirmation and before that item's actual start. Cancellation releases only that item's capacity. Manual refund approvals/transfers must be bounded by the item's verified allocation and earlier refunds; retries must not duplicate money. Rescheduling does not restart the cancellation clock. Staff-approved changes use the existing capacity checks; accommodation extensions require at least 50%, Hall extensions 100% of additional cost. Preserve reconciliation for paid late/conflicting transactions.

## Presentation and compatibility

Extend the existing planner and guest reservation/payment screens, preserving Royal Horizon styling. Show separate schedules, availability and charges with one total. Rates and Hall information link into preselected booking items. Staff show accommodation/Hall/mixed composition and use the existing Hall calendar and room operations. Ordinary financial inputs accept pesos with at most two decimals, while internal amounts remain integer centavos. User-visible times use Asia/Manila and AM/PM.

Existing accommodation-only and staff-managed Hall reservations remain compatible. Do not rewrite applied migrations. New SQL is a candidate additive migration, never applied to hosted Supabase in this task. Existing unresolved operational defaults remain configurable and explicitly provisional; no compliance or owner fact is invented.

## Safety and evidence

Production mutation gates remain closed. Use the existing loopback-only disposable `staytrack_test` composition, synthetic identities and in-memory private image/mail adapters. No real payment, email, hosted query or hosted migration is authorized. Run targeted transaction/financial regressions, affected UI checks and type checks; comprehensive suites, formal quality gate, hosted/device acceptance and deployment are deferred. Report implementation separately from acceptance.
