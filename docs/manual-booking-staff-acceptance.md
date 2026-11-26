# Booking and Staff Admin Manual Test Guide

Prepared November 23, 2026, for the current StayTrack repository. Use this guide to operate the actual guest and Staff/Admin screens and compare what happens with the expected result. It covers normal journeys, invalid input, money, timing, independent room items, the Function Hall, privacy and recovery. It is a broad acceptance suite; no finite checklist proves every possible input or concurrency condition.

**All cases start NOT RUN.** Writing this guide did not run the application, send emails, create bookings, verify payments or pass acceptance. A screen existing in source does not establish that its hosted configuration is ready.

## 1. Prepare before testing

### Choose the environment

| Environment | Startup | What this means |
|---|---|---|
| Configured Supabase development | `npm run dev` from the repository root | Current startup uses the real development Supabase configuration in `backend/.env`. Records persist remotely. Use only the designated development project and authorized test records. This is not the disposable harness. |
| Disposable local harness | `npm run dev:isolated` | Separate local test composition. Use synthetic rooms, payment images and receiving records. Restarting the full composition recreates its disposable database; record evidence first. Some provider/auth behavior differs from hosted development. |

Open `http://127.0.0.1:5173`, or the actual test deployment URL. Run only one composition at a time. Node.js 22+ and installed workspace dependencies are required. If startup stops, record the error and mark dependent tests BLOCKED; do not reset the hosted database or apply migrations to get past it.

The current `scripts/dev.mjs` and the opening of [README](../README.md) supersede older notes saying that `npm run dev` uses synthetic accounts. See [hosted development setup](hosted-booking-setup.md) for the room-registration, OTP and email dependencies. Do not copy fixture credentials into the hosted app.

The current isolated launcher also advertises **real Supabase guest email OTP**, while booking data and staff access remain local. Therefore isolated mode is not necessarily fully offline: inspect its startup notice and use an inbox you control. Its fake application-notification mailbox does not prove real Auth email or production Storage delivery. Do not assume the older fixed guest OTP instructions apply to the current launcher.

Use synthetic payment verification only in an isolated test environment. A fake screenshot is useful for rejection tests; it is never evidence of a real transfer. Real GCash verification/refund acceptance requires a separately arranged, owner-authorized transaction and actual receiving/sending records. Mark it BLOCKED when those are unavailable. The application does not transfer refunds automatically.

### Have these ready

1. Browser profile A for Guest A, a separate browser/profile B for Guest B, and profile C for Staff A. Incognito windows in the same browser may share one session; use separate profiles for ownership tests.
2. Two individual active staff accounts for actor/race checks. Staff and Admin have the same application permissions. Use the owner-provided credentials; this guide contains no passwords. The configured hosted username `admin` belongs to an individual account, not a separate superuser tier.
3. Two email inboxes you control for Guest A and Guest B, plus a first-time customer email if available. Hosted OTP must arrive from the configured provider; do not use a fixed test code on hosted development.
4. Ready, active test rooms in both categories, plus one Cleaning, one Maintenance and one Unverified/inactive test room. Confirm the actual environment inventory instead of inventing physical identifiers.
5. A configured cleaning buffer, warning thresholds, current booking policies/cancellation terms, approved payment QR/payee and Hall settings. Record values before changing them; restore after each settings test.
6. PNG/JPEG test proof below 5 MB, a file over 5 MB, a PDF, and an invalid/corrupt image. Keep test proof clearly marked. Do not include real guest/payment data in shared screenshots.
7. A test log using the template below. Capture full reservation/item identifiers privately; shortened display references may not support search.

For every successful change: refresh, reopen the record from its list, compare both guest/staff views where applicable, and inspect the audit/financial history. For every rejected change: check that no partial booking, receipt, refund, capacity release or sibling-item change occurred.

### Record each result

Use **PASS**, **FAIL**, **BLOCKED** or **NOT RUN**. A deliberately disabled feature may PASS its disabled-access test, while its functional journey remains BLOCKED. Missing configuration is not a successful functional test.

```text
Case ID:
Environment / URL / code commit or working-copy date:
Device / browser:
Tester / staff identity label:
Test date and time (Asia/Manila):
Preconditions and configured settings:
Reservation ID / room-item ID / Hall-item ID:
Steps actually performed:
Expected result:
Actual result:
PASS / FAIL / BLOCKED / NOT RUN:
Redacted screenshot or evidence location:
Issue and severity:
Cleanup / restored settings:
```

Stop dependent money/inventory tests if you see double booking, unauthorized access, false payment confirmation, duplicate money entries or a wrong refund. Preserve evidence before attempting another action.

## 2. Reference values and test records

### Initial approved prices

These are the baseline prices. If staff have intentionally changed the test catalog, first record that approved configuration and use its server-generated quote. Never change historical bookings to match new prices.

| Category | 3 hours | 6 hours | 12 hours | 24 hours |
|---|---:|---:|---:|---:|
| Double Standard, 10 physical rooms | ₱200 | ₱400 | ₱600 | ₱1,000 |
| Family Executive, 5 physical rooms | Not offered | ₱600 | ₱900 | ₱1,200 |

Family-only extra bed is ₱100 once per continuing stay. Standard does not offer it. There is no automatic extra-person fee. Comfortable occupancy guidance is not an unlimited-occupancy promise or a verified legal maximum.

Use a future test date **D** with availability. Do not reuse an interval already consumed by another case unless the case requires a conflict. All examples below are Asia/Manila, with 12-hour AM/PM display.

| Record label | Create this record | Purpose |
|---|---|---|
| B1 | Guest A, Standard 3h, D at 2:00 PM–5:00 PM, ₱200 | Complete online journey |
| B2 | Guest A, Family 6h, D at 3:00 PM–9:00 PM, one extra bed, ₱700 | Family pricing and continuing stay |
| B3 | One reservation: Standard 3h at 2:00 PM–5:00 PM; Family 6h at 6:00 PM–12:00 AM, with one extra bed; total ₱900 | Independent schedules and changes |
| B4 | Another Guest A online booking, confirmed now, not checked in | Cancellation inside one hour |
| B5 | Another online booking with confirmation older than one hour | Outside-window cancellation |
| B6 | Hold without proof | Expiration/reconciliation |
| B7 | Hold with proof submitted near minute 29 | Slow-review protection |
| B8 | Staff walk-in, Standard 3h, ₱200, initial cash ₱100 | Partial payments and actual check-in clock |
| B9 | Confirmed booking belonging to Guest B | Ownership denial |
| B10 | Room plus Hall with different schedules | Atomic mixed booking and item isolation |

