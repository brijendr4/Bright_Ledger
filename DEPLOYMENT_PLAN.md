# Bright Ledger Deployment Plan

## 1. Purpose and scope

This document is the deployment plan for the Bright Ledger project. It consolidates the repository’s existing architecture, local Docker workflow, SmarterASP.NET hosting target, environment variables, security rules, observability expectations, rollback procedure, and validation gates.

The plan is intentionally practical and implementation-aware. The hosting steps are provider-neutral where the host control panel and selected plan have not been verified.

## 2. Deployment summary

Bright Ledger is structured as a monorepo with three main runtime areas:

- Frontend: Vite + React + TypeScript in `frontend/`
- Backend: Express + PostgreSQL + wallet-auth + API logic in `backend/`
- Blockchain: Hardhat/Ethers contract workspace in `blockchain/`; contracts deploy to a selected EVM network rather than run as a hosted application service

The project is designed for:

- Local development via Docker Compose
- Separate deployment of the API and static frontend to SmarterASP.NET, subject to selected-plan compatibility
- Local blockchain development using Hardhat and a local EVM
- Ethereum Sepolia contract deployment with native test-ETH escrow for trade lifecycle testing

## 3. Current deployment architecture in this repo

### 3.1 Local stack
The root `docker-compose.yml` config defines:

- PostgreSQL on `127.0.0.1:5432`
- Local blockchain node on `127.0.0.1:8545`
- Backend API on `127.0.0.1:4000`
- Frontend app on `127.0.0.1:5173`

The backend waits for the blockchain contract address to be created, then starts with the app-specific environment variables.

The root `Dockerfile` builds the full monorepo and exposes ports:

- 5173
- 4000
- 8545

### 3.2 Backend deploy target
The backend is a standalone Node.js service in `backend/`:

This matches the backend package script setup in `backend/package.json`:

- `dev`: `tsx watch src/index.ts`
- `build`: `tsc -p tsconfig.json`
- `start`: `node dist/index.js`
- `typecheck`: `tsc --noEmit -p tsconfig.json`
- `test`: `vitest run`

The intended hosting target is SmarterASP.NET, configured manually in its control panel. Before deploying, confirm the selected plan supports Node.js `>=22.12.0`, a continuously running Express service, and outbound PostgreSQL connections. No provider-specific service manifest is included.

### 3.3 Frontend deploy target
The Vite frontend builds to static files in `frontend/dist`:

This matches the root package scripts:

- `build:frontend`: `npm run build --workspace @bright-ledger/frontend`
- `preview`: `npm run preview --workspace @bright-ledger/frontend`

Deploy the generated static files using the SmarterASP.NET static-site or web-file hosting option available in the selected plan. Configure `VITE_API_BASE_URL` before building so the client points to the deployed API.

### 3.4 Blockchain deploy target
The blockchain package uses Hardhat:

- `build`: `hardhat compile`
- `node`: `hardhat node`
- `compile`: `hardhat compile`
- `test`: `hardhat test`
- `deploy`: `hardhat run scripts/deploy.ts --network localhost`
- `deploy:sepolia`: `hardhat run scripts/deploy.ts --network sepolia`

The contract is a one-time deployment artifact, not a long-running process. Deploy it from a trusted local machine or CI runner; the SmarterASP.NET backend talks to the deployed contract over the configured RPC endpoint. Do not run Hardhat node on the hosting service.

## 4. Environment and configuration requirements

Use a root `.env` for local development and per-host secret configuration for deployed services.

### 4.1 Required local variables
The repo contains `.env.example` with the following expected variables:

