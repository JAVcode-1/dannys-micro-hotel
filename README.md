# StayTrack — Danny's Micro Hotel

StayTrack manages accommodation and Function Hall bookings, staff-verified GCash payments, walk-ins, check-in and checkout, housekeeping, refunds, and reporting. The system uses a React frontend, a separate Node.js and Express API, and Supabase-managed PostgreSQL.

## Run locally

1. Open the repository root in VS Code. Use Node.js 22 or later and install workspace dependencies with `npm ci`.
2. Configure the approved Supabase development project in `backend/.env` using [backend/.env.example](backend/.env.example). Follow the [hosted development setup](docs/hosted-booking-setup.md) for schema, authentication, and storage requirements.
3. Run `npm run dev` from the repository root. Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

The launcher starts Express and Vite, uses the configured Supabase development project, and leaves migrations and seeds to separately approved workflows. Keep real credentials in the ignored environment file. Guest email OTP delivery requires the configured Supabase email templates and SMTP. Staff sign in with their individual Supabase accounts.

For disposable local fixtures, use `npm run dev:isolated` and follow the [isolated development guide](docs/isolated-development.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React, TypeScript, Vite, and Tailwind |
| `backend/` | Express API and business logic |
| `packages/shared/` | Shared TypeScript contracts |
| `supabase/` | Supabase configuration, SQL migrations, and seed files |
| `docs/` | Canonical requirements, decisions, milestones, and phase checklists |
| `scripts/` | Local development and verification tooling |

## Documentation and development

Open the repository root as the Obsidian vault and start at [00-START-HERE.md](00-START-HERE.md). Use the [requirements](docs/02-requirements.md), [milestones](docs/14-milestones.md), and [design system](docs/09-ui-ux-design-system.md) for current scope and acceptance evidence. Architecture maps and project context are available in [Graphify](docs/graphify/README.md) and [ICM](docs/icm/README.md).

Follow [AGENTS.md](AGENTS.md) for development workflow and [QUALITY-GATE-SETUP.md](QUALITY-GATE-SETUP.md) for skill verification, Windows tool setup, and the full gate.