Create separate copies for destructive cases such as cancellation, checkout, rejection and refunds. B4 cannot also be used to test a still-active stay after cancellation. Do not alter database timestamps manually to simulate elapsed time in hosted development. Use real waiting or a developer-supported isolated clock fixture; changing only your computer clock must not change server eligibility.

## 3. Start with these complete journeys

### J01 — Online booking through checkout

1. In staff profile C open `/staff/sign-in`, sign in, then `/staff/rooms`. Confirm an active Ready Standard room and the configured turnover buffer.
2. In Guest A profile open `/rooms`. Confirm Standard 3h is ₱200 at baseline. Open `/book`.
3. Add one Standard room, date D, 2:00 PM start, 3h package and valid occupants. Choose the availability/price action. Expected checkout: 5:00 PM on D; server total: ₱200.
4. Follow email verification. Request a code, open the newest email and enter the actual six-digit code. Expected: return to booking with the same selection, not a blank planner.
5. Complete required primary contact, read the current policy, acknowledge it and create the hold. Record reservation ID and server deadline. Expected: one reservation and one approximately 30-minute proof window, not confirmation.
6. Open its payment page. Verify the configured hotel QR/payee and ₱200 total. In isolated testing use the synthetic receiving-record procedure; in authorized real-payment acceptance pay the actual verified hotel account.
7. Submit the matching transaction reference and PNG/JPEG proof before the deadline. Expected: awaiting staff verification. No Paid/Confirmed claim solely because upload succeeded.
8. In staff `/staff/payments`, find the same persisted reservation. Open the private proof and compare amount, reference, payee/account and transaction against the independent receiving record. Confirm only after every required check is true.
9. Expected: one confirmation for this reservation, ₱200 verified, zero remaining balance, correct item schedule and an itemized confirmation snapshot. If application email is configured, check delivery; otherwise record email acceptance BLOCKED and inspect pending queue status.
10. In `/staff/reservations`, find the full ID, open details and compare guest, amount, package and schedule with Guest A `/reservations`. No staff re-entry of the booking is needed.
11. At an appropriate actual arrival time, use `/staff/check-ins` to assign a Ready Standard room and record check-in. Expected: only this item enters the checked-in state; an ordinary late arrival retains the original 5:00 PM end.
12. Open `/staff/stays`, refresh, switch tabs and return. Expected: countdown derives from persisted server times; room is occupied. Do not manually change time to force checkout.
13. Record staff checkout with zero balance. Expected: completed item, room Needs cleaning, no automatic Ready state. Guest history reflects recorded completion.
14. In `/staff/rooms`, complete the housekeeping workflow and explicitly mark Ready after inspection. Availability must also respect the configured turnover buffer.
15. Inspect audit and financial history. Expected: staff actor/time on sensitive actions, one verified receipt and no duplicate booking/payment/checkout.

### J02 — Walk-in with cash and GCash installments

1. Open `/staff/walkins`. Select Standard 3h, valid contact/occupants and current policy acknowledgement. Expected baseline total: ₱200.
2. Create the walk-in and record ₱100 cash at an example actual time of 2:05 PM. Expected: one cash receipt, ₱100 remaining; no occupied room or running stay merely from payment.
3. Attempt normal check-in on a separate copy with only ₱99 recorded. Expected: refused because it is below 50%.
4. On the ₱100-funded booking, assign a Ready room and actually record check-in at an example 2:10 PM. Expected: checkout 5:10 PM, not 5:05 PM. Record your actual timestamps if you cannot use these times.
5. Record the remaining ₱100 as staff-verified GCash against the independent receiving record. Expected: two separate receipts, total collected ₱200, zero balance.
6. Refresh `/staff/stays`; complete staff checkout, then cleaning and explicit Ready. Expected: correct actor audit, no duplicate money and capacity available only when safe.
7. Repeat using cash-only, GCash-only and mixed installments in separate records.

### J03 — Multiple rooms and one-item cancellation

1. Create B3 through one guest hold and one full ₱900 proof/reference at baseline. Expected: independent schedules and one parent reservation.
2. Staff verifies the full actual payment. Expected: all selected items confirm together; per-item amounts sum to ₱900.
3. Before either room checks in and within 40 minutes of confirmation, Guest A requests cancellation of only the Standard item.
4. Staff processes eligible cancellation. Expected: only Standard capacity releases; Family remains confirmed for 6:00 PM–12:00 AM, with ₱700 attributable price and its extra bed.
5. Verify the refundable amount attributable to Standard is ₱200. Do not refund the entire ₱900.
6. In isolated testing record a synthetic manual-refund transaction; for real acceptance first perform the separately authorized manual GCash transfer and verify its actual destination/reference. Then record it once.
7. Refresh both views. Expected: original ₱900 payment history remains, ₱200 completed refund recorded against Standard, no duplicate refund and Family's schedule/status/payment allocation unchanged.

## 4. Guest browsing, pricing and planner

Each row is a separate case. Run in a fresh usable state and record the result with its ID.