- `DATABASE_URL`
- `API_PORT=4000`
- `API_ORIGIN=http://localhost:5173`
- `AUTH_URI=http://localhost:5173`
- `AUTH_DOMAIN=Bright Ledger`
- `VITE_API_BASE_URL=`
- `CHAIN_RPC_URL=http://127.0.0.1:8545`
- `CONTRACT_ADDRESS=`
- `CHAIN_ID=31337`
- `SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`
- `DEPLOYER_PRIVATE_KEY` (local deployment only; never configure on the frontend or hosted backend)
- `EIA_API_KEY=`
- `OPENROUTER_API_KEY=`
- `OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free`
- `ADMIN_WALLET_ADDRESSES=`
- `VERIFIER_WALLET_ADDRESSES=`
- `SPACE_OWNER_WALLET_ADDRESSES=`

Notes:

- Do not place secrets in `VITE_*` variables.
- Keep wallet and DB credentials out of the client bundle.
- The backend reads environment variables from the workspace root or backend folder, depending on runtime context.

### 4.2 Production deployment variables
For SmarterASP.NET, configure only the variables that belong in each runtime:

Frontend build (public-safe only):

- `VITE_API_BASE_URL`
- Public RPC URL if required
- Public contract address if needed for browser access

Backend service (server-side only):

- `DATABASE_URL`
- `DATABASE_SSL=true`
- `API_ORIGIN`
- `AUTH_URI`
- `AUTH_DOMAIN`
- `CHAIN_RPC_URL`
- `CONTRACT_ADDRESS`
- `CHAIN_ID`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `ADMIN_WALLET_ADDRESSES`
- `VERIFIER_WALLET_ADDRESSES`
- `SPACE_OWNER_WALLET_ADDRESSES`
- `EIA_API_KEY`

Do not expose database credentials, wallet secrets, or private keys in the frontend.

## 5. Deployment phases

### Phase 1: Local development and verification

Goal: ensure the repo builds in a clean environment and the app can run without developer-only local assumptions.

Required commands:

```powershell
cd "C:\brijendra\Bright Ledger"
npm install
docker compose up --build
```

This starts PostgreSQL, the local blockchain, the backend, and the frontend.

Expected runtime:

- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/health
- Local EVM RPC: http://127.0.0.1:8545
- Chain ID: 31337

### Phase 2: Staging deployment

Goal: make the frontend and backend accessible without requiring a localhost-only setup.

Intended target architecture, subject to plan compatibility:

- Frontend: static Vite output on SmarterASP.NET
- Backend: Node.js API on SmarterASP.NET
- Database: PostgreSQL service reachable by the backend
- Smart contract: one-time deployment to Ethereum Sepolia; the backend uses Sepolia RPC

Deployment steps:

1. Confirm the selected SmarterASP.NET plan supports the Node.js runtime, long-running API process, PostgreSQL connectivity, and static frontend hosting required by this app; verify current free-offer limits with the provider.
2. From the repository root, run `npm run build` and `npm run chain:test` to build the frontend, backend, and Solidity contract and run its tests.
3. From a trusted local machine or CI runner, deploy once with `npm run chain:deploy:sepolia`; the deployer wallet needs SepoliaETH for deployment gas. Keep its private key local and save the printed contract address.
4. Build the frontend with `VITE_API_BASE_URL` set to the deployed API's HTTPS origin, then publish the contents of `frontend/dist`.
5. Build the backend from `backend/` with `npm ci && npm run build`, configure server-side environment variables, and start it with `npm start`. Include `CHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`, `CHAIN_ID=11155111`, and the deployed `CONTRACT_ADDRESS`. Do not configure `DEPLOYER_PRIVATE_KEY` on the host.
6. Add the authorized verifier wallet to `VERIFIER_WALLET_ADDRESSES`; the contract owner/deployer must also enable that wallet with `setVerifier` (the deployer is a verifier by default).
7. Configure the PostgreSQL database connection and run the API so its startup migrations can apply.
8. Ensure CORS allows the deployed frontend origin only.
9. Verify `/api/health`, `/api/config`, the frontend page, and a buyer-authorized Sepolia escrow/review/refund-or-release flow using test wallets.

### Phase 3: Preview and release deployment

