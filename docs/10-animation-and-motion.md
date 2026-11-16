---
tags: [design, motion]
status: proposed
---
# 10 — Animation and Motion Guidelines

Motion is supportive, never the source of truth for hotel timers or payment status. The **approved** visual baseline is **Danny's Royal Horizon**, as specified in [[09-ui-ux-design-system]].

- Use subtle **150–220 ms** transitions for navigation, cards and dialogs; avoid blocking critical staff actions.
- Booking progress indicators announce changes with accessible text (selected package, proof pending, payment verified, confirmed).
- Countdown may tick visually every second but must recompute from `scheduled_checkout_at - server-synchronized_now`, not decrement a local variable forever.
- Warning animations must not distract; overdue status stays visible without relying on red color or blinking.
- Support `prefers-reduced-motion`; motion off should still show equivalent information.
- Email/notification sending must not be tied to browser animation/interval.

## Motion acceptance checks

- [ ] Keyboard and screen reader usable with/without motion.
- [ ] Changing tabs or device sleep doesn't make countdown drift.
- [ ] No false automatic check-out animation when time reaches zero.
- [ ] Staff changes to timer schedule refresh all open clients safely (poll/WebSocket later, documented design choice).

## Branded motion details

- Guest navigation active underline uses Royal Blue `#2443B6`; hover may introduce Sky Blue `#EAF1FF`, not a dramatic full-screen wipe.
- Sunset Orange `#F97316` guest booking CTA (Midnight Navy text) can lift 1–2px with a soft shadow on hover; no perpetual pulsing.
- Staff sidebar active item changes with a short, reduced-motion-safe transition.
- Payment confirmation must appear only after staff verification is recorded by the backend, never due to an animation finishing.