| ID | Steps to perform | Expected result |
|---|---|---|
| G01 | Signed out, open `/`, `/rooms` and public reviews if enabled; use Rooms & Rates, How to book, Contact and Book now. | Public information loads without email verification; links reach their actual destination. No invented contact details/rates. |
| G02 | Quote each of the seven permitted category/package combinations. | Baseline prices match section 2, with correct date/end time and PHP formatting. |
| G03 | Choose Family and inspect every duration option; try a saved/modified request for 3h with developer assistance. | No Family 3h UI option; backend also rejects it with no hold. |
| G04 | Quote Family 6h without and with extra bed; quote Standard. | Family changes ₱600→₱700 once; Standard offers no extra bed. |
| G05 | Change valid occupant counts within the disclosed advisory policy; include a child where supported. | Counts persist per room; no invented per-person surcharge or claim of unlimited capacity. Pending safety rules remain disclosed/gated. |
| G06 | Quote Family 48h using two 24h blocks and one continuing extra bed, if that selection is exposed. | ₱2,400 + ₱100 = ₱2,500 at baseline; no daily bed charge. Missing multi-block UI is a coverage gap, not PASS. |
| G07 | Add two rooms of different categories with different start/end dates. Remove one, then add it again. | Items keep independent values and total recalculates accurately without hidden duplicates. |
| G08 | Try missing date/start/package, zero/negative/fractional room quantity and invalid occupant values wherever editable. | Clear validation; no zero-duration/invalid hold or silent coercion to an unrelated booking. |
| G09 | Select an elapsed start, end before start, unavailable interval and excessive room quantity. | Server rejects according to approved scheduling/availability rules; no partial claim. |
| G10 | Select 11:00 PM +3h; separately test 12:00 AM and 12:00 PM starts. | Correct next-day 2:00 AM end; midnight/noon are not interchanged. |
| G11 | Change browser/device timezone and reopen the same booking. | Business schedule remains Asia/Manila with explicit AM/PM; stored booking does not shift. |
| G12 | Quote, then change category/date/duration/bed before submitting. | A current authoritative quote/accepted price is required; stale quote cannot buy changed service at old amount. |
| G13 | Quote, have another session consume the remaining capacity, then create hold. | Final hold rejects or requests a new choice; old availability display does not override the server. |
| G14 | Collapse/expand policies, open full text, and try submitting without acknowledgement/contact. | Hiding text does not check acknowledgement; required fields/current policy version remain enforced. |
| G15 | Enter long names, apostrophes, accented/non-Latin names, long email and optional missing fields. | Valid input remains usable and readable; invalid input has useful errors; no broken layout. |
| G16 | Navigate to verification, use Back, refresh and resume. | Intended selections survive the supported browser session without creating a duplicate hold. |

## 5. Guest OTP, sessions and reservation access

| ID | Steps to perform | Expected result |
|---|---|---|
| A01 | Open `/verify`, submit empty or malformed email. | Inline validation; no misleading code-sent success. |
| A02 | Request a code for a first-time inbox; repeat separately for a returning inbox. | Actual new six-digit email received for both supported paths. A sign-in-link-only email fails the required code-entry flow. |
| A03 | Type all digits; separately paste a complete code, use Backspace/arrows and phone autofill if available. | Digits land in correct boxes; keyboard focus behaves predictably; only valid-length input submits. |
| A04 | Enter incomplete, wrong and expired codes. | Access denied; actionable error; no reservation/session ownership granted. |
| A05 | Verify the newest valid code and resume a saved booking. | Auth verification plus Express guest check succeeds; intended booking returns. |
| A06 | Send twice rapidly; press Resend before/after the displayed cooldown; refresh during cooldown. | Duplicate requests guarded; 60-second client cooldown survives reload. Provider may enforce longer throttling; no false success. |
| A07 | Resend with old digits entered, then try the old/replayed code after successful use. | Successful resend clears old input; consumed/invalid codes cannot create another unauthorized session. Record actual provider expiry behavior. |
| A08 | Change email during the code flow, then attempt the prior email's code. | New identity must verify; no access as the old identity. Send-in-progress prevents accidental email switching. |
| A09 | Sign out, refresh `/reservations`, then use browser Back. | Protected data requires verification again; cached UI does not permit a new protected action. |
| A10 | As Guest B open Guest A's detail/payment URL and modify the reservation ID. | Denied; no guest contact, proof, ledger or booking changes exposed. |
| A11 | Open Guest A's URL completely signed out, including in a fresh profile. | Authentication required; possession of a URL alone is insufficient. |
| A12 | Expire/revoke a test session with developer help, then attempt a mutation. | Server denies expired/revoked access; UI allows safe reauthentication without success or duplicate action. |
| A13 | Make Auth/Express unavailable during verification using DevTools request blocking. | Service failure differs from an invalid-code message; no success toast or verified access. |
| A14 | Test a manipulated return destination pointing to an external site. | No open redirect or transfer of session credentials to that site. Developer-assisted if not exposed in UI. |

## 6. Holds, proof and actual staff verification

Use separate reservations for expiration, rejection and approval. For time boundaries record server timestamps; a visible minute counter alone is not precise enough.

