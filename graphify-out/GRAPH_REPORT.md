# Graph Report - Dannys-Micro-Hotel  (2026-11-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1233 nodes · 3883 edges · 54 communities (48 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f9d45a64`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52

## God Nodes (most connected - your core abstractions)
1. `BookingError` - 165 edges
2. `notifySuccess()` - 87 edges
3. `staytrack.room_bookings` - 59 edges
4. `claimTransaction()` - 50 edges
5. `createApp()` - 47 edges
6. `databasePool()` - 47 edges
7. `staytrack.reservations` - 37 edges
8. `apiBase` - 34 edges
9. `staytrack.guard_stay_charge_entry()` - 32 edges
10. `hasControlCharacters()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `save()` --indirect_call--> `value()`  [INFERRED]
  frontend/src/OperationalSettings.tsx → backend/src/review-routes.ts
- `submit()` --indirect_call--> `note()`  [INFERRED]
  frontend/src/StaffPaymentReviews.tsx → backend/src/cancellations.ts
- `recover()` --indirect_call--> `email()`  [INFERRED]
  frontend/src/StaffLogin.tsx → backend/src/review-routes.ts
- `validate()` --indirect_call--> `email()`  [INFERRED]
  frontend/src/StaffLogin.tsx → backend/src/review-routes.ts
- `read()` --calls--> `BookingError`  [EXTRACTED]
  backend/src/analytics-data.ts → backend/src/booking-quote.ts

## Import Cycles
- 2-file cycle: `backend/src/hall-reservations.ts -> backend/src/unified-booking.ts -> backend/src/hall-reservations.ts`
- 3-file cycle: `backend/src/hall-reservations.ts -> backend/src/unified-hall-actions.ts -> backend/src/unified-booking.ts -> backend/src/hall-reservations.ts`
- 3-file cycle: `backend/src/hall-payments.ts -> backend/src/payment-review.ts -> backend/src/unified-booking.ts -> backend/src/hall-payments.ts`
- 4-file cycle: `backend/src/claim-holds.ts -> backend/src/unified-booking.ts -> backend/src/hall-payments.ts -> backend/src/payment-review.ts -> backend/src/claim-holds.ts`
- 4-file cycle: `backend/src/hall-payments.ts -> backend/src/payment-review.ts -> backend/src/unified-booking.ts -> backend/src/hall-reservations.ts -> backend/src/hall-payments.ts`
- 5-file cycle: `backend/src/hall-payments.ts -> backend/src/payment-review.ts -> backend/src/unified-booking.ts -> backend/src/hall-reservations.ts -> backend/src/unified-hall-actions.ts -> backend/src/hall-payments.ts`
- 5-file cycle: `backend/src/claim-holds.ts -> backend/src/unified-booking.ts -> backend/src/hall-reservations.ts -> backend/src/hall-payments.ts -> backend/src/payment-review.ts -> backend/src/claim-holds.ts`

## Communities (54 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (36): charge_disclosure_guard, extended_room_block, stay_allocation_guard, stay_charge_guard, stay_checkout_settlement, stay_extension_decision_apply, stay_extension_decision_guard, stay_extension_request_apply (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (37): staytrack.rooms, staytrack.room_blocks, staytrack.protect_o01_prices(), staytrack.protect_online_confirmation(), staytrack.protect_payment_review_history(), staytrack.schedule_payment_reminders(), checked_in_claim_protected, room_check_in_immutable (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (41): hallDepositMet(), hallRefundTransferAmount, hallStartPaymentIssue(), normalizeHallReceipt(), hallReport(), day(), applyCommand(), fail() (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (42): allowsReviewAction(), ChallengePurpose, createReviewGrant(), CredentialPurpose, finishReviewOtp(), issueCredential(), issueReviewInvitation(), loadReviewEligibility() (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (40): hotelTime(), peso(), GuestCancellationRequest(), submit(), GuestPayment(), PaymentPanel(), bookingGroup(), GuestHallItem() (+32 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (33): staytrack.payment_submissions, staytrack.verified_online_payments, refund_claim_guard, refund_transfer_guard, staytrack.guard_cancellation_request(), staytrack.guard_manual_refund(), staytrack.refund_claims, staytrack.refund_transfers (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (32): insertBookedItems(), parseBookingItems(), priceBooking(), quoteBooking(), QuotePackage, bookingPolicy, createGuestHold(), parseBookingContact() (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (22): Package, developmentAuthAllowed(), Purpose, GuestAccess, GuestContext, OccupancyGuide(), Result, OperationalSettings() (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (31): bookingReference(), StaffLogin(), recover(), signIn(), updatePassword(), validate(), Detail, HallItem (+23 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (31): staytrack.room_bookings, item_pending_reschedule_unique, reschedule_approved_revision, reschedule_claim_projection_guard, reschedule_decision_apply, reschedule_decision_guard, reschedule_guest_retry, reschedule_projection_guard (+23 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (26): CheckInDesk(), reviewNoShow(), submit(), fixtures(), Item, time(), notifySuccess(), save() (+18 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (25): Allocation, Charge, CollectionHistory, group(), Item, Money, Part, purchaseDate() (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (22): probeDatabase(), probeWorkflowSchema(), GuestIdentity, verifyGuest(), createHostedDevelopmentApp(), createIsolatedApp(), RuntimeComposition, paymentMediaStore() (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (28): maintenance_events_block, maintenance_immutable, maintenance_terminal_actions, staytrack.maintenance_events, feedback_event_retry, protect_guest_review, protect_review_events, protect_review_replies (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (25): reservation_price_immutable, reservations_owner, room_booking_price_immutable, staytrack.reservations, online_confirmation_immutable, payment_notification_pending, payment_review_immutable, staytrack.payment_notification_outbox (+17 more)

### Community 15 - "Community 15"
Cohesion: 0.26
Nodes (27): decideExtension(), registerStayChanges(), requestExtension(), stayChangeRows(), validateExtensionCapacity(), minimumExtensionPayment(), nextExtensionCheckout(), parseExtensionInput() (+19 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (17): packages_one_active_duration, staytrack.packages, staytrack.room_categories, inventory_claims_category_active, room_blocks_room_time, rooms_id_category, staytrack.claim_requests, staytrack.inventory_claims (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (25): CancellationDesk(), load(), submit(), emptyPayer, emptyTransfer, fixtures(), PayerForm, refundAmounts() (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (24): PaymentMediaStore, PROOF_BUCKET, QR_BUCKET, validatePaymentImage(), checkId(), configurePaymentQr(), confirmedRollback(), guestPaymentSession() (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (25): App(), AppOptions, GuestLayout(), NotFound(), ReservationRoute(), Catalog(), GuestAccess(), send() (+17 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (21): GuestHallChange(), submit(), ManilaDateTimeInput(), update(), decisions, labels, money(), PaymentReviewPanel() (+13 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (23): hallCentavos, PendingHallCommand, pendingHallCommand(), Finances, hallActionLabels, HallCardAction, HallCardActionForm(), HallCardActions() (+15 more)

### Community 22 - "Community 22"
Cohesion: 0.24
Nodes (21): BookingError, activeStaff(), assertNoCancellation(), cancellationRows(), decideCancellation(), key(), knownError(), lockItem() (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (14): MobileNavGroup, shortLabels, StaffMobileNavigation(), queueDescriptions, StaffNavBadge(), StaffNavCounts, groupIcons, icons (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (17): app, closeDatabase(), configuredMailAdapter(), escape(), peso(), renderBookingMail(), time(), enqueueMail() (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.19
Nodes (18): staff_audit_actor_time, staytrack.staff_audit, cancellation_claim_guard, cancellation_decision_apply, cancellation_decision_guard, cancellation_guest_retry, cancellation_request_guard, cancellation_staff_retry (+10 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (17): adminFile, app, delivery, guest, loginWindow, mail, objects, options (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (16): BookingPlanner(), checkAvailability(), hold(), submit(), bookingRequestKey(), Draft, HallDraft, hallInput() (+8 more)

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (11): createDevelopmentAuth(), emit(), load(), login(), landingAnchors, navigation, start(), restoreSuccessToast() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (17): hotelContact, CatalogPackage, Contact(), currency, Header(), LandingPage(), Logo(), Photo (+9 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (17): allocateRooms(), search(), Occupancy, overlaps(), Range, Room, RoomBlock, validRange() (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (14): claimTransaction(), maintenanceBoard(), reassignMaintenanceBooking(), recordMaintenance(), registerMaintenance(), registerPhysicalRoom(), administerRoom(), inspectLegacyRoom() (+6 more)

### Community 32 - "Community 32"
Cohesion: 0.27
Nodes (16): Actor, chooseRescheduleRoom(), conflict(), decideReschedule(), known(), lockItem(), classifyReschedule(), parseRescheduleInput() (+8 more)

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (12): staytrack.staff_accounts, gcash_registry_immutable, online_gcash_reference, staytrack.gcash_reference_registry, staytrack.guard_walkin_ledger(), staytrack.register_gcash_reference(), staytrack.walkin_ledger, walkin_gcash_reference (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.24
Nodes (14): createApp(), changePackagePrice(), publicCatalog(), setPackageActive(), staffCatalog(), updateCategory(), databasePool(), getSettings() (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.19
Nodes (13): BookingItemInput, BookingQuote, GuestReservation, OnlineHallInput, OnlineHallItem, OnlineHallQuote, CancellationDecisionInput, CancellationRow (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.27
Nodes (13): expireClaims(), reviewAge(), submitClaimProof(), validTime(), guestReservations(), parseReservationSearch(), registerReservationWorkspace(), reservationState() (+5 more)

### Community 37 - "Community 37"
Cohesion: 0.16
Nodes (13): Category, NewPackage, PackageUpdate, CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema (+5 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (13): ExtensionDecisionInput, ExtensionInput, ExtensionRow, StayAllocationInput, StayAllocationRow, StayChangeRow, StayChargeRow, StayEvent (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.26
Nodes (11): approvedAmounts, assertOwnership(), Db, guestItem, Issue, issueText(), Kind, registerRefundIssues() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (11): HallAnalytics(), HallReport, Money, money(), pesos(), Report, RoomAnalytics(), getExport() (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.30
Nodes (9): ClockAnchor, countdown(), serverTime(), fixtures(), Item, money(), StayMonitor(), depart() (+1 more)

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (6): HousekeepingAction, HousekeepingEvent, HousekeepingInput, StaffRoom, MaintenanceAction, RoomMaintenance

### Community 43 - "Community 43"
Cohesion: 0.43
Nodes (5): auditDate(), parseAuditFilters(), registerAudit(), sources, staffAudit()

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (5): RescheduleDecisionInput, RescheduleEligibility, RescheduleInput, RescheduleRecord, RescheduleSnapshot

### Community 45 - "Community 45"
Cohesion: 0.80
Nodes (5): WalkInDesk(), api(), create(), payment(), quoteItems()

### Community 46 - "Community 46"
Cohesion: 0.40
Nodes (4): HallChannel, HallQuoteInput, HallSettings, HallSetup

### Community 47 - "Community 47"
Cohesion: 0.50
Nodes (3): PaymentDecision, PaymentReviewInput, StaffPaymentReview

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BookingError` connect `Community 22` to `Community 32`, `Community 34`, `Community 2`, `Community 36`, `Community 3`, `Community 6`, `Community 39`, `Community 43`, `Community 11`, `Community 12`, `Community 15`, `Community 18`, `Community 31`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06957047791893527 - nodes in this community are weakly interconnected._
- **Why does `notifySuccess()` connect `Community 10` to `Community 4`, `Community 7`, `Community 40`, `Community 8`, `Community 41`, `Community 17`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 27`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10324675324675325 - nodes in this community are weakly interconnected._
- **Why does `staytrack.room_bookings` connect `Community 9` to `Community 0`, `Community 1`, `Community 33`, `Community 5`, `Community 14`, `Community 16`, `Community 25`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12163265306122449 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11879432624113476 - nodes in this community are weakly interconnected._