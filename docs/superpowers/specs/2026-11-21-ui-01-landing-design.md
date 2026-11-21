# UI-01 — A Welcome in Full Color

The approved guest homepage opens with “Stay on your schedule.” and the daytime courtyard. Use strong editorial typography, stepped alignment inspired by the hotel roofline, and generous whitespace. Scope the warm white, navy and orange palette to this page. Preserve the official logo artwork.

- Desktop uses a split editorial introduction above the broad hero image, alternating portrait room compositions, a wide hall feature and a dark nighttime introduction. Tablet uses its own offsets and proportion changes. Mobile orders the heading, booking action and taller photo before stacked room sections.
- Use the existing /book, /rooms and /verify routes. Explain that online booking is currently closed. Read current starting prices and durations from the public Express catalog. A catalog outage leaves navigation usable without a price claim. The hall preview shows approved layouts and only links to its existing route when enabled. Reviews show only published verified records when their existing flag is enabled.
- Use the official logo, daytime and nighttime exterior, two distinct views per room and the unoccupied theater setup. Preserve source photographs, dispatch responsive WebP variants and keep the original payment QR in local, ignored storage outside the frontend.
- Use one-time editorial entrances, an image reveal inside a static frame, interruptible disclosure and manual room image crossfades. Honor reduced motion and keep controls operable immediately. Keep focus visible, touch targets at least 44 CSS pixels and scrolling native.
- Preserve backend operations, guest and staff auth, feature gates, Supabase and deployment restrictions. No new runtime dependency. Stop after UI-01 for visual approval.

Acceptance includes checks at 320, 360, 390, 768, 1024, 1366, 1440 and 1920 pixels, 200% zoom, keyboard and touch emulation, reduced motion, synthetic catalog/review edge states and desktop, tablet and mobile captures.

## Media provenance

The selected originals are the official branding logo, daytime and nighttime exterior, striped and blue Double Standard rooms, both Family Executive photos and the unoccupied theater setup. The blue photo and the image named twin-bed are identical. One blue source is sufficient for the gallery. Conversion uses orientation-corrected WebP with width-specific variants, a crop around the logo artwork, and CSS object-fit for the responsive photo frames. The attendee photo and source originals are excluded from the build.