| ID | Steps to perform | Expected result |
|---|---|---|
| P01 | Create a hold, record deadline, refresh after several minutes. | Same hold/deadline; countdown does not restart. Reservation is unconfirmed. |
| P02 | Leave B6 without proof through 30 minutes; keep scheduler running and refresh availability. | Server expiration releases initial capacity. Allow the configured worker interval; no confirmed booking. |
| P03 | Keep payment page open until the five-minute elapsed reminder point. | Reminder appears as specified; reminder does not extend the deadline. |
| P04 | Submit B7 proof around minute 29; leave staff review until minute 90. | All selected capacity remains protected. Initial deadline does not release pending-review proof. |
| P05 | With developer-assisted controlled timing, submit just before, at and just after the server proof deadline. | Consistent documented server cutoff; late proof enters safe reconciliation, not confirmation or stealing reallocated capacity. |
| P06 | Open payment with no configured valid QR/payee. | Payment is unavailable with useful guidance; no fabricated account or silent fallback. |
| P07 | Submit missing reference, missing image, PDF, corrupt image, 0-byte file and image over 5 MB. Repeat valid PNG/JPEG. | Invalid evidence rejected; PNG/JPEG within limit accepted. Server validates content too, not extension alone. |
| P08 | Submit a valid reference/image without an independent receiving transaction. | Pending review only; staff must not verify a screenshot as actual receipt. |
| P09 | Reuse a reference already verified on another reservation; retry with whitespace/case variations. | Global duplicate-reference safeguard prevents double credit according to canonical reference rules. |
| P10 | Test underpayment, wrong recipient, amount mismatch and fabricated proof in separate records. | No full confirmation; staff records rejection/reconciliation as appropriate. No unsupported Paid state. |
| P11 | Staff verifies a correct full receiving transaction for B1. | Atomic safe confirmation, correct verified amount and immutable itemized snapshot. |
| P12 | Double-click proof submit; repeat after a delayed response or refresh. | One logical submission, no duplicate monetary credit or changed deadline. |
| P13 | Staff double-clicks verification; two staff approve the same record together. | One confirmation/payment result; second action is safe replay/conflict, never a second receipt. |
| P14 | Try approving without required receiving-account checks or cancellation terms. | Server refuses incomplete verification; no partial confirmation. |
| P15 | Reject/reconcile submitted proof and reopen both guest and staff views. | Latest authoritative state shown; no confirmed success message. Payment UI may use unavailable/reconciliation wording rather than a distinct rejected screen. |
| P16 | Pay but miss proof deadline; allow capacity to be consumed; ask staff to reconcile. | Staff verifies real money and seeks guest-approved replacement or manual refund; no automatic oversell or QR refund. |
| P17 | While proof is pending, wait 15, 30 and 60 minutes after submission and refresh staff queue. | Overdue/urgent/critical handling escalates as configured; never auto-releases protected items. |
| P18 | As Guest B/signed-out visitor try Guest A's proof URL; copy staff proof URL into a fresh profile and test after link expiry. | Private evidence remains access-controlled; signed access expires; no permanent public bucket URL. |
| P19 | After verification, reopen payment/history after initial deadline and after cancellation of one item. | Historical verified payment remains readable; no new hold/proof requirement or lost original receipt. |

## 7. Staff identity, navigation and dashboard

| ID | Steps to perform | Expected result |
|---|---|---|
| S01 | Open `/staff` signed out; then sign in with valid username and, separately, the supported account email. | Protected route redirects to sign-in; Express verifies active staff membership before dashboard access. |
| S02 | Submit empty fields, wrong password, unknown identity; toggle password visibility. | Clear errors, no staff access; visibility toggles accessibly; credentials never enter URL/toast. |
| S03 | Sign in as an ordinary guest and directly open every `/staff/...` route. | Staff data and mutations denied by backend, not merely hidden navigation. |
| S04 | Use a valid but inactive staff account; separately deactivate an existing test staff session with developer help. | New protected requests fail; a valid Auth session alone is insufficient. Restore test membership afterward. |
| S05 | Have Staff A and B perform different recorded changes. | Equal functional permissions; audit identifies the actual individual actor for each. |
| S06 | Request password recovery; follow actual recovery link, set permitted new password, test expired/reused link. | Authorized recovery works, invalid link fails; minimum 12-character setup rule enforced. Hosted delivery requires configured mail. |
| S07 | Follow an invitation for a test staff identity, set password, test before/after staff activation. | Password setup does not grant membership/activation by itself; no public staff signup. |
| S08 | Refresh a protected page; sign out through sidebar/mobile and separately Settings → Your session. | Valid session restores; successful sign-out returns to protection. Failed sign-out shows an error rather than false success. |
| S09 | Visit every route in section 8 using navigation and direct URL; use Back/Forward. | Correct page and selected link; Today is not selected on unrelated routes; no blank/duplicate content. |
| S10 | Rapidly switch sidebar groups/pages; use keyboard arrows/Tab/Enter; test reduced motion. | Current destination remains correct, focus usable, navigation not stuck by animation. |
| S11 | Open `/staff` on a slow connection, then block one dashboard endpoint and refresh. | Loading/unavailable distinguished from factual zero; no invented availability/revenue/room count. |
| S12 | Create a known arrival, payment review, occupied/overdue stay and cleaning/maintenance item; refresh Today. | Queues/counts correspond to source records and refresh time; shortcuts reach the matching workflows. Static 15-room inventory is not asserted current availability. |

## 8. Test every staff screen

Use this route inventory so no screen is skipped. Housekeeping and maintenance are within Rooms; do not assume separate pages exist. A missing/disabled module should be logged as such.

| Route | Check while there |
|---|---|
| `/staff` | Today counts, unavailable/loading behavior, shortcuts and refresh |
| `/staff/reservations` | List, filters/search, pagination, detail links, full-ID lookup |
| `/staff/reservations/:id` | Correct items, guest/contact where provided, prices, money history, conditional actions, print |
| `/staff/walkins` | Independent selections, policy/contact, deposit receipts and creation |
| `/staff/check-ins` | Arrivals versus recorded check-ins, room assignment, check-in/no-show |
| `/staff/stays` | Active/completed, countdown, synchronization/retry, checkout |
| `/staff/payments` | Pending proofs, private image, verification/reconciliation, email queue counts |
| `/staff/cancellations` | Item-specific eligibility, cancellation and manual refund recording |
| `/staff/reschedules` | Requests, proposed schedule, approve/reject and audit |
| `/staff/stay-changes` | Extensions, upfront requirement, overtime/incident charges and waivers |
| `/staff/rooms` | Registration, administration/inspection, active state, cleaning, maintenance/reassignment |
| `/staff/settings/catalog` | Categories/packages/rates/activation; old `/staff/catalog` redirects here |
| `/staff/settings` | Buffer/warnings/policy, private GCash QR/payee, session sign-out |
| `/staff/hall` | Only when enabled: Hall schedule/settings/readiness, payments, event actions/refunds |
| `/staff/analytics` | Revenue, category performance, package popularity and date-range filters |
| `/staff/audit` | Actor/action/date/subject filters, pagination, sensitive masking |
| `/staff/reviews` | Only when enabled: public replies, reasoned hide/restore |
| `/staff/feedback` | Only when enabled: private feedback, no public exposure |

Current review routes are gated separately and may not appear in hosted development. The current check-in/stay data projections do not supply guest names/payment breakdowns for every requested layout. Their absence is a known limitation; inspect authoritative reservation details and record the gap instead of inventing data. Guest/Hall grouping is within each fetched page; test pagination, not only the first page.

