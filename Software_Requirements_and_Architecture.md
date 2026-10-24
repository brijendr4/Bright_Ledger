# P2P Renewable Energy Trading Platform
## Software Requirements Specification, Architecture & Implementation Blueprint

**Project type:** Hackathon MVP  
**Project Name:** Bright ledger
**Track:** Renewable Energy & Energy Trading  
**Working name:** GreenGrid P2P  
**Document version:** 1.0  
**Purpose:** Convert the ideas in *BPET: A Unified Blockchain-Based Framework for Peer-to-Peer Energy Trading* into an implementable hackathon project.

---

## 1. Executive Summary

GreenGrid P2P is a web-based prototype that lets renewable-energy prosumers publish surplus energy offers, lets consumers publish energy requests, matches compatible offers and requests, records trade commitments on a blockchain, and awards non-monetary clean-energy incentive points after a simulated or verified delivery event.

The system combines a conventional application backend and database with blockchain-based auditability. The database stores application data and searchable history; the blockchain stores key trade commitments, settlement status, and incentive issuance events. Meter readings and renewable certificates are treated as external evidence that must be validated before settlement.

**Hackathon scope:** use simulated smart-meter data and a local blockchain or public testnet. Do not claim the prototype physically routes electricity between homes, replaces a utility, or performs regulated real-money settlement.

### 1.1 Problem statement

Renewable generation is distributed across homes, campuses, businesses, and microgrids, but small producers may have limited ways to signal surplus generation and trade it transparently with nearby consumers. Centralized systems can make auditability and interoperability difficult. A P2P platform can coordinate offers, requests, matching, trade records, and incentives while using blockchain to make selected records tamper-evident.

### 1.2 Proposed solution

1. Register a prosumer, consumer, or verifier.
2. Submit a simulated or device-derived generation/consumption reading.
3. Create an energy sell offer or buy request.
4. Match compatible offers and requests using quantity, price, time window, and optional locality.
5. Create a trade and record its commitment on-chain.
6. Submit delivery evidence; validate it before settlement.
7. Mark the trade settled and issue clean-energy reward points under configured rules.
8. Show the user an auditable history of offers, trades, evidence, and rewards.

### 1.3 Research basis and proposed design

The reference paper describes BPET as a unified and extensible blockchain-based P2P energy-trading framework. Its key ideas include modular smart contracts, microservices, configurable local-market rules, and price-formation mechanisms. It discusses different market settings, including bilateral and pool trading.

This blueprint **adapts** those ideas for a small demonstrable MVP. The particular stack, database tables, API endpoints, sample matching algorithm, token policy, and security controls below are proposed engineering choices—not claims that the paper specified these exact implementation details.

---

## 2. Goals, Non-Goals, and Success Criteria

### 2.1 Goals

- Demonstrate an end-to-end energy-trade lifecycle.
- Support prosumers and consumers with different roles.
- Make trade commitments and settlement events auditable.
- Keep the trading rules modular so the matching/pricing policy can be changed.
- Demonstrate renewable-energy incentives without requiring a cash budget.
- Provide clear evidence for judges: a working UI, transaction hashes, event logs, and test results.

### 2.2 Non-goals for the hackathon MVP

- Physical electricity routing or grid control.
- Utility-grade meter integration or legally binding meter certification.
- Real-money payments, exchange, or fiat custody.
- A production-ready carbon-credit or renewable-energy-certificate registry.
- Automated grid dispatch, protection, or safety-critical control.
- Claims of regulatory compliance, production security, or measured climate impact without evidence.

### 2.3 Demonstration acceptance criteria

The MVP is considered demonstrable when:

1. A user can connect a wallet or use a clearly labeled demo account.
2. A prosumer can create an offer with a positive quantity and price.
3. A consumer can create a request.
4. The matching service can find a compatible offer/request and prevent over-allocation.
5. A trade can be created and its blockchain transaction hash displayed.
6. A delivery-evidence record can be submitted and reviewed.
7. Settlement cannot happen before the required evidence/approval state.
8. Reward points are issued no more than once for the same eligible trade.
9. A user can view the trade status and event history.
10. Automated tests cover core business rules and common invalid inputs.

---

## 3. Users and Actors

| Actor | Responsibilities |
|---|---|
| Prosumer | Registers, records generation, publishes surplus-energy offers, reviews trade history, submits delivery evidence |
| Consumer | Registers, publishes energy requests, accepts/matches offers, reviews purchased energy and history |
| Market service | Validates offers and requests, applies matching/pricing rules, prevents over-allocation |
| Meter/evidence adapter | Imports simulated or real readings and attaches evidence metadata |
| Verifier/operator | Reviews evidence and resolves exceptions in the MVP |
| Smart contract | Records trade commitments and settlement/reward state transitions on-chain |
| Administrator | Configures market parameters, manages emergency pause, and monitors platform health |
| Judge/demo viewer | Views the dashboard, sample transactions, audit trail, and project limitations |

A single person may be both a consumer and a prosumer. Use role permissions for actions, not separate accounts for every role.

---

## 4. Scope and Core User Stories

### 4.1 User stories

- As a prosumer, I want to publish surplus energy so consumers can discover it.
- As a consumer, I want to request a quantity of energy at a maximum price.
- As a participant, I want to see how a trade price and match were determined.
- As a participant, I want to inspect a trade’s status and transaction hash.
- As a verifier, I want to approve or reject delivery evidence before settlement.
- As a participant, I want to earn clean-energy points for eligible settled trades.
- As an administrator, I want to pause unsafe contract operations and inspect failures.
- As a judge, I want to run a repeatable demo without needing real energy hardware or real money.

### 4.2 MVP feature priority

| Priority | Feature | MVP decision |
|---|---|---|
| P0 | Wallet/demo authentication and participant profile | Build |
| P0 | Create sell offers and buy requests | Build |
| P0 | Matching and trade lifecycle | Build |
| P0 | Smart-contract trade record | Build on local chain or testnet |
| P0 | Evidence submission and verifier approval | Build with simulated readings |
| P0 | Reward points and audit history | Build; points have no monetary value |
| P1 | Dashboard charts and neighborhood filter | Build if time allows |
| P1 | Renewable certificate metadata | Prototype metadata and evidence hashes only |
| P2 | IoT smart-meter integration | Future extension |
| P2 | Pool market / auction pricing | Future extension |
| P2 | Real payment and utility settlement | Out of scope |

---

## 5. Functional Requirements

IDs are included for traceability and testing.

### FR-01: Participant onboarding

- The system shall allow a participant to connect an EVM-compatible wallet.
- The system shall create or retrieve a participant profile associated with a wallet address.
- The system shall support participant roles: `PROSUMER`, `CONSUMER`, `BOTH`, `VERIFIER`, and `ADMIN`.
- The system shall never ask a user to provide or store a wallet seed phrase or private key.
- If a demo login is provided, it must be clearly marked as demo-only and isolated from real accounts.

**Acceptance:** a valid wallet address maps to one profile; malformed addresses and unauthorized role changes are rejected.

### FR-02: Energy readings

- The system shall accept a reading containing participant, reading interval, energy quantity, unit, source, and evidence metadata.
- Quantities shall use a consistent unit: kilowatt-hour (`kWh`).
- The MVP shall support simulated readings and label them as simulated.
- The system shall reject negative quantities, invalid intervals, and duplicate external reading identifiers.
- Readings used for settlement shall be immutable after approval; corrections should create a new version or correction record.

### FR-03: Sell offers

