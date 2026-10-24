# Bright Ledger API

The standalone Express API serves `/api`, uses PostgreSQL as its only application database, and runs versioned SQL migrations at startup. It can be deployed separately from the Vite frontend.

## Run locally

From the repository root, start PostgreSQL and configure the environment:

```powershell
docker compose up -d postgres
Copy-Item .env.example .env
npm install
npm run dev:backend
```

The API listens on `http://localhost:4000`; check `http://localhost:4000/api/health`. The `DATABASE_URL` in `.env.example` is for local development only. Start the frontend in a separate terminal with `npm run dev:frontend`, or run both with `npm run dev`.

Authentication requires an injected EVM wallet. The API issues a one-time challenge and verifies the wallet signature. It stores only a SHA-256 hash of each opaque session token in PostgreSQL. Sessions expire after eight hours or 30 minutes of inactivity, and signout revokes the current session. The browser keeps the token in memory, so a page reload requires another wallet signature. Never ask users for their seed phrase or private key.

Verifier and administrator roles are not self-selectable during wallet signup. A trusted operator must provision those roles out of band; never expose role promotion to unauthenticated clients.

## AI-backed workflows

Set `OPENROUTER_API_KEY` in the backend environment to enable AI evidence triage and solar funding-plan review. Keep provider credentials on the backend and out of `VITE_*` variables.

Evidence upload accepts one JPEG, PNG, WebP, PDF, or UTF-8 CSV file (8 MB maximum), checks its content signature, stores the bytes and SHA-256 digest in PostgreSQL, and authorizes downloads for trade participants and verifier/admin roles. A file is sent to OpenRouter only when the user explicitly requests analysis and consents. AI output is advisory; it cannot approve evidence or replace an authorized human verifier.

Solar estimates use deterministic arithmetic on user-entered USD cost categories and contingency. Saving an estimate requires explicit consent and a successful AI advisory review; the AI does not set the numeric funding total. A project must reference the user's saved estimate and match its core inputs and revenue shares. New projects await verifier/admin review before accepting simulated contribution records. No money or electricity moves through these records.

## Layout and commands

- `src/app.ts` — Express middleware, authentication gates, and API routes
- `src/auth.ts` — wallet challenge verification, opaque sessions, and authorization
- `src/db.ts` — PostgreSQL pool, transactions, and migration runner
- `src/evidence-ai.ts` — bounded file validation and advisory OpenRouter analysis
- `src/solar-funding-ai.ts` — deterministic cost calculation and validated AI review
- `src/market-policy.ts` — listing compatibility and trade matching
- `src/seed.ts` — optional fictional local example records
- `migrations/` — versioned schema migrations, applied at service startup
- `test/` — backend policy and provider tests

Useful root commands: `npm run build:backend`, `npm run typecheck:backend`, and `npm run test:backend`.

This package has its own `package.json` and lockfile for standalone Render deployment. Configure a managed PostgreSQL `DATABASE_URL` with TLS as appropriate, the frontend origin in `API_ORIGIN`, and the browser-facing frontend origin/domain in `AUTH_URI` and `AUTH_DOMAIN`. Keep `SEED_SAMPLE_DATA` disabled outside local evaluation.
