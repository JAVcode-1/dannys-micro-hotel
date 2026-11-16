---
tags: [seed, data]
status: initial-approved-prices
---
# 19 — Seed Data & Configuration Fixtures

## Confirmed category/package rows

```csv
category_code,category_name,room_count,duration_minutes,price_centavos,active
DOUBLE_STANDARD,Double Standard,10,180,20000,true
DOUBLE_STANDARD,Double Standard,10,360,40000,true
DOUBLE_STANDARD,Double Standard,10,720,60000,true
DOUBLE_STANDARD,Double Standard,10,1440,100000,true
FAMILY_EXECUTIVE,Family Executive,5,360,60000,true
FAMILY_EXECUTIVE,Family Executive,5,720,90000,true
FAMILY_EXECUTIVE,Family Executive,5,1440,120000,true
```

**No Family Executive 180-minute package**. `room_count` is category metadata; do not create ten rooms for every package row.

## Other initial settings

```yaml
hotel:
  name: "Danny's Micro Hotel"
  timezone: "Asia/Manila"
  operating_hours: "24/7"
room_categories:
  DOUBLE_STANDARD:
    standard_occupancy_adults: 2
    advisory_child_allowance: 1
    extra_bed_offered: false
    additional_guest_fee_centavos: 0
  FAMILY_EXECUTIVE:
    standard_occupancy_total: 3
    extra_bed_offered: true
    extra_bed_fee_centavos: 10000
    extra_bed_charge_basis: per_continuous_stay
    additional_guest_fee_centavos: 0
payments:
  online: "GCASH_MANUAL_VERIFICATION_FULL_PREPAY"
  walkin: [CASH, GCASH]
  walkin_min_deposit_percent: 50
  extension_min_deposit_percent: 50
online_hold:
  proof_due_minutes: 30
  ui_reminder_minute: 5
  email_reminder_minutes: [15, 25]
  staff_review_target_minutes_after_proof: 15
  staff_review_urgent_minutes_after_proof: 30
  staff_review_critical_minutes_after_proof: 60
online_cancel:
  free_window_minutes_after_staff_confirmation: 60
arrival:
  online_late_grace_minutes: 60
housekeeping:
  cleaning_buffer_minutes: null # owner-confirmed setting required
  manual_ready_required: true
```

## Intentionally missing seed values

**Do not pretend confirmed:** room numbers, hotel GCash QR, real staff accounts/passwords, safe legal occupancy caps, exact cleaning minutes, extra bed quantity/stock, real guests, verified refund recipient.

## Dummy test fixtures only

Create test room identifiers like `DS-TEST-01..10` and `FE-TEST-01..05` in **test/staging only**, explicitly not real hotel room numbers. Dummy payment references must be obviously non-real; never use test payments as verified production GCash transfers.