Validate changes in a separate staging deployment before updating the production site. Keep production deployment on the intended branch only.

Requirements:

- Preview environment variables differ from production values
- Frontend and backend point to the correct environment-specific services
- Health checks pass before approving the release
- Migrations are applied in a controlled, reviewed manner

### Phase 4: Public demo / environment hardening

Before exposing the app publicly:

- Validate auth, CORS, and secured secrets
- Confirm the database is reachable from the backend
- Confirm RPC access works with the configured chain
- Confirm wallet network checks match the intended chain
- Confirm all public pages are safe without localhost assumptions
- Record the contract address, deployment hash, and explorer links if using a chain-backed demo

## 6. Validation and operational checks

The repository should be considered ready to deploy only after these checks are passing in the target environment.

### 6.1 Required validation commands
At the time of this document, the repository passes these checks:

```powershell
cd "C:\brijendra\Bright Ledger"
npm run build
npm run test:backend
npm run chain:test
```

Validated results:

- `npm run build` succeeded
- Backend Vitest suite: 5 files passed, 21 tests passed
- Blockchain Hardhat suite: 3 tests passed

### 6.2 Required deployment gate checks
The app should not be considered deployed until the following are successful:

- Frontend loads without localhost-only assumptions
- Backend health endpoint responds successfully
- PostgreSQL is connected and healthy
- Blockchain RPC is reachable and the expected chain ID is active
- API CORS allows only intended web origins
- Server-side secrets are not exposed in the client
- Auth checks reject unauthorized access
- A successful and failed transaction path are both testable

## 7. Security requirements

These are mandatory deployment rules for this project:

- Use `.env` or the host secret manager; never commit secrets
- Keep database credentials and private keys out of the client code
- Use separate values for local, preview, and production environments
- Restrict CORS to trusted origins only
- Limit admin and verifier wallet addresses to explicit allowlists
- Do not trust client-side values for wallet role checks, prices, quantities, or settlement decisions
- Validate all external file uploads and AI calls with explicit consent flow
- Keep OpenRouter credentials on the backend only
- Avoid exposing any private chain or database configuration to the browser

## 8. Production deployment checklist

### Frontend checklist

- Frontend is built with `npm run build:frontend`
- Static output from `frontend/dist` is published to the configured site
- Only public-safe config is included
- `VITE_API_BASE_URL` points to the deployed API
- Direct route refresh works
- HTTPS is enabled

### Backend checklist

- Selected SmarterASP.NET plan supports Node.js `>=22.12.0` and a continuously running Express service
- Backend is built from `backend/` with `npm ci && npm run build`
- Start command is `npm start`
- Health check path `/api/health` works
- PostgreSQL is reachable and `DATABASE_URL` is configured on the backend host
- `API_ORIGIN` and auth values are set correctly
- `CHAIN_RPC_URL`, `CHAIN_ID`, and `CONTRACT_ADDRESS` are correct
- OpenRouter key is present only where AI features are enabled

### Database checklist

- PostgreSQL is reachable from the backend
- Migrations are applied cleanly
- SSL is enabled for hosted Postgres where required
- Connection strings are not hard-coded in client code
- DB credentials are rotated if exposed

### Blockchain checklist

- Local Hardhat chain is used for local development
- Testnet deployment is used only where explicitly intended
- Contract address and deployment hash are recorded in deployment notes
- RPC and chain ID are validated before use
- Wallets are dedicated, not personal mainnet keys
- Frontend picks up the correct network and contract address

## 9. Rollback and recovery plan

If a production deployment fails:

1. Revert frontend and backend to the last known-good release.
2. Keep the old deployment URL live while verifying the rollback.
3. Confirm the database is still consistent with the app’s expected state.
4. Restore environment variables if misconfigured.
5. Re-run health checks and a minimal user journey.
6. Reconcile any partially written database or chain events before re-enabling transactions.

A rollback is only considered successful when the public app and API both return to an expected, healthy state.