- A prosumer shall be able to create an offer with quantity, minimum price, delivery window, location/microgrid identifier, and optional renewable-source metadata.
- The system shall validate that quantity and price are positive and that the delivery window is valid.
- The offer shall have a state such as `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELLED`, or `EXPIRED`.
- An offer shall not be allocated beyond its remaining quantity.

### FR-04: Buy requests

- A consumer shall be able to create a request with desired quantity, maximum price, delivery window, and optional locality constraint.
- The request shall have a state such as `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELLED`, or `EXPIRED`.
- A request shall not be allocated beyond its remaining quantity.

### FR-05: Market matching

- The market service shall compare compatible offers and requests.
- The MVP matching policy shall consider time-window overlap, available quantity, maximum buyer price, minimum seller price, and optional same-microgrid restriction.
- A match shall be created only if the buyer's maximum price is at least the seller's minimum price.
- The MVP shall use a documented pricing policy, such as midpoint price: `(seller_min_price + buyer_max_price) / 2`, subject to configured precision and caps.
- Matching shall be idempotent and transactionally reserve quantities so concurrent requests cannot oversell or overbuy.
- The system shall record the matching policy version for each trade.

**Important:** this is a simple MVP policy, not a claim that it is optimal or appropriate for every electricity market. A production deployment must use rules approved for the relevant jurisdiction and market.

### FR-06: Trade creation

- A successful match shall create a trade record with buyer, seller, quantity, unit price, total amount, delivery interval, pricing-rule version, and status.
- The system shall submit a trade commitment to the blockchain and save the returned transaction hash.
- A trade shall not be treated as on-chain committed until the transaction receipt is successful and the configured confirmation policy is met.
- Repeated submission of the same logical trade shall not create duplicate trades.

### FR-07: Delivery evidence

- A seller or authorized adapter shall submit delivery evidence associated with a trade.
- Evidence shall include reading interval, delivered kWh, source type, submission time, and a content hash or signed evidence reference.
- The verifier workflow shall approve, reject, or request correction of evidence.
- The MVP shall distinguish `SIMULATED` evidence from `METER_SIGNED` or other externally verified evidence.
- A hash proves integrity of the submitted evidence file, not that the measurement itself is truthful.

### FR-08: Settlement

- The system shall settle a trade only when the required evidence is approved and all settlement preconditions are satisfied.
- The backend shall calculate settlement quantities and amounts using decimal-safe arithmetic.
- The smart contract shall reject duplicate settlement.
- If delivered energy is less than committed energy, the MVP shall record partial delivery and either settle the verified quantity or route the trade to manual review according to configured policy.
- The MVP shall not transfer real money. Settlement is a recorded business state only, unless a clearly labeled test token is explicitly enabled.

### FR-09: Renewable incentives

- The platform shall calculate reward points only for eligible, approved, settled renewable-energy trades.
- Reward rules shall be configurable, versioned, and visible to users.
- The reward calculation shall be deterministic, for example `points = floor(verified_renewable_kWh × points_per_kWh)`.
- The platform shall prevent duplicate reward issuance for the same trade.
- Points shall be described as **demo incentive points with no cash value** unless a separately reviewed token model is implemented.
- The MVP shall not promise cash redemption, guaranteed financial value, or carbon-credit equivalence.

### FR-10: History and auditability

- Users shall be able to view offers, requests, trades, evidence status, reward points, and blockchain transaction hashes.
- The system shall record who performed important off-chain actions and when.
- The UI shall show failed/pending blockchain transactions distinctly from confirmed transactions.
- An administrator shall be able to inspect failed transactions without modifying finalized audit records.

### FR-11: Administration

- Authorized administrators shall configure market settings and reward rates.
- Privileged actions shall be logged.
- Smart-contract ownership and pause privileges shall be restricted and documented.
- The administrator shall not be able to silently rewrite a finalized trade event; corrections shall create additional audit entries.

### FR-12: Notifications

- The platform may notify users when offers match, a trade is committed, evidence is approved/rejected, settlement completes, or rewards are issued.
- Notifications are informational; the database and contract states remain authoritative.

---

## 6. Non-Functional Requirements

The values below are **proposed hackathon targets**, not measured performance claims.

| ID | Category | Requirement / target |
|---|---|---|
| NFR-01 | Security | Validate all API inputs; enforce authorization server-side; never expose private keys or secrets |
| NFR-02 | Integrity | Every trade shall have a unique application ID and, after on-chain submission, a transaction hash |
| NFR-03 | Idempotency | Retrying a create/settle/reward request must not duplicate the logical operation |
| NFR-04 | Consistency | Offer/request quantity reservation shall use database transactions or equivalent concurrency control |
| NFR-05 | Performance | For a small demo dataset, ordinary API responses should target under 500 ms at the 95th percentile, excluding blockchain confirmation; benchmark before making claims |
| NFR-06 | Availability | The demo shall provide a documented restart/recovery procedure; production uptime guarantees are out of scope |
| NFR-07 | Scalability | Keep matching, evidence processing, blockchain writes, and notifications as separable modules |
| NFR-08 | Maintainability | Use versioned APIs, documented contracts, migrations, automated tests, and clear configuration |
| NFR-09 | Interoperability | Use EVM-compatible contracts and standard JSON APIs; keep market rules behind an interface |
| NFR-10 | Privacy | Store only necessary personal data; do not put names, email addresses, precise household details, or raw meter data directly on a public chain |
| NFR-11 | Auditability | Persist application event logs and blockchain transaction references for important state transitions |
| NFR-12 | Accessibility | Forms shall have labels, validation messages, keyboard support, and readable contrast |
| NFR-13 | Recoverability | Back up the database and document how to reconcile pending transactions after restart |
| NFR-14 | Observability | Record structured logs, API errors, transaction failures, and basic health metrics |
| NFR-15 | Safety | The UI shall state that energy delivery and meter readings are simulated unless connected to a verified external source |

---

## 7. Proposed Technology Stack

A practical stack for a three-person hackathon team:

| Layer | Recommended option | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast dashboard development and reusable components |
| UI | Tailwind CSS or a component library | Consistent, responsive interface |
| Wallet | MetaMask / injected EVM provider; WalletConnect if needed | Sign user actions without collecting private keys |
| Backend API | Node.js + TypeScript + Express or NestJS | Shared language with frontend and Solidity tooling |
| Database | PostgreSQL | Relational constraints and transactional quantity reservation |
| ORM/migrations | Prisma or Drizzle | Typed database access and migrations |
| Smart contracts | Solidity | EVM-compatible contract implementation |
| Contract tooling | Hardhat or Foundry | Compile, test, deploy, and verify contracts |
| Local blockchain | Hardhat Network or Anvil | Free, repeatable local development |
| Optional demo testnet | A currently supported EVM testnet | Public transaction explorer; check current faucet/network status before selecting |
| Blockchain client | ethers.js or viem | Submit transactions and read events |
| API docs | OpenAPI / Swagger | Testable endpoint contract |
| Testing | Vitest/Jest, Supertest, Solidity unit tests | Unit, integration, and contract testing |
| Deployment | Docker Compose; frontend/backend on a suitable host | Reproducible demo setup |
| CI | GitHub Actions or equivalent | Lint, type-check, tests, contract compilation |

**Keep it small:** do not add Kubernetes, complex event streaming, or multiple databases unless the team has a specific need. A modular monolith backend with separate modules is usually more achievable than deploying many independent microservices during a short hackathon.

---

## 8. High-Level Architecture