## 9. Reservation management and physical room administration

| ID | Steps to perform | Expected result |
|---|---|---|
| R01 | Search by full reservation ID and each offered filter; clear filters; test empty result and next/previous pages. | Correct results; no cross-guest records in guest history; active filters persist as supported. Short references are not assumed searchable. |
| R02 | Compare room items, original/effective/actual times and money in guest/staff detail after extension/check-in. | Dates have explicit meaning; no silent overwriting of original booking history. |
| R03 | Print a mixed or multi-room reservation with payment/refund history. | Readable pages and correct totals; no private proof/token; document is an internal statement, not an asserted compliant fiscal receipt. |
| R04 | In test-only capacity, register a new room with identifier/category/note. | Starts inactive and Unverified; registration alone creates no availability/inspection. Never exceed 10/5 limits or register fake rooms on hosted data. |
| R05 | Retry same registration; try identifier with different case/outer spaces; try exceeding category total. | Duplicate/capacity safeguards; no duplicate physical inventory. |
| R06 | Attempt activation before inspection; then physically inspect a safe empty test room, enter note, mark Ready and activate. | Unverified activation refused; valid inspection/activation recorded with actor/time. |
| R07 | Edit identifier/active state with reason; try category correction on a room with history/protected booking. | Valid admin changes audited; unsafe category changes/deactivation refused. No deletion shortcut. |
| R08 | Filter room board and inspect Ready, held, reserved, occupied, cleaning and maintenance records. | Booking/hold/physical readiness remain distinct; room numbers sort naturally; counts match actual configured inventory. |
| R09 | Assign a Standard item to Family, an inactive room, Maintenance room and conflicting assigned room. | Invalid assignment refused; no hidden upgrade or overlapping assignment. |
| R10 | Two staff attempt assigning the same physical room to overlapping items simultaneously. | At most one succeeds; other receives conflict; both bookings remain internally consistent. |

## 10. Walk-ins, check-in, no-show and stay monitoring

| ID | Steps to perform | Expected result |
|---|---|---|
| W01 | Perform J02, then repeat with multiple independently scheduled room items. | Shared inventory and per-item payment/check-in behavior; no sibling start/status change. |
| W02 | Test deposits just below, exactly at and above 50%: ₱99/₱100/₱101 for ₱200. | Normal access blocked below ₱100; eligible at/above with valid verified receipt and Ready room. |
| W03 | Record cash, GCash and mixed installments; try zero/negative/excess invalid amount and duplicate reference. | Ledger rejects invalid/unattributable money; cash receiver/GCash verifier audited. |
| W04 | Create booking/collect deposit, wait, then check in. | Countdown begins at actual recorded walk-in check-in, not quote/arrival/payment time. |
| W05 | Online booking at 2:00 PM–5:00 PM; actually check in 2:45 PM. | Original 5:00 PM checkout preserved without free automatic extension. |
| W06 | Request early online check-in with explicit reason, Ready room and no conflict; repeat with a conflict. | Approval preserves purchased duration by moving end earlier; unsafe early arrival refused. |
| W07 | Leave confirmed guest absent beyond one-hour arrival grace. | Flag/manual review only; no automatic cancellation, refund or release. |
| W08 | Record no-show with reason, inspect audit, then exercise supported correction/expected-arrival action. | Persisted latest staff decision and safe replay; no sibling/payment rewrite. |
| W09 | Refresh, close/reopen tab, sleep/resume device and switch browser timezone during a stay. | Persisted stay times remain authoritative; server synchronization recovers or explicitly blocks unsafe action. |
| W10 | Temporarily block stay API, attempt checkout, restore connection and choose Retry synchronization. | Genuine sync failure disables unsafe checkout; valid refresh does not falsely declare lost synchronization every poll. |
| W11 | Observe configured warning thresholds and let an isolated/test stay pass zero. | Warning/overdue shown; room remains occupied until explicit staff checkout. |
| W12 | With a remaining balance, attempt ordinary checkout. Then settle it and retry. | Ordinary checkout refuses unpaid balance; after valid settlement it succeeds once. |
| W13 | On another unpaid stay use documented unpaid-departure exception with/without reason. | No silent debt wipe; reason required, debt retained, departure/audit recorded so room is not occupied indefinitely. |
| W14 | Double-click checkout; two staff checkout simultaneously; refresh completed record. | One logical checkout/financial result; room Needs cleaning; completed list does not claim its present readiness forever. |
| W15 | Complete one of two independent room stays while the other is active. | Only chosen item checks out; sibling countdown, room and balance allocations unchanged. |
| W16 | Enter required minor-ID review metadata where applicable; inspect submitted/stored fields with developer help. | Staff/status/time only as designed; no default ID-photo/number persistence or automatic legal eligibility claim. |

## 11. Cancellation, manual refunds, rescheduling and extensions

Use independently created records for each boundary. Free online cancellation ends at one hour after original staff confirmation or the item's actual room check-in/Hall start, whichever is earlier. At the exact one-hour cutoff, use server-time evidence; the free window has ended.

