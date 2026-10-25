# Bright Ledger API

This folder contains the standalone Express API. The API serves `/api`, connects to PostgreSQL, applies SQL migrations at startup, and can be deployed separately from the frontend.

## Run it locally

The default local Compose setup starts PostgreSQL, the API, and the frontend together. To run the API separately, start PostgreSQL first. From the repository root:

```powershell
npm install
docker compose up -d postgres
Copy-Item .env.example .env
```

Set the deployed frontend origin and wallet-signing domain in the root `.env`, then start the API from the repository root. Session tokens are opaque, stored as hashes in PostgreSQL, and do not use a JWT secret:

```powershell
npm run dev:backend
```

The API listens on `http://localhost:4000`. Verify it at `http://localhost:4000/api/health`. Start the frontend separately with `npm run dev:frontend`, or run both with `npm run dev`.

New accounts require an injected EVM wallet signature. Each session has an eight-hour absolute lifetime, a 30-minute idle timeout, and an explicit server-side revocation path. Configure trusted verifier, administrator, or energy-host addresses only in `VERIFIER_WALLET_ADDRESSES`, `ADMIN_WALLET_ADDRESSES`, and `SPACE_OWNER_WALLET_ADDRESSES`; ordinary sign-in requests cannot grant those roles.

## Optional AI evidence triage

To enable AI evidence triage and solar funding-plan review, set `OPENROUTER_API_KEY` in the root `.env` before starting the API. The default model is `nvidia/nemotron-3.5-super-vl:free`; override it with `OPENROUTER_MODEL` if needed. Keep the key on the backend only. Evidence upload accepts one JPEG, PNG, WebP, PDF, or UTF-8 CSV file (8 MB maximum) and checks its content signature. PDF parsing uses OpenRouter's `cloudflare-ai` file-parser option.

Submitted evidence files and their SHA-256 digests are stored in PostgreSQL. Downloads are restricted to trade participants and verifier/admin roles. After both parties confirm the terms and the buyer commits escrow, the seller may submit evidence without sending a payment transaction. The buyer reviews it: approval releases escrow to the seller, while a dispute keeps escrow locked for verifier/admin resolution. A file is sent to OpenRouter only when the user explicitly requests AI analysis and consents; an AI-only preflight review processes the file in memory and stores its digest and advisory report. Provider availability, retention terms, rate limits, and model access can change; inspect OpenRouter's current terms before sending sensitive evidence. AI output never approves a record or replaces the buyer's decision.

Any authenticated participant role can calculate a cost-based project estimate and submit a solar project for independent human review. The funding planner calculates the amount from user-entered USD cost categories and contingency. AI assessment is optional and project details are sent to OpenRouter only after explicit consent; without consent, the estimate is still available and AI is not called. The model can propose revenue shares, but does not set the funding total. Estimates are planning aids—not quotes, engineering assessments, market validation, or investment recommendations. Projects under review or approved for fundraising can accept simulated non-cash interest; pending-review interest does not bypass independent approval. Any participant can enter simulated income for an active project and record allocations according to its agreed revenue shares, including proportional allocations to simulated contributors. These entries do not evidence actual proceeds or transfer funds. Project approval and review remain restricted to authorized verifiers/admins.

## API layout

- `src/app.ts` — Express middleware and API routes
- `src/auth.ts` — wallet challenges, signatures, and authorization
- `src/db.ts` — PostgreSQL pool, transactions, and migration runner
- `src/evidence-ai.ts` — bounded file validation and advisory OpenRouter analysis
- `src/solar-funding-ai.ts` — deterministic cost arithmetic and validated advisory response handling
- `src/market-policy.ts` — listing compatibility and trade matching
- `migrations/` — versioned SQL migrations applied at service startup
- `test/` — backend rule and benchmark tests

Useful root commands: `npm run build:backend`, `npm run typecheck:backend`, and `npm run test:backend`.

For a standalone deployment, build this package with `npm run build` and start it with `npm start` from this folder. The production API runs as a Docker service on Render, using the root [`Dockerfile`](../Dockerfile) and Neon PostgreSQL. Set the Neon connection string as `DATABASE_URL` and enable `DATABASE_SSL=true` in Render's environment settings.
