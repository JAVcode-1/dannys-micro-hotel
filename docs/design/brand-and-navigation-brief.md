---
tags: [brand, navigation, approved, visual-direction]
status: approved-for-development
approved_on: 2026-11-12
---
# Brand and Navigation Brief — Danny's Royal Horizon

> [!success] Approved project design direction
> **Royal Blue `#2443B6` + Sunset Orange `#F97316` + Soft Lavender `#EEE9FA` + Warm White `#FAFAFD`**, supported by Midnight Navy `#17213D`, Sky Blue `#EAF1FF` and white cards. The project requester approved this digital UI theme, based on real hotel photos and the minimalist room-board reference. This is **not** a promise that hotel management has formally signed off a trademark or public campaign.

## Real hotel references

The property has striking blue, lavender/pink, orange and occasional green architectural elements. The digital experience deliberately uses a **controlled subset** so the website doesn't compete visually with room photography.

![[assets/brand/hotel-exterior-reference.jpg]]

![[assets/brand/hotel-corridor-reference.jpg]]

![[assets/brand/hotel-signage-reference.png]]

> [!warning] Prices printed in older signage may be obsolete
> **Family Executive does not offer a 3-hour package**. Use [[19-seed-data]] and [[02-requirements]] for official current prices; never derive pricing from photos or AI mockups.

## Palette at a glance

![[assets/brand/royal-horizon-palette.png]]

| Primary brand | Booking CTA | Lavender | Canvas | Main text | Soft selection |
|---|---|---|---|---|---|
| `#2443B6` | `#F97316` | `#EEE9FA` | `#FAFAFD` | `#17213D` | `#EAF1FF` |

## Guest navigation

```text
+-----------------------------------------------------------------------------------+
| [DANNY'S MICRO HOTEL]          Home  Rooms & Rates  Contact     [BOOK YOUR STAY]  |
+-----------------------------------------------------------------------------------+
| [BRAND BLUE]                                                                       |
| Comfort and convenience — on your schedule.       [REAL HOTEL PHOTOGRAPHY]        |
| Open 24 hours. Browse allowed hourly packages.                                 |
| [BOOK A ROOM (orange/navy)]    [VIEW ROOMS (outline blue)]                         |
+-----------------------------------------------------------------------------------+
| [Double Standard from ₱200]                [Family Executive from ₱600]            |
+-----------------------------------------------------------------------------------+
```

- Brand blue for active links, logo accent and hero background.
- Orange CTA **with navy text**, never white-on-orange.
- White nav and airy cards; typography Plus Jakarta Sans/Inter with 16px body baseline.
- Family Executive offers **6, 12, 24 hours only**.

## Staff/Admin navigation: polished, minimalist room board

```text
+-------------------------+--------------------------------------------------+
| DANNY'S MICRO HOTEL     | Rooms Inventory         [Add Walk-In] [Alerts]   |
|-------------------------|--------------------------------------------------|
| Dashboard               | [15 rooms] [Occupied] [Ready] [Cleaning]          |
| Bookings                | Filter: status / category / room number           |
| Rooms (blue active)     |                                                  |
| Check-in / Checkout     | [Room 101?] [Room 102?] [Room 103?]                |
| Payments                |   physical states + guest info + countdown       |
| Housekeeping            |                                                  |
| Maintenance             | Payment proof review | Due-to-checkout queue      |
| Reports                 |                                                  |
| Settings / Audit        |                                                  |
+-------------------------+--------------------------------------------------+
```

Room numbers above are **wireframe placeholders**, not owner-verified physical inventory. Use current configuration and actual booking data, never mock quantities as business truth.

- White sidebar; active page **Royal Blue** fill/label or Sky Blue selected background with Royal Blue text.
- Warm White main canvas, white room cards, Lavender as *light decorative surface only*.
- Green `Ready`, purple `Occupied`, amber `Cleaning`, neutral `Maintenance`, red `Overdue`, **with icons and labels**.
- Motion: 150–220ms; reduced motion respected. 12-hour AM/PM on all screens.

For full tokens, contrast, responsive behavior and component specs, see [[09-ui-ux-design-system]].