| ID | Steps to perform | Expected result |
|---|---|---|
| C01 | Cancel an online item 40 minutes after confirmation, before actual check-in/start. | Eligible item full-refund path; original payment retained and refund obligation correctly attributed. |
| C02 | Repeat immediately before, at and after the one-hour cutoff using isolated timing support or real waiting. | Cutoff applied consistently by server; no free-refund eligibility at/after expiry. |
| C03 | Check in/start within the hour, then request cancellation. | Actual start ends free eligibility for that item; no automatic full refund. |
| C04 | Perform J03 and inspect availability and every sibling. | Only cancelled item released/refunded; independent schedules/status/money unchanged. |
| C05 | Cancel an unpaid hold and a walk-in in separate cases. | Channel/state-specific policy applied; online full-refund entitlement not invented for walk-ins or unpaid money. |
| C06 | Record eligible manual refund with destination/reference/amount; retry the same command. | One refund entry; app says recorded, not automatically sent; staff actor/time retained. |
| C07 | Attempt refund over attributable verified payment, twice cumulatively, or against another item's allocation. | Rejected; no negative balance or use of sibling money. |
| C08 | Submit refund with missing destination/reference/reason, then simulate ambiguous timeout. | Required evidence enforced; staff checks existing history before retry; no duplicate transfer claim. |
| C09 | Request one-item reschedule as owner; staff approves an available slot. | Guest request alone does not move inventory; approval atomically moves only chosen item and records old/new schedule. |
| C10 | Request conflicting/maintenance-blocked slot; staff rejects. | Original schedule/capacity/prices remain valid; no partially moved claim. |
| C11 | Reschedule, then request cancellation after original one-hour deadline. | Rescheduling does not restart the clock. |
| C12 | Reschedule to a differently priced approved package/schedule. | Explicit attributable charge/refund adjustment; original historical price/payment not overwritten. |
| C13 | Two staff approve the same pending reschedule, or competing requests target last capacity. | One consistent approved result; no double claim. |
| C14 | For a Standard 3h ₱200 extension, try ₱99 then ₱100 upfront. | Below 50% refused; at least ₱100 plus availability/staff approval permits activation. |
| C15 | Original checkout 5:00 PM; request +3h at 5:15 PM. | If available/approved, new end 8:00 PM, not 8:15 PM. |
| C16 | Try extension overlapping another booking/maintenance/turnover. | Refused without losing the current stay or taking another booking's capacity. |
| C17 | Extend a Family stay already charged its ₱100 extra bed. | Same continuing bed not charged a second time; only legitimate extra duration/adjustments added. |
| C18 | Double-submit extension/receipt; refresh both guest/staff details and countdown. | One extension, correct money, effective end and audit; sibling items unchanged. |
| C19 | Record chargeable overtime, then a separate free-overtime waiver; omit waiver reason first. | Explicit reviewed charge or reasoned waiver with staff, time and minutes; no automatic charge from countdown alone. |
| C20 | Record smoking incident; apply or waive fee with/without reason. | Disclosed/configured penalty requires staff review; waiver reason audited; no arbitrary automatic fine. |

## 12. Cleaning, maintenance, settings and catalog

| ID | Steps to perform | Expected result |
|---|---|---|
| O01 | Checkout, leave room dirty beyond cleaning buffer, attempt next check-in. | Not Ready merely because time passed; check-in refused. |
| O02 | Finish cleaning/mark Ready before buffer ends and try an immediate conflicting next stay. | Readiness alone does not bypass required buffer; both conditions enforced. |
| O03 | Record cleaning start/finish and explicit inspection/Ready, reopen history. | Actual events and staff actors preserved; no fabricated cleaning on registration/legacy recovery. |
| O04 | Open maintenance with reason and progress notes on a usable test room. | Room blocked from feasible new allocation; history/actor retained. |
| O05 | Open maintenance affecting an assigned future paid booking. | Visible affected-booking/reassignment work; no silent cancellation or lost paid capacity. |
| O06 | Reassign affected item to a valid alternate room; attempt conflicting/wrong-category room first. | Only safe reassignment succeeds; booking/money/siblings unchanged. |
| O07 | Clear maintenance without inspection/Ready, then properly restore through the supported workflow. | Repair completion alone does not fabricate Ready; valid clearance recorded. |
| O08 | Change a package price; quote a new booking and reopen an older one. | New server quote uses new rate; old snapshot/refunds unchanged. Restore rate afterward. |
| O09 | Disable package/category, open public catalog and try stale selection. | New selection/booking blocked appropriately; existing history remains readable. |
| O10 | Attempt to add Family 3h or modify category capacity inconsistently. | Approved package/inventory rules enforced by server; no corrupt catalog. |
| O11 | Save valid buffer/warnings/cancellation text; refresh. Try negative, fractional/out-of-range/invalid entries. | Supported valid settings persist/audit; invalid ones refused without partial save. Restore prior settings. |
| O12 | Upload QR/payee with valid PNG/JPEG, then invalid/oversize image or empty payee. | Private validated QR config; correct payee in payment flow; invalid update leaves prior valid config intact. |
| O13 | Change QR/payee after creating a test hold, then review its receiving-account evidence. | Payment snapshot/current account handling is explicit and safe; mismatched account cannot be blindly verified. Record which snapshot was used. |
| O14 | Remove required cancellation terms or required readiness config in isolated testing. | Dependent unsafe confirmation/availability blocked with useful message; no guessed policy. Restore settings. |

## 13. Function Hall and mixed online reservations

Run when Hall capability/readiness/settings permit. A disabled Hall must be unavailable in navigation/direct actions; mark its booking tests BLOCKED. One exclusive Hall serves both layouts. Review provisional opening hours, latest end, minimum notice, buffers and fractional-hour policy before boundary tests; this guide does not approve them.