```mermaid
flowchart TB
    U[Prosumer / Consumer / Verifier] --> FE[React Web App]
    FE -->|REST API| API[Backend API]
    FE -->|Wallet signature| WALLET[User Wallet]
    API --> AUTH[Authentication and Authorization]
    API --> MARKET[Market and Matching Module]
    API --> EVID[Meter Evidence Module]
    API --> SETTLE[Settlement and Rewards Module]
    MARKET --> DB[(PostgreSQL)]
    EVID --> DB
    SETTLE --> DB
    API --> TX[Blockchain Transaction Worker]
    TX --> RPC[Blockchain RPC]
    RPC --> SC[EnergyTrading Smart Contract]
    SC --> CHAIN[(EVM Blockchain)]
    TX --> DB
    CHAIN --> INDEX[Event Listener / Reconciler]
    INDEX --> DB
    API --> OBS[Logs and Health Checks]
```

### 8.1 Component responsibilities

- **Web app:** wallet connection, offers, requests, matching results, trade detail, evidence upload, rewards, history.
- **API:** request validation, authorization, rate limiting, application workflows.
- **Market module:** compatible offer/request search, pricing policy, quantity reservation.
- **Evidence module:** reading ingestion, validation, evidence hashing, verifier decisions.
- **Settlement/rewards module:** eligibility checks, settlement amount, idempotent reward calculation.
- **Blockchain transaction worker:** submits writes, retries safe operations, records receipts.
- **Event listener/reconciler:** listens for contract events and periodically checks pending transactions.
- **PostgreSQL:** searchable application state, user profiles, readings, offers, requests, evidence metadata, and audit records.
- **Smart contract:** on-chain trade commitments, status transitions, and reward-issuance guardrails.

### 8.2 On-chain vs off-chain data

| Data | Storage | Reason |
|---|---|---|
| Wallet address | Database; optionally contract participant identity | Public identifier, still treat as linkable data |
| Name, email, profile settings | Off-chain database | Privacy and correction |
| Full meter data | Off-chain, access-controlled | Volume and privacy |
| Evidence content | Off-chain object storage or database | Size and privacy |
| Evidence hash | On-chain or off-chain with on-chain reference | Tamper-evidence without publishing raw data |
| Offer/request search fields | Off-chain database | Efficient queries and filtering |
| Trade ID, participants, quantity, agreed price, status | On-chain commitment plus off-chain indexed copy | Auditability and UI performance |
| Transaction hash and event data | Off-chain index plus blockchain | Traceability |
| Demo reward issuance | Contract or database ledger, depending on demo mode | Contract demonstrates on-chain issuance; DB ledger is simpler for points-only MVP |

**Design rule:** blockchain is not a replacement for the database. Use it for shared commitments and auditable state changes, not every query or every byte of data.

---

## 9. Architecture Decisions

### ADR-01: EVM-compatible blockchain

**Decision:** use a local EVM chain for development; optionally deploy to an EVM testnet for judging.

**Reason:** supports Solidity contracts and familiar development tools.

**Trade-off:** public-chain transactions may be slow or require testnet tokens. A local chain is reliable for demos but does not prove public-network deployment.

### ADR-02: Hybrid on-chain/off-chain model

**Decision:** keep personal details, full readings, and searchable listings off-chain; store selected trade commitments and state transitions on-chain.

**Reason:** reduces cost and privacy exposure while retaining auditable commitments.

### ADR-03: Verifier-gated settlement

**Decision:** the MVP requires a designated verifier or trusted backend workflow to approve delivery evidence before settlement.

**Reason:** a smart contract cannot independently know whether a physical meter reading is true. The verifier is a trust assumption and must be shown transparently.

### ADR-04: No real-money reward requirement

**Decision:** use points with no monetary value for the demo. If a token contract is used, deploy it only to a local chain/testnet and label it as a test token.

**Reason:** a hackathon project should not require a personal cash pool. Real financial rewards would need a funded source, clear rules, fraud controls, and legal review.

### ADR-05: Pluggable market policy

Define an interface such as:

```ts
export interface MarketPolicy {
  readonly policyId: string;
  findMatches(input: MatchInput): MatchCandidate[];
  calculatePrice(candidate: MatchCandidate): PriceResult;
  validateTrade(input: ProposedTrade): ValidationResult;
}
```

The first implementation can use simple bilateral matching. A pool market or double auction can be added later without rewriting the entire platform.

---

## 10. Trading Model and Lifecycle

### 10.1 Example

Assume a demo prosumer has 8 kWh of surplus solar energy and offers it at a minimum price of ₹4.00/kWh. A consumer requests 5 kWh and is willing to pay up to ₹6.00/kWh. If delivery windows and locality rules match, the midpoint policy gives:

- Matched energy: `min(8, 5) = 5 kWh`
- Illustrative unit price: `(₹4.00 + ₹6.00) / 2 = ₹5.00/kWh`
- Illustrative trade amount: `5 × ₹5.00 = ₹25.00`

These rupee values are **simulation values only**. No payment occurs in the MVP. If local rules do not allow this matching/pricing method, replace it with the market operator's approved rule.

### 10.2 Lifecycle states

```mermaid
stateDiagram-v2
    [*] --> OPEN: Offer / request published
    OPEN --> MATCHED: Compatible quantities found
    MATCHED --> COMMITTED: Trade commitment recorded
    COMMITTED --> EVIDENCE_SUBMITTED: Delivery evidence submitted
    EVIDENCE_SUBMITTED --> EVIDENCE_APPROVED: Verifier approves
    EVIDENCE_SUBMITTED --> DISPUTED: Evidence rejected / mismatch
    EVIDENCE_APPROVED --> SETTLED: Settlement recorded
    DISPUTED --> EVIDENCE_SUBMITTED: Corrected evidence
    MATCHED --> CANCELLED: Cancel before commitment if permitted
    OPEN --> EXPIRED: Window ends
    SETTLED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
```

Suggested database states may be more detailed than on-chain states. Define a mapping and never let the UI infer settlement merely because a transaction was submitted.

### 10.3 Matching policy for MVP

A candidate offer `o` and request `r` are compatible if:

1. `o.status` and `r.status` are open or partially filled.
2. `o.remaining_kwh > 0` and `r.remaining_kwh > 0`.
3. Delivery windows overlap according to the chosen rule.
4. If same-microgrid-only is enabled, both use the same approved microgrid ID.
5. `r.max_price_per_kwh >= o.min_price_per_kwh`.

Then:

```text
matched_kwh = min(offer_remaining_kwh, request_remaining_kwh)
unit_price = (offer_min_price + request_max_price) / 2
trade_amount = matched_kwh * unit_price
```

Use integer base units or a decimal library for monetary arithmetic; never rely on JavaScript floating-point values for final settlement. If the UI displays rupees, define the precision explicitly (for example, paise for INR display calculations) and keep the database and contract representations consistent.

### 10.4 Concurrency rule

Quantity allocation must be atomic. Within a database transaction:

1. Lock or conditionally update the offer and request rows.
2. Re-check their remaining quantities and status.
3. Create the trade record.
4. Reserve the quantities.
5. Commit the database transaction.
6. Submit the on-chain commitment through a durable transaction job.
7. Reconcile the chain receipt and update confirmation state.

Do not keep a database transaction open while waiting for a blockchain confirmation. Use a pending/outbox job and reconciliation process.

---

## 11. Database Schema (PostgreSQL)

