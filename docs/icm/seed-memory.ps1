# Danny's Micro Hotel ICM memory seed — optional, requires installed rtk-ai/icm.
# Review commands and run `icm init --per-project` from project root first.
if (-not (Get-Command icm -ErrorAction SilentlyContinue)) { Write-Error "ICM CLI not installed. Read docs/icm/README.md."; exit 1 }
Write-Host "Seeding selected project facts into the configured ICM database..."
icm store -t "decisions-staytrack" -c "Selected stack: React TypeScript Tailwind frontend, separate Node Express TypeScript API, PostgreSQL; cloud first v1; development phase by phase." -i high
icm store -t "decisions-staytrack" -c "Room inventory: 10 Double Standard and 5 Family Executive; category booking, later staff physical assignment, online and walk-ins share one inventory." -i critical
icm store -t "decisions-staytrack" -c "Double packages: 3 hours 200 PHP, 6 hours 400 PHP, 12 hours 600 PHP, 24 hours 1000 PHP." -i high
icm store -t "decisions-staytrack" -c "Family Executive packages: 6 hours 600 PHP, 12 hours 900 PHP, 24 hours 1200 PHP. NEVER offer Family Executive 3 hours." -i critical
icm store -t "decisions-staytrack" -c "Only Family Executive supports optional extra bed costing 100 PHP once per continuous stay, not hourly/daily; no per-person surcharge." -i high
icm store -t "decisions-staytrack" -c "Standard occupancy is comfort advisory, not strict max: Double 2 or 3 with child, Family 3 or typically 5-6 with extra bed. Legal safety max needs verification." -i high
icm store -t "decisions-staytrack" -c "Online full static-QR GCash prepayment with manual staff actual-receipt verification; screenshot plus reference does not confirm booking." -i critical
icm store -t "decisions-staytrack" -c "Online hold 30 minutes for proof; submitted-on-time proof retains inventory protection pending staff review beyond 30 minutes. Review escalations after 15, 30 and 60 minutes." -i critical
icm store -t "decisions-staytrack" -c "Online free-cancel 1 hour after staff verifies/CONFIRMS reservation only if that room has not checked in; manual staff GCash refund. Reschedule does not reset window." -i critical
icm store -t "decisions-staytrack" -c "Walk-ins accept cash GCash or mixed multiple payments; minimum 50 percent deposit; countdown starts at official staff check-in/room access." -i critical
icm store -t "decisions-staytrack" -c "One reservation has individually scheduled room items with independent statuses and partial cancellation/reschedule; unified primary guest and payment ledger." -i critical
icm store -t "decisions-staytrack" -c "Online 1-hour late arrival grace, original checkout unchanged and no-show requires staff review; timer at zero does not auto-checkout." -i high
icm store -t "decisions-staytrack" -c "Extensions need 50 percent of extension charge first and duration starts from previous checkout; cleaning buffer and manual Ready remain required." -i high
icm store -t "decisions-staytrack" -c "Individual Staff/Admin logins with one permission tier; incident penalties and overtime waivers staff-controlled and auditable." -i high
icm store -t "context-staytrack" -c "Planning docs-only handoff 2026-11-11. Coding NOT started. Begin Phase 01 Task F01 from docs/phases/01-foundation-and-tooling.md and update docs/14-milestones.md after tested work." -i high
Write-Host "Finished. Verify with: icm recall 'Family Executive'"