| ID | Steps to perform | Expected result |
|---|---|---|
| H01 | Book Hall-only online from `/book` or the Function Hall entry point. | No mandatory prior staff inquiry; same verified guest/quote/hold/proof workflow; online full payment required. |
| H02 | Select Theater with 70 then 71 attendees; Room Type with 50 then 51. | Allowed maxima 70/50; over-limit rejected. Setups consume one shared Hall. |
| H03 | Quote allowed 4:00 PM–7:00 PM, 5:00 PM–8:00 PM and 4:00 PM–8:00 PM on available dates. | ₱3,000, ₱5,000 and ₱4,000 respectively at approved baseline; daytime crossing 5:00 PM does not switch base. |
| H04 | Try before 8:00 AM, outside configured hours/notice, fractional excess hour and invalid duration. | Reject or apply explicitly reviewed configuration; no guessed supported schedule/rounding rule. |
| H05 | Reserve Theater, then attempt overlapping Room Type in another profile. | Conflict; different setup is not different inventory. |
| H06 | Create B10 with independently scheduled room/Hall and one shared proof deadline. | One total/reference/private screenshot; allocations sum exactly; full online amount required. |
| H07 | Make one selected room/Hall unavailable just before mixed hold creation. | Entire command rolls back; no orphan room/Hall hold or partial parent reservation. |
| H08 | Let mixed hold expire without proof; separately submit timely proof and wait past deadline. | All initial claims expire together without proof; all timely-proof items stay protected pending review. |
| H09 | Staff verifies full mixed receiving transaction; test failure/retry with developer assistance. | All items confirm atomically or none; one itemized confirmation/outbox message. |
| H10 | Verify an online Hall-only/mixed transaction with only 50% received. | No online confirmation; 50% staff-managed Hall deposit rule does not apply to online bookings. |
| H11 | Create staff-managed Hall reservation; test just below/exactly 50% deposit. | Staff-managed minimum 50% enforced with verified payment and safe resource claim. |
| H12 | Record Hall actual event start/end, inspect upcoming/ongoing/past and refresh. | Staff actions govern state; scheduled end alone does not fabricate actual completion/readiness. |
| H13 | Cancel eligible Hall item within its original window, or after actual start. | Pre-start/in-window policy enforced; refund capped to Hall allocation; room siblings unaffected. |
| H14 | Reschedule Hall to a valid then conflicting interval; inspect original cancellation time. | Staff-approved safe move only; original clock and sibling schedules preserved. |
| H15 | Extend Hall with less than 100%, then full additional cost; compare room extension. | Hall extension requires full extra charge; accommodation retains minimum 50%. |
| H16 | Try back-to-back events inside preparation/cleanup buffer and while Hall not Ready. | Hours, buffers and physical readiness independently enforced. |
| H17 | Exercise supported alternate-schedule recovery for funded inquiry and retry an ambiguous command. | Verified money preserved; replacement conflict-safe; one durable result, no duplicate cash receipt. |
| H18 | Record a Hall-only refund/extension, inspect mixed totals and analytics separation. | Hall money separately attributable; no bedroom inventory/revenue misclassification. |

## 14. Analytics, audit, reviews and notifications

Analytics and reviews require capability/configuration and an agreed calculation basis. If unavailable, record BLOCKED rather than treating a navigation link as implementation acceptance.

| ID | Steps to perform | Expected result |
|---|---|---|
| ADO01 | Open Analytics, choose supported date range and daily/weekly/monthly grouping. | Only approved Revenue, Room Category Performance and Package Popularity scope; consistent range/labels. |
| ADO02 | Build a worksheet of verified receipts, partial payments, completed refunds, waivers and extensions for known records; compare displayed definitions and totals. | Each factual event counted once; unverified proof excluded; collections not falsely labeled earned revenue. Block accounting acceptance if definition is unresolved. |
| ADO03 | Compare B3/B10 allocations to category/package and separate Hall contributions. | Parent payment not multiplied by item count; contributions reconcile to the same basis; Family 3h absent. |
| ADO04 | Change catalog rate after historical booking and rerun report. | Historical contribution unchanged; category data dynamic rather than hard-coded omissions. |
| ADO05 | Put isolated financial events just before/after Manila midnight and filter dates. | Correct local-day inclusion using UTC conversion; browser timezone does not move revenue dates. |
| ADO06 | Apply date filters in Room Analytics. | On-screen totals match the selected period and contain no private proofs, tokens, or unnecessary contact details. |
| ADO07 | Open Room Analytics and check the available actions. | Reports are available on screen; CSV and Excel download controls are absent. |
| ADO08 | As guest/signed out call report/export/audit routes. | Server denies access; protected download URL alone grants no permanent permission. |
| ADO09 | Filter `/staff/audit` by actor, action, date and subject after known changes. | Correct individual actors/time/subject; pagination works; no password, bearer token, OTP or public proof URL. |
| ADO10 | Try public rating without stay, with paid-only/cancelled/no-show reservation and as another guest. | Review denied; public browsing alone never grants eligibility. |
| ADO11 | Complete real staff-recorded check-in and checkout, then submit rating 1 and optional comment. | Eligible verified primary guest may submit once per reservation; genuine negative review treated equally. |
| ADO12 | On multi-room reservation, concurrently submit two ratings; test invalid 0/6 stars and reused/expired invitation. | One public review maximum; invalid rating/token/replay denied by backend. |
| ADO13 | Submit private feedback; inspect public site/API in another profile. | Feedback remains staff-only and does not enter public average. |
| ADO14 | Staff replies; attempts to edit guest stars/text; hide/restore with missing then valid policy reason. | Reply allowed; guest content immutable; moderation needs reason/actor/time; negative sentiment alone not removal grounds. |
| ADO15 | Verify one confirmation; inspect `/staff/payments` notification counts and actual inbox. | One queued itemized confirmation; configured provider/inbox evidence recorded separately. No false sent/delivered claim. |
| ADO16 | Without proof, wait through 15-/25-minute reminders; then repeat after proof submission. | Due reminders queued/sent only where configured; stale reminders suppressed after proof/confirmation/expiry as applicable. |
| ADO17 | Delay staff review through 15/30/60 minutes with configured staff recipients. | Correct escalation stage and recipients; no capacity release; lower obsolete alerts suppressed. |
| ADO18 | Disable mail provider in isolated test or simulate provider timeout; retry worker and refresh counts. | Booking state safe; queued/failed status truthful; bounded retry/idempotency, no duplicate confirmation/payment. |

## 15. Shared inventory, concurrency, failure and security checks

The first checks can be performed with two browser profiles. High-contention, rollback, RLS and backup drills require developer/database help in an isolated environment. They are required evidence for release; do not mark them PASS from visual inspection. Do not point stress tests at a real operational hotel database.