The schema below is a starting point. Add migrations, foreign keys, unique constraints, and indexes as part of implementation.

### 11.1 Entity relationship diagram

```mermaid
erDiagram
    USERS ||--o{ ENERGY_READINGS : records
    USERS ||--o{ ENERGY_OFFERS : publishes
    USERS ||--o{ ENERGY_REQUESTS : creates
    USERS ||--o{ TRADES_AS_SELLER : sells
    USERS ||--o{ TRADES_AS_BUYER : buys
    ENERGY_OFFERS ||--o{ TRADES : allocates
    ENERGY_REQUESTS ||--o{ TRADES : fulfills
    TRADES ||--o{ DELIVERY_EVIDENCE : has
    TRADES ||--o{ BLOCKCHAIN_TRANSACTIONS : references
    TRADES ||--o| REWARD_LEDGER : earns
    USERS ||--o{ AUDIT_LOGS : performs
```

### 11.2 SQL schema

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE participant_role AS ENUM
  ('PROSUMER', 'CONSUMER', 'BOTH', 'VERIFIER', 'ADMIN');

CREATE TYPE listing_status AS ENUM
  ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED');

CREATE TYPE trade_status AS ENUM
  ('MATCHED', 'COMMIT_PENDING', 'COMMITTED',
   'EVIDENCE_SUBMITTED', 'EVIDENCE_APPROVED',
   'DISPUTED', 'SETTLED', 'CANCELLED', 'FAILED');

CREATE TYPE evidence_status AS ENUM
  ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  role participant_role NOT NULL DEFAULT 'BOTH',
  microgrid_id VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE TABLE energy_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES users(id),
  external_reading_id VARCHAR(160),
  reading_type VARCHAR(20) NOT NULL
    CHECK (reading_type IN ('GENERATION', 'CONSUMPTION', 'EXPORT', 'IMPORT')),
  source_type VARCHAR(30) NOT NULL
    CHECK (source_type IN ('SIMULATED', 'MANUAL', 'METER_SIGNED', 'API')),
  energy_kwh NUMERIC(14, 4) NOT NULL CHECK (energy_kwh >= 0),
  interval_start TIMESTAMPTZ NOT NULL,
  interval_end TIMESTAMPTZ NOT NULL,
  evidence_hash CHAR(66),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (interval_end > interval_start),
  UNIQUE (participant_id, external_reading_id)
);

CREATE TABLE energy_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  microgrid_id VARCHAR(100),
  total_kwh NUMERIC(14, 4) NOT NULL CHECK (total_kwh > 0),
  reserved_kwh NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (reserved_kwh >= 0),
  min_price_per_kwh NUMERIC(14, 4) NOT NULL CHECK (min_price_per_kwh > 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  renewable_source VARCHAR(40) NOT NULL DEFAULT 'SOLAR',
  delivery_start TIMESTAMPTZ NOT NULL,
  delivery_end TIMESTAMPTZ NOT NULL,
  status listing_status NOT NULL DEFAULT 'OPEN',
  policy_version VARCHAR(40) NOT NULL DEFAULT 'bilateral-midpoint-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reserved_kwh <= total_kwh),
  CHECK (delivery_end > delivery_start)
);

CREATE TABLE energy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id),
  microgrid_id VARCHAR(100),
  total_kwh NUMERIC(14, 4) NOT NULL CHECK (total_kwh > 0),
  reserved_kwh NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (reserved_kwh >= 0),
  max_price_per_kwh NUMERIC(14, 4) NOT NULL CHECK (max_price_per_kwh > 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  delivery_start TIMESTAMPTZ NOT NULL,
  delivery_end TIMESTAMPTZ NOT NULL,
  status listing_status NOT NULL DEFAULT 'OPEN',
  policy_version VARCHAR(40) NOT NULL DEFAULT 'bilateral-midpoint-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reserved_kwh <= total_kwh),
  CHECK (delivery_end > delivery_start)
);

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES energy_offers(id),
  request_id UUID NOT NULL REFERENCES energy_requests(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  committed_kwh NUMERIC(14, 4) NOT NULL CHECK (committed_kwh > 0),
  delivered_kwh NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (delivered_kwh >= 0),
  unit_price NUMERIC(14, 4) NOT NULL CHECK (unit_price > 0),
  total_amount NUMERIC(18, 4) NOT NULL CHECK (total_amount >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  status trade_status NOT NULL DEFAULT 'MATCHED',
  policy_version VARCHAR(40) NOT NULL,
  contract_address VARCHAR(42),
  onchain_trade_id VARCHAR(100),
  commit_tx_hash VARCHAR(66),
  settlement_tx_hash VARCHAR(66),
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  idempotency_key VARCHAR(160) UNIQUE,
  CHECK (delivered_kwh <= committed_kwh)
);

CREATE INDEX idx_offers_status_window
  ON energy_offers(status, delivery_start, delivery_end);
CREATE INDEX idx_requests_status_window
  ON energy_requests(status, delivery_start, delivery_end);
CREATE INDEX idx_trades_seller ON trades(seller_id, matched_at DESC);
CREATE INDEX idx_trades_buyer ON trades(buyer_id, matched_at DESC);
CREATE INDEX idx_trades_status ON trades(status);

CREATE TABLE delivery_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  submitted_by UUID NOT NULL REFERENCES users(id),
  source_type VARCHAR(30) NOT NULL
    CHECK (source_type IN ('SIMULATED', 'MANUAL', 'METER_SIGNED', 'API')),
  delivered_kwh NUMERIC(14, 4) NOT NULL CHECK (delivered_kwh >= 0),
  interval_start TIMESTAMPTZ NOT NULL,
  interval_end TIMESTAMPTZ NOT NULL,
  evidence_uri TEXT,
  evidence_hash CHAR(66) NOT NULL,
  status evidence_status NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES users(id),
  review_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CHECK (interval_end > interval_start)
);