## 10. Monitoring and observability

The deployed app should expose enough signal to detect issues quickly:

- Backend health endpoint status
- Database connectivity status
- RPC connectivity status
- Error rate and request latency
- Transaction status for wallet-backed actions
- Failed or pending jobs tied to chain or provider operations
- Log entries with request context but without secrets

If a third-party service is unavailable, the UI should display a safe, explicit message instead of pretending the action succeeded.

## 11. Pull request database branches (Neon)

The repository includes `.github/workflows/neon-pr-branches.yml` to create a short-lived Neon database branch when a same-repository pull request is opened, reopened, or updated, and delete the branch when the pull request closes. Each branch is named `preview/pr-<number>` and is configured to expire after 14 days as a cleanup safeguard.

Before enabling this workflow, configure these GitHub repository settings:

- Repository variable `NEON_PROJECT_ID`: the Neon project ID
- Repository secret `NEON_API_KEY`: a Neon API key with access to create and delete branches in that project

The workflow intentionally skips pull requests from forks because GitHub does not provide repository secrets to those workflows. It creates and deletes database branches only; it does not run migrations or use the branch for deployment. Do not add database URLs to workflow logs. If a later workflow needs to run migrations or integration tests against a branch, pass the action output directly as a masked environment variable and avoid printing it.

## 12. Demo and release gates

### Gate A: code is ready for broader review

- Build passes
- Tests pass or configured failures are known and tracked
- Core architecture and trust boundaries are documented
- No critical secret exposure is known

### Gate B: shared testing is ready

- Auth and permission checks are validated across multiple users
- Database records persist correctly
- Backend validation and API rules are active
- Demo-only data is clearly marked

### Gate C: staging demo is ready

- API and frontend are reachable on deployed domains
- Correct environment variables are configured
- Health checks succeed
- wallet and chain checks match the selected network

### Gate D: public presentation is ready

- Fresh browser session works without localhost secrets
- All critical flows work in a clean environment
- No critical or high-severity issue remains unmitigated
- Backup demo plan exists for provider or RPC outages

## 13. Recommended implementation order

1. Verify local Docker setup and environment variables.
2. Confirm backend and frontend build commands work.
3. Run backend logic tests and blockchain tests.
4. Verify selected SmarterASP.NET plan compatibility, then configure the API and static frontend in its control panel.
5. Set environment-specific secrets for deployment targets.
6. Validate health endpoints and CORS.
7. Test wallet-driven flows and chain integration in staging.
8. Run a clean end-to-end demo path against the public deployment.
9. Record deployment URLs, transaction hashes, and known limitations.
10. Keep a fallback runbook ready for provider failures.

## 14. Final acceptance principle

A feature or deployment is complete only when the following agree:

- Frontend behavior
- Backend decision logic
- Database record state
- Relevant blockchain or RPC evidence
- Failure and recovery paths

If any of these disagree, the deployment is not ready.

## 15. Current repository validation status

The current repository was checked in this environment using the following commands:

```powershell
cd "C:\brijendra\Bright Ledger"
npm run build
npm run test:backend
npm run chain:test
```

Observed results:

- `npm run build` succeeded
- `npm run test:backend` passed: 21/21 tests
- `npm run chain:test` passed: 3/3 tests

This means the current repository is in a strong state for deployment planning and for a controlled staging release, pending host-specific env configuration and deployment credentials.

## 16. Practical hosting recommendation

For the current Bright Ledger project, the cleanest path is:

- SmarterASP.NET for the frontend and API, only if the selected plan supports the required Node.js runtime and PostgreSQL connectivity
- A PostgreSQL service reachable by the API
- Local Hardhat/EVM for development, with testnet deployment only when a network-backed demo is explicitly required

The repository does not contain hosting-provider manifests. Configure deployment manually and confirm current free-plan terms, supported runtimes, database availability, and resource limits with SmarterASP.NET before relying on a free deployment.