| ID | Steps to perform | Expected result |
|---|---|---|
| X01 | Prepare only one remaining overlapping Standard capacity unit; Guest A and B create holds together. | At most one claim succeeds; capacity never negative. |
| X02 | Repeat last-unit conflict using online hold versus staff walk-in; then online versus maintenance. | Same concurrency-safe engine; no channel-specific extra allotment or lost protected booking. |
| X03 | With developer help send 30 simultaneous last-unit requests against real local PostgreSQL. | At most one winner; database constraints/locking verified, not only UI serialization. |
| X04 | Test exact end/next-start boundary with nonzero buffer, then end+buffer boundary. | No overlap through turnover; exact legal boundary follows interval rules; readiness still required. |
| X05 | Submit same idempotency key twice; then reuse it with changed content in developer-assisted API test. | Same logical result or explicit conflict; no second reservation/receipt/refund/change. |
| X06 | Disconnect/block network after submission but before response, then reconnect and reopen record. | Existing command result can be reconciled; retry cannot duplicate money or inventory. |
| X07 | Force failure partway through mixed claim/confirmation/refund transaction in isolated DB test. | All-or-nothing rollback; no partial ledger, orphan claim or confirmed sibling subset. |
| X08 | Change displayed price/role/guest ID in DevTools or request payload with developer assistance. | Express ignores untrusted pricing/rights; authoritative price and actor enforced. |
| X09 | Directly request staff mutations, foreign-guest data and private storage with guest/anonymous credentials. | Auth/ownership/RLS/storage safeguards hold; backend secrets never required in browser. |
| X10 | In isolated text fields enter `<script>alert(1)</script>` and SQL-like strings; view list/detail/export. | Rendered as safe text or validly rejected; no script execution/query manipulation. |
| X11 | Exercise repeated OTP, login and proof requests within configured test limits. | Server/provider throttling works; refresh does not bypass it; no account enumeration or false success. |
| X12 | Simulate hotel's internet outage, record a manual walk-in, let cloud booking consume conflicting capacity, then reconcile. | Collision explicitly flagged/resolved by staff; no silent overwrite or promise of safe offline confirmation. |
| X13 | Restart services with an active persisted hosted-development stay; separately restart disposable harness. | Hosted persisted timestamps/state survive; disposable data loss is expected harness behavior and not hosted durability evidence. |
| X14 | Developer restores a dedicated backup into staging and reconciles reservation, ledger, auth/storage recovery scope. | Recovery and balances demonstrated; application-table backup alone not claimed complete Auth/Storage disaster recovery. |
| X15 | Review browser bundles, Network responses and redacted logs with developer help. | No server secret/database URL/password/OTP/token leakage; private proof/payment records not publicly cached. |

## 16. Desktop, phone, accessibility and feedback

Run these against guest booking/payment and every staff route from section 8. Use an actual phone as well as desktop emulation.

| ID | Steps to perform | Expected result |
|---|---|---|
| U01 | Test desktop, tablet, small phone portrait/landscape, then 200% text/zoom. | No inaccessible primary action or clipped essential information; tables scroll locally where appropriate. |
| U02 | On phone open guest menu, staff five-tab navigation, Today action fan and nested choices. | Can reach every enabled destination, close menu, sign out; bottom navigation does not cover forms or safe-area content. |
| U03 | Navigate forms/dialogs with keyboard only; use Escape and inspect return focus. | Visible logical focus, labelled inputs/errors, usable controls and no focus trap. |
| U04 | Enable reduced motion, rapidly navigate and submit forms. | Useful feedback retained without required motion; no stuck panel or lost form state. |
| U05 | Inspect busy controls with slow network; double-click; trigger failure then success. | Duplicate actions guarded; actual success gets one truthful toast; failed request gets no success toast. |
| U06 | Inspect amount/status/date labels and color on guest/staff screens. | Royal Horizon palette, navy on orange CTA, legible focus/disabled states; statuses not color-only; all visible times AM/PM. |
| U07 | Open print preview for long/multi-item reservation and export on phone/desktop. | Useful printable content, no clipped totals or private proof; downloadable files open correctly. |
| U08 | Use very long names/labels, emoji/non-Latin text, no results and many rows. | Layout remains usable; empty state differs from loading/error; pagination can reach every record. |
| U09 | Open unknown URL and disabled module direct URL. | Explicit not-found/unavailable outcome; no silent route to another guest's/staff-only data. |

## 17. How to finish the test run

1. Start with J01, J02 and J03. If one fails, log it and fix/retest its dependent cases before broad acceptance.
2. Run all relevant rows, including disabled-state checks. For unavailable features/provider accounts write BLOCKED and the exact dependency. Never write PASS merely because a button exists.
3. Reconcile each test reservation: original total + adjustments, attributable verified receipts, completed refunds, outstanding balance, item states, claims and physical readiness. A pending refund is not a completed transfer.
4. Retest corrected failures and the affected sibling/channel/money cases. Keep the original failure evidence alongside the retest result.
5. Restore changed catalog/settings/test account status. Resolve test holds through supported workflows; do not bulk-delete hosted records or erase audit/ledger history.
6. Record summary counts of PASS/FAIL/BLOCKED/NOT RUN by suite and device. List every remaining critical issue and untested integration.
7. Developer separately runs `npm run build`, `npm run typecheck`, `npm run lint` and `npm test`, recording actual output. Manual clicks do not replace database race/authorization tests. The repository's full scanner/independent-review quality gate is additionally required before major milestone/predeployment completion.

Suggested issue severity: **Critical** for unauthorized access, double booking, false verification, duplicate/wrong payment/refund or secret exposure; **High** for a blocked core booking/check-in/checkout flow or wrong persisted schedule/balance; **Medium** for a functional filter/export/notification error with a workaround; **Low** for presentation issues that do not obstruct use. Reassess severity based on actual impact.

This guide adds test procedures only. No application/dependency/migration change, acceptance checkbox completion, test execution, deployment, commit or push is implied. Next action: prepare the chosen test environment and run J01 with separate guest and staff browser profiles.

## Related specifications

- [Business requirements](02-requirements.md) and [existing acceptance matrix T01–T38](15-testing-plan.md)
- [Hosted development setup](hosted-booking-setup.md) and [isolated harness notes](isolated-development.md)
- [Unified online booking implementation and limits](unified-online-booking-requirements-sync.md)
- [Room/Hall change policies](phases/07-changes-refunds-and-ledger.md)
- [Function Hall rules](future-function-hall-requirements.md) and [Analytics scope](future-analytics-and-reports.md)
- [Current context and known verification gaps](icm/PROJECT-CONTEXT.md)