CREATE TABLE blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES trades(id),
  operation VARCHAR(40) NOT NULL,
  chain_id BIGINT NOT NULL,
  tx_hash VARCHAR(66) UNIQUE,
  nonce BIGINT,
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('QUEUED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'REPLACED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL UNIQUE REFERENCES trades(id),
  participant_id UUID NOT NULL REFERENCES users(id),
  verified_renewable_kwh NUMERIC(14, 4) NOT NULL CHECK (verified_renewable_kwh >= 0),
  points_awarded BIGINT NOT NULL CHECK (points_awarded >= 0),
  rule_version VARCHAR(40) NOT NULL,
  issuance_tx_hash VARCHAR(66),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  request_id VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
```

### 11.3 Database implementation notes

- Use a database migration tool; do not edit production schemas manually.
- `NUMERIC` avoids binary floating-point errors in quantity and price storage.
- The `UNIQUE` reward `trade_id` constraint prevents duplicate reward ledger entries.
- Validate wallet addresses with a trusted Ethereum library as well as basic format checks.
- The example schema uses a single currency code for demonstration. A production market must define currency, tariff, tax, fee, rounding, and settlement conventions explicitly.
- Add a database-level uniqueness rule for external reading IDs only if the upstream source supplies stable IDs; PostgreSQL allows multiple null values in this unique constraint.
- Add explicit indexes based on actual query patterns and test query plans before scaling.
- Consider row-level locking or conditional updates for reservations. `CHECK` constraints alone do not prevent two concurrent transactions from reserving the same remaining quantity.

---

## 12. REST API Specification

Base path: `/api/v1`

Authentication approach for MVP:
- Use a wallet-signature challenge to prove wallet ownership.
- The server issues a short-lived session or signed token after signature verification.
- Enforce authorization on every write request.
- Never accept a wallet address in a request body as proof that the caller controls it.

### 12.1 Endpoint summary

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/challenge` | Create a one-time wallet-signature challenge |
| `POST` | `/auth/verify` | Verify signed challenge and create session |
| `GET` | `/me` | Get current participant profile |
| `GET` | `/readings` | List current user's readings |
| `POST` | `/readings` | Submit simulated/meter reading |
| `GET` | `/offers` | Search open sell offers |
| `POST` | `/offers` | Create sell offer |
| `POST` | `/offers/:id/cancel` | Cancel eligible offer |
| `GET` | `/requests` | Search open buy requests |
| `POST` | `/requests` | Create buy request |
| `POST` | `/requests/:id/cancel` | Cancel eligible request |
| `POST` | `/market/match` | Request matching for eligible listings |
| `GET` | `/trades` | List trades for current user |
| `GET` | `/trades/:id` | Get trade details and history |
| `POST` | `/trades/:id/evidence` | Submit delivery evidence |
| `POST` | `/trades/:id/evidence/review` | Verifier approves/rejects evidence |
| `POST` | `/trades/:id/settle` | Request settlement after validation |
| `GET` | `/rewards` | Get current user's reward ledger |
| `GET` | `/audit/:entityType/:entityId` | Get authorized audit history |
| `GET` | `/health` | Health check |

### 12.2 Example request: create an offer

```http
POST /api/v1/offers
Authorization: Bearer <session-token>
Idempotency-Key: offer-create-unique-key
Content-Type: application/json
```

```json
{
  "microgridId": "campus-microgrid-a",
  "totalKwh": "8.0000",
  "minPricePerKwh": "4.0000",
  "currencyCode": "INR",
  "renewableSource": "SOLAR",
  "deliveryStart": "2026-11-01T10:00:00+05:30",
  "deliveryEnd": "2026-11-01T11:00:00+05:30",
  "sourceReadingId": "reading-demo-001"
}
```

Response:

```json
{
  "id": "server-generated-uuid",
  "status": "OPEN",
  "remainingKwh": "8.0000",
  "policyVersion": "bilateral-midpoint-v1",
  "createdAt": "2026-10-22T12:00:00Z"
}
```

The IDs and timestamps above are examples, not real records. Store numeric values as decimal strings in JSON to avoid client-side floating-point surprises.

### 12.3 Example request: create a buy request

```json
{
  "microgridId": "campus-microgrid-a",
  "totalKwh": "5.0000",
  "maxPricePerKwh": "6.0000",
  "currencyCode": "INR",
  "deliveryStart": "2026-11-01T10:00:00+05:30",
  "deliveryEnd": "2026-11-01T11:00:00+05:30"
}
```

### 12.4 Example trade response

```json
{
  "id": "trade-uuid",
  "status": "COMMITTED",
  "seller": "0x...",
  "buyer": "0x...",
  "committedKwh": "5.0000",
  "unitPrice": "5.0000",
  "totalAmount": "25.0000",
  "currencyCode": "INR",
  "policyVersion": "bilateral-midpoint-v1",
  "commitTxHash": "0x...",
  "evidenceStatus": "PENDING",
  "settlementTxHash": null
}
```

### 12.5 API error format

```json
{
  "error": {
    "code": "INSUFFICIENT_REMAINING_QUANTITY",
    "message": "The offer no longer has enough available energy.",
    "requestId": "req_...",
    "details": {}
  }
}
```

Recommended status codes: `400` invalid input, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflicting state or idempotency conflict, `422` business-rule failure, `429` rate limited, `500` unexpected server error, and `503` dependent service unavailable.

---

## 13. Smart Contract Design

### 13.1 Contract responsibilities

The on-chain contract should be intentionally small. It can:

- Record a trade commitment with buyer, seller, quantity, unit price, and evidence requirement.
- Restrict state transitions to authorized participants or verifier roles.
- Store an evidence hash or reference hash.
- Mark an eligible trade settled exactly once.
- Record reward issuance exactly once if rewards are implemented on-chain.
- Emit events for backend indexing and UI audit trails.
- Support an emergency pause for risky write operations.

It should **not** store personal data, raw meter files, or every listing field. On-chain data is public on public networks and can be costly to change.

### 13.2 Suggested contract split

For the MVP, use one contract to reduce integration effort:

- `EnergyTrading.sol`: trade commitments, evidence hash, approval, settlement, and events.

Optional later contracts:
- `RenewableRewards.sol`: test-token or points issuance.
- `MarketRegistry.sol`: versioned market-policy parameters.
- `CertificateRegistry.sol`: renewable certificate hashes and revocation references.

Do not deploy separate contracts merely for architectural appearance; split them only when it improves permission boundaries or future upgrades.

### 13.3 Illustrative Solidity contract

The following is a **starter example**, not an audited or production-ready contract. Compile and test it with the Solidity version supported by your chosen Hardhat/Foundry setup. Before production, review authorization, cancellation rules, unit/decimal conventions, chain reorganization handling, contract upgrade strategy, and security implications.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract EnergyTrading {
    enum Status {
        None,
        Committed,
        EvidenceSubmitted,
        EvidenceApproved,
        Settled,
        Disputed,
        Cancelled
    }

    struct Trade {
        address seller;
        address buyer;
        uint128 energyWh;       // integer watt-hours; 1 kWh = 1000 Wh
        uint128 pricePerKWh;    // scaled integer, defined by application policy
        bytes32 evidenceHash;
        Status status;
        uint64 createdAt;
        uint64 settledAt;
    }

    address public owner;
    address public verifier;
    bool public paused;
    uint256 public nextTradeId = 1;

    mapping(uint256 => Trade) public trades;
    mapping(uint256 => bool) public rewardIssued;

    event TradeCommitted(
        uint256 indexed tradeId,
        address indexed seller,
        address indexed buyer,
        uint128 energyWh,
        uint128 pricePerKWh
    );
    event EvidenceSubmitted(uint256 indexed tradeId, bytes32 evidenceHash);
    event EvidenceReviewed(uint256 indexed tradeId, bool approved);
    event TradeSettled(uint256 indexed tradeId, uint128 deliveredWh, uint64 settledAt);
    event RewardMarkedIssued(uint256 indexed tradeId, address indexed recipient, uint256 points);
    event PauseChanged(bool paused);
    event VerifierChanged(address indexed oldVerifier, address indexed newVerifier);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier || msg.sender == owner, "NOT_VERIFIER");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "PAUSED");
        _;
    }

    constructor(address verifierAddress) {
        require(verifierAddress != address(0), "INVALID_VERIFIER");
        owner = msg.sender;
        verifier = verifierAddress;
    }

    function commitTrade(
        address seller,
        address buyer,
        uint128 energyWh,
        uint128 pricePerKWh
    ) external whenNotPaused returns (uint256 tradeId) {
        require(seller != address(0) && buyer != address(0), "ZERO_ADDRESS");
        require(seller != buyer, "SAME_PARTICIPANT");
        require(energyWh > 0, "ZERO_ENERGY");
        require(pricePerKWh > 0, "ZERO_PRICE");

        tradeId = nextTradeId++;
        trades[tradeId] = Trade({
            seller: seller,
            buyer: buyer,
            energyWh: energyWh,
            pricePerKWh: pricePerKWh,
            evidenceHash: bytes32(0),
            status: Status.Committed,
            createdAt: uint64(block.timestamp),
            settledAt: 0
        });

        emit TradeCommitted(tradeId, seller, buyer, energyWh, pricePerKWh);
    }

    function submitEvidence(uint256 tradeId, bytes32 evidenceHash)
        external whenNotPaused
    {
        Trade storage t = trades[tradeId];
        require(t.status == Status.Committed || t.status == Status.Disputed,
            "INVALID_STATUS");
        require(msg.sender == t.seller || msg.sender == verifier || msg.sender == owner,
            "NOT_AUTHORIZED");
        require(evidenceHash != bytes32(0), "EMPTY_EVIDENCE_HASH");

        t.evidenceHash = evidenceHash;
        t.status = Status.EvidenceSubmitted;
        emit EvidenceSubmitted(tradeId, evidenceHash);
    }

    function reviewEvidence(uint256 tradeId, bool approved)
        external onlyVerifier whenNotPaused
    {
        Trade storage t = trades[tradeId];
        require(t.status == Status.EvidenceSubmitted, "INVALID_STATUS");

        if (approved) {
            t.status = Status.EvidenceApproved;
        } else {
            t.status = Status.Disputed;
        }

        emit EvidenceReviewed(tradeId, approved);
    }

    function settleTrade(uint256 tradeId, uint128 deliveredWh)
        external onlyVerifier whenNotPaused
    {
        Trade storage t = trades[tradeId];
        require(t.status == Status.EvidenceApproved, "EVIDENCE_NOT_APPROVED");
        require(deliveredWh > 0, "ZERO_DELIVERY");
        require(deliveredWh <= t.energyWh, "DELIVERY_EXCEEDS_COMMITMENT");

        t.status = Status.Settled;
        t.settledAt = uint64(block.timestamp);
        emit TradeSettled(tradeId, deliveredWh, t.settledAt);
    }

    // Demonstration guardrail only: points are events, not a redeemable token.
    function markRewardIssued(
        uint256 tradeId,
        address recipient,
        uint256 points
    ) external onlyVerifier whenNotPaused {
        Trade storage t = trades[tradeId];
        require(t.status == Status.Settled, "TRADE_NOT_SETTLED");
        require(!rewardIssued[tradeId], "REWARD_ALREADY_ISSUED");
        require(recipient == t.seller, "RECIPIENT_MUST_BE_SELLER");
        require(points > 0, "ZERO_POINTS");

        rewardIssued[tradeId] = true;
        emit RewardMarkedIssued(tradeId, recipient, points);
    }

    function setVerifier(address newVerifier) external onlyOwner {
        require(newVerifier != address(0), "INVALID_VERIFIER");
        address oldVerifier = verifier;
        verifier = newVerifier;
        emit VerifierChanged(oldVerifier, newVerifier);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseChanged(value);
    }
}
```

### 13.4 Contract example limitations to resolve

This code is deliberately minimal. Before integrating it, make and test explicit decisions:

1. **Trusted submitter:** as written, anyone can call `commitTrade` with arbitrary participant addresses. In a real deployment, restrict commitment creation to an authorized backend/market operator or require buyer and seller signatures.
2. **Settlement amount:** the example records delivered Wh but does not move funds or calculate a payment. That is intentional for a no-budget prototype.
3. **Reward destination:** the example awards demo points to the seller only. Decide whether both seller and buyer should receive points and make the policy explicit.
4. **Units and price scaling:** `pricePerKWh` is an integer. Document its scale, currency, and rounding rule. Use consistent units in frontend, backend, and contract.
5. **Evidence truth:** a hash only shows whether evidence content changed. It does not prove a meter reading is authentic. A trusted verifier or cryptographically signed meter data is still needed.
6. **Access control:** `owner` is a single privileged account in the example. Production should consider multisig administration, role separation, and least privilege.
7. **Cancellation and disputes:** cancellation, timeout, partial-delivery policy, appeal workflow, and verifier conflicts need additional rules.
8. **Reward event vs token:** `RewardMarkedIssued` is not an ERC-20 token and has no cash value. It records a demo reward event only.
9. **Reentrancy:** no external calls or transfers are made in this sample, but any future payment/token-transfer functions require a fresh security review.
10. **Testing/audit:** this example has not been audited. Do not deploy it with real funds or present it as production secure.

### 13.5 If you want an actual test token

A separate ERC-20 test token can make a demo more visual, but it is not necessary for the core platform. If added:
- deploy only to a local chain or testnet;
- label it `TEST` or `DEMO`;
- do not market it as a carbon credit, investment, or redeemable reward;
- enforce one-time reward eligibility in the rewards contract;
- use a reviewed standard implementation rather than writing token mechanics from scratch;
- never require the team to fund users with real money.

---

## 14. Blockchain Integration Design

### 14.1 Transaction write path

1. Backend validates the business request and writes a durable transaction-job record.
2. A worker loads the job and constructs the contract call.
3. The transaction is submitted using the configured signer.
4. The worker records the transaction hash and submission status.
5. The receipt is checked; the job becomes confirmed or failed.
6. The event listener indexes the emitted event.
7. A reconciliation job compares on-chain state with the database and repairs pending status where possible.
8. The UI displays `PENDING`, `CONFIRMED`, or `FAILED`; it does not treat a submitted hash as final settlement.

### 14.2 Signer model

- **Preferred MVP:** use the user's wallet to sign user-originated actions where practical; use a dedicated local/testnet operator account for verifier/admin actions.
- Never commit private keys or `.env` files to source control.
- For backend signing, use a dedicated test key with minimal funds and limited permissions.
- For production, use a managed signer/HSM or multisig process and a proper operational security review.

### 14.3 Retry and reconciliation

- Use a transaction outbox table or job queue so application state is not lost if the server restarts.
- Make operations idempotent using trade IDs and contract state checks.
- Retry only when safe; do not blindly resend a non-idempotent transaction.
- Track chain ID, contract address, nonce, transaction hash, receipt status, and failure reason.
- Consider confirmations/finality and chain reorganizations for the chosen network.
- If the transaction fails after the database has reserved energy, release or reconcile the reservation according to an explicit recovery policy.

### 14.4 Event indexing

Listen for:
- `TradeCommitted`
- `EvidenceSubmitted`
- `EvidenceReviewed`
- `TradeSettled`
- `RewardMarkedIssued`

Persist event data with chain ID, block number, transaction hash, log index, and contract address. A unique constraint on `(chain_id, tx_hash, log_index)` prevents duplicate event ingestion.

---

## 15. Renewable Evidence and Incentive Model

### 15.1 Evidence levels

| Level | Source | What the platform can claim |
|---|---|---|
| Level 0 | Demo-generated values | A simulated end-to-end workflow only |
| Level 1 | User-entered readings with review | User-submitted data was reviewed; independent truth is not guaranteed |
| Level 2 | Meter API or signed device payload | The payload came through a specified integration; source security must be assessed |
| Level 3 | Approved meter/registry/operator evidence | Stronger evidence, depending on issuer, validation, and applicable standards |

For the hackathon, start at Level 0 and label it honestly. A simulated meter is enough to demonstrate the architecture, state machine, matching, and contract interactions.

### 15.2 Sample reward formula

For a configurable rate of `10 points per verified renewable kWh`:

```text
eligible_kwh = min(approved_delivered_kwh, committed_kwh)
points = floor(eligible_kwh * points_per_kwh)
```

Example: 5.0 kWh eligible delivery × 10 points/kWh = 50 demo points.

Apply rewards only after settlement and only once per trade. Store the rule version and inputs used to calculate the award. In a later version, include source-specific multipliers only if the policy is transparent and justified.

### 15.3 Funding and incentive sustainability

A reward does not need to be money. The hackathon MVP can use:
- points, badges, leaderboard entries, or achievement levels;
- a non-transferable local/testnet demo token;
- sponsor-funded vouchers only if a sponsor actually commits funding;
- a future utility/community-funded incentive pool, clearly marked as a proposal.

Do not promise that rewards will be redeemed for cash, electricity bill credits, or carbon credits unless there is a real, funded, legally valid arrangement.

---

## 16. Security and Privacy Requirements

### 16.1 Application security

- Validate and normalize all user input on the backend.
- Enforce role and ownership checks on every read/write endpoint.
- Use wallet-signature challenges with a nonce, expiration, and one-time-use protection.
- Apply rate limits to authentication, listing creation, matching, and evidence upload.
- Use parameterized SQL or a safe ORM.
- Use strict CORS rules, secure cookie/session settings where applicable, and TLS in deployed environments.
- Keep secrets in environment configuration or a secret manager.
- Sanitize file uploads; restrict type and size; scan files where practical.
- Avoid returning stack traces, private configuration, or raw internal errors to clients.

### 16.2 Smart-contract security

- Test access-control boundaries and invalid state transitions.
- Test that duplicate settlement and reward issuance fail.
- Use integer arithmetic and explicit unit scaling.
- Keep public functions small and document privileged operations.
- Use a pause mechanism only with clearly defined governance.
- Pin compiler and dependency versions.
- Run static analysis (for example, Slither) if available.
- Do not rely on frontend checks for contract security.
- Do not deploy with real value without an independent review/audit.

### 16.3 Privacy

- Do not put personally identifiable information, home addresses, raw meter readings, or private files on a public blockchain.
- Store hashes/references on-chain only when their privacy implications are understood.
- Remember that hashes of low-entropy or predictable data can sometimes be guessed.
- Use coarse locality or a microgrid ID instead of exposing a household's exact location.
- Define retention and deletion rules for off-chain personal data.
- Make demo data synthetic and avoid uploading real household consumption records.

### 16.4 Threat model

| Threat | Example | Mitigation in MVP |
|---|---|---|
| Fake readings | User submits fabricated generation | Mark source type; verifier gate; no claim of independent verification |
| Double allocation | Same 5 kWh offered to two buyers | Atomic reservation and concurrency tests |
| Duplicate reward | Retry issues points twice | Unique DB constraint and contract one-time flag |
| Unauthorized settlement | User settles another trade | Contract role checks and backend authorization |
| Wallet spoofing | Request claims another wallet address | Signed nonce challenge |
| Replay | Old signature reused | One-time nonce and expiry |
| API abuse | Repeated match requests | Rate limiting, idempotency keys |
| Contract admin compromise | Attacker changes verifier | Restricted admin, multisig for production, event alerts |
| RPC outage | Chain calls fail | Queue jobs, retry safely, show pending state |
| Privacy leakage | Meter details published on-chain | Off-chain storage and minimal on-chain commitments |
| Incorrect matching | Price/window rules applied inconsistently | Versioned policy, deterministic tests, explainable match result |

---

## 17. Testing Plan

### 17.1 Unit tests

- Offer/request input validation.
- Matching with overlapping and non-overlapping time windows.
- Price compatibility and calculation.
- Partial fill and remaining quantity.
- Reward formula and rounding.
- Evidence hash generation and validation.
- Wallet challenge expiry and replay prevention.
- State transition validation.

### 17.2 Integration tests

- API creates an offer and persists it.
- Matching reserves the correct quantity.
- Trade creation generates a blockchain job.
- Successful local-chain transaction updates status.
- Failed transaction remains visible and can be reconciled.
- Evidence approval permits settlement.
- Evidence rejection prevents settlement.
- Repeated settlement request does not settle twice.
- Repeated reward request does not award twice.
- Unauthorized participant cannot modify another participant's offer/trade.

### 17.3 Smart-contract tests

| Test | Expected result |
|---|---|
| Commit valid trade | Trade stored and `TradeCommitted` emitted |
| Zero-energy trade | Revert |
| Seller equals buyer | Revert |
| Submit empty evidence hash | Revert |
| Unauthorized evidence review | Revert |
| Settle before evidence approval | Revert |
| Settle with zero delivery | Revert |
| Settle more than committed quantity | Revert |
| Settle same trade twice | Revert due to status |
| Issue reward before settlement | Revert |
| Issue reward twice | Revert |
| Non-owner changes verifier or pause | Revert |

### 17.4 End-to-end demo test

1. Connect wallet A as prosumer.
2. Create a simulated generation reading.
3. Publish 8 kWh at minimum price ₹4/kWh.
4. Connect wallet B as consumer.
5. Create a 5 kWh request at maximum price ₹6/kWh.
6. Run matching; verify 5 kWh match and illustrative ₹5/kWh price.
7. Confirm the trade commitment transaction on the local chain/testnet.
8. Submit 5 kWh of clearly labeled simulated delivery evidence.
9. Approve evidence with the verifier account.
10. Settle the trade and confirm the event.
11. Issue 50 points under the sample 10 points/kWh policy.
12. Retry reward issuance and verify it fails.
13. Open trade history and inspect transaction hashes and state changes.

### 17.5 Definition of done

A feature is done when its validation rules, authorization, error handling, tests, database migration (if needed), and UI state are implemented. A successful demo click-through alone is not enough.

---

## 18. UI Screens / Frontend Requirements

### 18.1 Required screens

1. **Landing / connect wallet:** project explanation, simulation disclaimer, connect wallet.
2. **Dashboard:** generation, open offers, open requests, active trades, demo reward points.
3. **Market:** searchable offer/request cards with quantity, price, time window, microgrid.
4. **Create listing:** offer/request form with validation and preview.
5. **Trade detail:** participants, quantity, price rule, status timeline, evidence status, chain transaction links.
6. **Evidence review:** simulated/verified source label, quantity, hash, approve/reject action for verifier.
7. **Rewards:** point history, rule version, no-cash-value disclosure.
8. **Audit / transaction view:** contract address, chain ID, transaction hash, status, event timeline.
9. **Admin settings:** policy version, reward rate, verifier address, pause status; restrict to admin role.

### 18.2 UI state rules

- Never display “Settled” while the chain transaction is merely submitted.
- Clearly distinguish simulated meter data from verified external readings.
- Show why an offer/request was not matched where practical (price mismatch, no time overlap, locality mismatch, no remaining quantity).
- Display amounts as illustrative unless real settlement exists.
- Make pending, confirmed, failed, rejected, and disputed states visually distinct.

---

## 19. Suggested Repository Structure

```text
bright-ledger/
├── frontend/                   # React + TypeScript + Vite application
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/                    # Express API and PostgreSQL application
│   ├── src/
│   ├── migrations/
│   ├── test/
│   └── package.json
├── blockchain/                 # Solidity contracts and Hardhat tooling
│   ├── contracts/
│   ├── scripts/
│   ├── test/
│   └── package.json
├── docker-compose.yml          # Local PostgreSQL service
├── .env.example
└── package.json                # npm workspaces and root-level commands
```

### 19.1 Environment variables

Example `.env.example` (use placeholders only):

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/greengrid
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
ENERGY_TRADING_CONTRACT_ADDRESS=
VERIFIER_WALLET_ADDRESS=
SESSION_SECRET=replace-with-long-random-development-secret
SIMULATION_MODE=true
REWARD_POINTS_PER_KWH=10
```

Never commit a populated `.env` file or a private key. Keep the development secret local, and rotate any secret that has been exposed.

---

## 20. Deployment and Operations

### Local development

1. Install Node.js, package manager, PostgreSQL, and Hardhat/Foundry.
2. Start a local EVM chain.
3. Deploy the contract to the local chain.
4. Run database migrations and seed synthetic demo participants/readings.
5. Start the backend API and transaction worker.
6. Start the frontend.
7. Connect a development wallet configured for the local chain.
8. Run the end-to-end scenario from Section 17.4.

### Demo/testnet deployment

1. Select a supported EVM testnet and verify current RPC, faucet, and explorer details.
2. Deploy with a dedicated test account and no production secrets.
3. Configure the backend chain ID and contract address.
4. Test one full transaction path before the presentation.
5. Keep a local-chain fallback in case the testnet or faucet is unavailable.
6. Clearly label testnet tokens and demo points as having no real monetary value.

### Operational checks

- `/health` reports API and database connectivity.
- A separate diagnostic reports blockchain RPC connectivity and configured chain ID.
- Failed transactions are visible in logs and admin UI.
- Database backups and restore steps are documented, even if only for the demo.
- Demo accounts, seed data, and reset instructions are documented.

---

## 21. Team Plan for a Three-Person Hackathon Team

### Role split

| Team member | Primary ownership | Secondary support |
|---|---|---|
| Member A | Frontend, wallet connection, dashboard, listing forms | E2E demo |
| Member B | Backend API, PostgreSQL schema, matching, evidence workflow | API tests |
| Member C | Solidity contract, deployment scripts, chain integration | Contract tests and security review |

All members should agree on API shapes, trade states, units, and matching policy before coding. Use a shared `.env.example`, seeded demo data, and a short daily integration test.

### Suggested implementation sequence

**Phase 1 — Foundation**
- Finalize use cases and state machine.
- Agree units and price precision.
- Create repository, database schema, and contract interface.
- Seed demo participants and sample readings.

**Phase 2 — Core marketplace**
- Build offer/request endpoints and UI.
- Implement matching, price calculation, quantity reservation, and tests.
- Make the core workflow work without blockchain first.

**Phase 3 — Blockchain**
- Implement and test trade contract.
- Deploy locally.
- Add transaction worker, event indexing, and trade transaction view.

**Phase 4 — Evidence and rewards**
- Add simulated evidence submission and verifier review.
- Add settlement preconditions.
- Add one-time points ledger or contract event.

**Phase 5 — Demo hardening**
- Run E2E tests.
- Test failure and retry paths.
- Add disclaimers and audit trail.
- Prepare architecture diagram, short demo script, and fallback.

If the event is very short, prioritize one complete vertical slice over many unfinished features.

---

## 22. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Physical meter integration takes too long | No end-to-end demo | Use synthetic readings; label them clearly |
| Testnet unavailable or faucet empty | Blockchain demo blocked | Keep local-chain demo ready |
| Overly ambitious microservices | Integration delay | Build a modular monolith first |
| Smart contract bug | Incorrect or stuck trade state | Small contract, unit tests, no real funds |
| False renewable claim | Misleading climate impact | Show evidence level and source; do not equate demo points with carbon credits |
| No budget for rewards | Reward feature seems unworkable | Use non-cash points/badges |
| Duplicate matching under concurrency | Oversold energy | Atomic DB reservation and idempotency |
| Unclear market legality | Cannot launch as real service | Position as a prototype; require jurisdiction-specific legal/utility review |
| Privacy leak | Household data exposed | Minimize on-chain data and use synthetic demo records |

---

## 23. Climate Impact Measurement

Do not claim carbon reductions merely because a trade is recorded. The MVP can report **activity metrics**:
- kWh of renewable energy offered;
- kWh matched;
- kWh with approved delivery evidence;
- share of matched energy marked renewable;
- number of participating demo wallets;
- number of completed demo trades.

A future impact calculation would require a defensible baseline and an appropriate, location-specific emissions factor. The result should state the source, period, assumptions, and uncertainty. Avoid double-counting energy or presenting token points as verified emissions reductions.

---

## 24. Future Enhancements

- Signed meter readings and real meter/API adapters.
- Renewable certificate registry integration with issuer, validity, and revocation checks.
- Pool market, double auction, or localized pricing modules.
- Grid constraints, distribution charges, losses, and network capacity rules.
- Dispute resolution, partial delivery, and cancellation policy.
- Privacy-preserving proofs or permissioned-chain deployment where justified.
- Role-based multi-signature administration.
- Payment integration only after regulatory, security, and operational review.
- Market-policy plug-ins for different microgrids and jurisdictions.
- Performance/load testing with published methodology and reproducible results.

---

## 25. Presentation / Judging Narrative

### One-minute explanation

“GreenGrid P2P is a prototype for local renewable-energy trading. A prosumer can publish surplus solar energy and a consumer can request energy. The market engine checks quantity, time window, locality, and price compatibility, then creates a trade. A blockchain contract records the trade commitment and auditable state changes. Delivery evidence is submitted and reviewed before settlement, and eligible renewable trades can earn demo incentive points. We use simulated meter data and no-money rewards so the demo is affordable, while the architecture leaves clear extension points for real meters, local market rules, and verified renewable certificates.”

### What to show judges

1. The architecture and why data is split between database and blockchain.
2. A seller creates an offer and a buyer creates a request.
3. Matching output explains quantity and price calculation.
4. A transaction hash proves the commitment was submitted to the selected chain.
5. Evidence is clearly marked simulated and requires approval.
6. Settlement and one-time points issuance are shown.
7. An invalid duplicate reward or premature settlement is rejected.
8. Limitations and future work are explained honestly.

### Claims to avoid

- “We deliver electricity directly through blockchain.”
- “Every reading is automatically trustworthy.”
- “Our points are carbon credits.”
- “The system guarantees lower bills or a specific carbon reduction.”
- “The smart contract is audited or production-ready” unless this has actually happened.
- “We are fully decentralized” when a backend and trusted verifier control key steps.

---

## 26. Reference

Fan, C.; Khazaei, H.; Musilek, P. **BPET: A Unified Blockchain-Based Framework for Peer-to-Peer Energy Trading.** *Future Internet* 2024, 16, 162. Published 7 May 2024. DOI: <https://doi.org/10.3390/fi16050162>.

This blueprint uses the paper as its conceptual reference for modular blockchain-based P2P energy trading, microservice-oriented design, customizable market mechanisms, and smart-contract modularity. The proposed hackathon implementation details are explicitly identified as design recommendations rather than quoted specifications from the paper.

---

## 27. Final Build Checklist

- [ ] Confirm the MVP is a simulation and show that disclaimer in the UI.
- [ ] Finalize roles, units, pricing rule, and state transitions.
- [ ] Create PostgreSQL migrations and seed data.
- [ ] Build offers, requests, and matching with concurrency protection.
- [ ] Write and test the smart contract on a local chain.
- [ ] Implement transaction queue, receipt handling, and reconciliation.
- [ ] Add evidence submission and verifier review.
- [ ] Add idempotent settlement and demo points.
- [ ] Test unauthorized actions and duplicate operations.
- [ ] Run the full demo script from a clean environment.
- [ ] Prepare screenshots, architecture diagram, test results, and known limitations.
