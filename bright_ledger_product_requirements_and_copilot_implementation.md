# Bright Ledger — Decentralized Rooftop Solar & P2P Energy Trading
## Product requirements, architecture, transaction lifecycle, allocation rules, smart contracts, and Copilot implementation plan

**Document status:** Hackathon implementation specification  
**Product name:** Bright Ledger (working name)  
**Primary use case:** Connect rooftop/space owners, solar project funders, renewable-energy producers, and energy buyers through transparent project records, simulated funding, energy accounting, and settlement.  
**Important demo boundary:** The first release is a **testnet/demo simulation**, not a live electricity market, investment product, carbon-credit registry, or payment service. All simulated data and balances must be visibly labelled.

---

## 0. Executive summary

Bright Ledger helps unlock unused rooftop space for solar projects and makes the project lifecycle easier to understand and audit. The platform combines:

1. **Rooftop Registry** — list and review potential solar sites.
2. **Project Match** — estimate project size and match space owners with project funders.
3. **Community Funding Pool** — let several demo investors contribute test funds toward one project.
4. **Generation Proof** — ingest sample or simulated meter readings, flag anomalies, and record their provenance.
5. **P2P Trade Board** — match eligible simulated surplus-energy offers with buyer requests.
6. **Bright Ledger Record** — record project milestones, readings, allocations, and settlement references.
7. **Settlement Engine** — calculate the agreed distribution of simulated project revenue.
8. **Clean Impact Passport** — show generated kWh and an explicitly estimated emissions-impact metric.
9. **Incentive Points** — issue non-transferable demo points for eligible, verified events; points have no cash value.
10. **Audit & Dispute Center** — show the full event trail and support a review/freeze workflow.

### Product promise

**Make every rooftop project, energy unit, and settlement explainable.**

### Key design principle

Blockchain can make recorded data tamper-evident, but it cannot prove that an off-chain meter reading is true by itself. Use a trusted meter/API, signed reading, verifier, or a clearly labelled simulation. Never describe mock readings as real or verified physical generation.

---

## 1. Problem statement and product boundaries

### Problem

- Some property owners have suitable rooftop space but cannot fund a solar installation.
- Some funders can finance a project but do not have suitable space.
- Energy generation, project funding, energy allocation, and benefit distribution can be difficult to trace across different parties.
- Small energy communities need clear records of who contributed what, how much energy was generated, how it was allocated, and how settlement was calculated.

### Proposed solution

A marketplace and auditable workflow that connects site owners, project funders, producers, and buyers, with transparent project records and a rules-based allocation engine.

### What the hackathon MVP does

- Supports demo accounts and wallet connection.
- Lists rooftop sites and estimated solar potential.
- Creates projects with a budget and funding target.
- Accepts simulated contributions in a clearly labelled test currency.
- Simulates generation readings or imports a supplied CSV.
- Matches offers and requests in a demo market.
- Calculates project share and simulated settlement from configured rules.
- Writes important events to a local database and, optionally, a testnet smart contract.
- Displays impact estimates and an audit trail.

### What the MVP does NOT claim to do

- It does not physically deliver electricity from one home to another.
- It does not perform live, legally binding electricity sales or utility billing.
- It does not guarantee investor returns or property-owner income.
- It does not issue official renewable energy certificates or carbon credits.
- It does not make a demo token redeemable for cash.
- It does not validate real-world meter data unless an actual trusted integration and verification procedure is implemented.
- It does not replace the distribution utility, regulator, meter operator, or project contract.

---

## 2. Research and precedent: what to learn from existing systems

The idea has precedents; differentiation should be the **joined-up workflow** for rooftop discovery, pooled project funding, generation provenance, allocation, settlement, and impact reporting.

- **Powerledger** describes energy trading and traceability as related layers, including tracking origin, time, counterparties, and environmental commodities. Use this as a reference for combining market activity with traceable records: https://powerledger.io/offerings/
- **PowerXchange** describes an Indian P2P energy platform with seller/buyer workflows, meter integration, digital identity, settlement, and distribution-company integration: https://www.powerxchange.io/
- **PVVNL's P2P page** describes a pilot flow with registration, distribution-company verification, trading, meter verification, and bill settlement. It is a useful reference for showing that real-world settlement involves the utility and metering process: https://www.pvvnl.org/P2P-Energy-Trading
- **Delhi Electricity Regulatory Commission (DERC)** published P2P Energy Transaction Guidelines in 2024. Read the full guidelines and check the latest amendments before any Delhi deployment: https://derc.gov.in/sites/default/files/DERC%20Peer%20to%20Peer%20Energy%20Transaction%20Guidelines%202024%20-%2024.06.2024.pdf
- **Ethereum ERC-20 documentation** explains fungible tokens and common token methods. For this project, do not launch a speculative tradable token just to demonstrate incentives; simple database points or non-transferable testnet badges are safer for the MVP: https://ethereum.org/developers/docs/standards/tokens/erc-20/
- **Ethereum smart-contract security guidance** explains checks-effects-interactions and reentrancy prevention. Use established libraries and test settlement/refund paths: https://ethereum.org/developers/docs/smart-contracts/security
- **Energy Web** describes verification workflows for energy and environmental claims. It reinforces the distinction between making a claim and producing a verifiable proof: https://energyweb.org/protocol/

These sources are references, not endorsements or proof that Bright Ledger will be legally compliant. Regulations differ by state, market structure, participant type, and contract model.

---

## 3. User roles and permissions

### 3.1 Guest
- Browse public project summaries and demo market stats.
- View methodology and simulation disclaimers.
- Cannot fund, list a site, or submit readings.

### 3.2 Rooftop / Space Owner
- Create a profile.
- Submit a site with approximate location, area, roof type, shading estimate, and photos (optional).
- See site review status and estimated solar potential.
- Accept a draft project agreement in the demo.
- View project status, agreed lease/revenue formula, and simulated owner settlement.

### 3.3 Project Developer / Operator
- Create a solar project linked to an approved site.
- Enter system size, capex estimate, operating costs, expected generation, project milestones, and a draft allocation agreement.
- Publish funding terms after validation.
- Upload simulated generation data or meter CSV.
- Propose generation batches and settlement runs.
- Cannot alter a finalized on-chain record; corrections must be new, linked events.

### 3.4 Funder / Investor (demo-only)
- Browse projects and their risk/disclosure panels.
- Contribute test credits to a project.
- See contribution receipt and calculated funding share.
- See simulated distribution statements.
- Must be shown that contributions are not real investments and returns are not guaranteed.

### 3.5 Energy Buyer (demo-only market)
- Create a demand request by time interval, kWh, and maximum price.
- View matched simulated energy offers.
- Confirm a simulated trade.
- View trade receipt and settlement state.

### 3.6 Verifier / Auditor
- Review site and project evidence.
- Review meter-data provenance and anomaly flags.
- Approve, reject, or request correction for a generation batch.
- Put a project or batch into a review/frozen state.
- Every action is attributed and timestamped.

### 3.7 Admin
- Manage demo accounts, roles, configuration, and seeded sample data.
- Cannot silently edit historical settlement records.
- Any emergency correction is an append-only audit event with a reason.
- Admin powers must be visibly documented; do not call a permissioned admin-controlled system “fully decentralized.”

---

## 4. Core functionality and modules

### F1. Identity and wallet
- Email/demo login for local testing; optional wallet connect for testnet.
- Store wallet address as a public identifier only.
- Never ask for or store a seed phrase/private key.
- Map the signed-in user to a role.
- Prevent one user from performing unauthorized actions for another role.

### F2. Rooftop Registry
Fields:
- `siteId`, owner ID, display name, approximate location, state/country, roof area (m²), usable area (m²), roof type, shading estimate, structural review status, grid connection status, photo/evidence URLs, submitted timestamp.
- Keep precise address private by default; use approximate location on public listings.
- State: `DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED | NEEDS_CHANGES | REJECTED`.

### F3. Solar potential estimator
For hackathon estimates, make assumptions explicit:
- Usable area (m²)
- Panel density assumption (kW per m²) or configurable module layout
- Estimated capacity (kWp)
- Location/solar resource assumption
- Estimated daily/monthly generation (kWh)
- Estimated project capex
- Assumption source and timestamp

Never present a rough estimate as a bankable engineering design. Label it **Illustrative estimate — site survey required**.

### F4. Project builder
Fields:
- Project ID and site ID
- Developer/operator
- Target capacity (kWp)
- Funding target (test credits)
- Currency/unit and simulation flag
- Expected monthly generation (kWh)
- Estimated operating reserve
- Project duration
- Allocation agreement version/hash
- Funding close date
- Milestones and evidence
- State: `DRAFT -> REVIEW -> FUNDING_OPEN -> FUNDED -> INSTALLATION_SIMULATED -> ACTIVE_SIMULATED -> SETTLEMENT_PENDING -> COMPLETED`
- Other terminal states: `CANCELLED`, `DISPUTED`, `PAUSED`.

### F5. Community funding pool (demo)
- Project is funded only when valid contributions reach the funding target.
- Show committed, received, remaining, and target amounts separately.
- Each contribution gets a unique ID, user, amount, timestamp, payment/test transaction reference, and status.
- Contributions are locked in the demo ledger after acceptance, not in real money.
- If the funding deadline passes before target is reached, set project to `FUNDING_FAILED` and create refund credits/records for every contribution.
- No partial success unless the project explicitly supports a lower minimum target and the user accepted that rule.
- Do not let the frontend calculate authoritative balances; backend/contract is the source of truth.

### F6. Generation Proof
- Input: signed meter API, trusted data provider, verifier upload, or clearly labelled simulator.
- Every reading must include: project ID, meter ID (masked publicly), interval start/end, kWh, unit, source type, source reference, submitted by, timestamp, data hash, verification state, and anomaly flags.
- Reject negative values, duplicate interval IDs, impossible time intervals, malformed units, and readings outside configured limits.
- Use idempotency keys to avoid double ingestion.
- State: `SUBMITTED -> VALIDATING -> VERIFIED | REJECTED | NEEDS_REVIEW`.
- Only `VERIFIED` batches may drive settlement or incentive issuance.
- A hash proves that a submitted payload has not changed since hashing; it does not prove the payload was physically true.

### F7. P2P offer/request market (simulation first)
- Seller offer: interval, available kWh, minimum price per kWh, project ID, verified generation batch, status.
- Buyer request: interval, requested kWh, maximum price per kWh, status.
- Match only overlapping time intervals, compatible units, eligible participants, and available quantities.
- Never sell more than the verified available energy.
- Matching rules must be deterministic and visible. MVP suggestion: price-time priority, then stable ID tie-breaker.
- Trade states: `OPEN -> PARTIALLY_MATCHED -> MATCHED -> CONFIRMED -> SETTLEMENT_PENDING -> SETTLED`; alternatives: `CANCELLED`, `EXPIRED`, `DISPUTED`.
- Keep energy quantity (kWh) distinct from monetary/test-credit amount.
- If no actual utility/meter integration exists, label every trade “Simulated P2P trade — no physical electricity transfer or utility bill change.”

### F8. Allocation and settlement engine
- Use a versioned, deterministic ruleset.
- Settlement input must be immutable after finalization.
- Store calculation breakdown, rule version, rounding, and source records.
- Prevent paying out more than the settled pool balance.
- Use integer minor units for money/test credits (e.g. paise/cents) and integer Wh for energy where practical. Avoid floating-point money arithmetic.
- Generate a human-readable settlement statement and downloadable CSV/JSON receipt.

### F9. Renewable attributes and certificates
- MVP: create an internal **Renewable Attribute Record**, not an official REC or carbon credit.
- Record generation batch ID, eligible kWh, methodology, location, time interval, status, and whether the attribute has been allocated or retired within the demo.
- Prevent double counting: one generation unit cannot be allocated to multiple buyers or claimed twice.
- Label records “Demo renewable-energy attribute — not an official certificate.”
- Real REC issuance/trading requires the relevant program, registry, eligibility, and regulatory process.

### F10. Clean-energy incentives
- Use non-transferable, non-redeemable demo points initially.
- Example: award points only after a generation batch is verified, not merely for creating an account or submitting a reading.
- Maintain a points ledger with reason, source event, rule version, and idempotency key.
- If sponsors later fund real rewards, add sponsor balance, terms, redemption rules, fraud checks, and legal review.
- Do not promise monetary value or issue a freely tradable token in the MVP.

### F11. Climate impact
- Show actual/simulated renewable kWh separately from estimates.
- Emissions avoided formula: `eligible renewable kWh × selected grid emissions factor (kg CO₂e/kWh)`.
- Store the factor source, geography, period, version, and date.
- Display the result as an estimate and include the factor/methodology link.
- Do not issue a carbon-credit claim from this calculation alone.

### F12. Audit & dispute center
- Append-only event timeline for critical actions.
- Record actor, action, object type/ID, timestamp, previous state, new state, reason, payload hash, and transaction reference when applicable.
- Disputed project/batch/trade freezes future settlement until review.
- Do not delete historical events. Correct through reversal/correction entries linked to the original.
- Include export for judges: project lifecycle, funding receipts, generation batches, allocation, settlement, impact assumptions, and audit trail.

---

## 5. End-to-end lifecycle

### Phase A — Site listing
1. Owner connects/logs in.
2. Owner submits rooftop details.
3. Estimator calculates indicative size, generation, and capex.
4. Owner submits for review.
5. Verifier approves, rejects, or requests changes.
6. Approved site appears in marketplace with public-safe location and assumptions.

### Phase B — Project creation and agreement
1. Developer creates a project against an approved site.
2. Project includes capacity, funding target, expected generation, expenses/reserve, timeline, and allocation rules.
3. Platform validates all mandatory fields.
4. Owner and developer accept a versioned demo agreement.
5. Agreement document hash is stored; do not put personal documents on a public blockchain.
6. Project enters `FUNDING_OPEN`.

### Phase C — Funding
1. Funder reviews project details and simulation disclaimer.
2. Funder enters a contribution amount.
3. Backend/contract checks project state, contribution limits, and remaining target.
4. Test credits are recorded as a contribution.
5. Funding totals are recalculated from accepted contribution records.
6. If target reached: project enters `FUNDED`; if deadline expires below target: `FUNDING_FAILED`, then all accepted contributions are refunded in the simulation ledger.
7. A contribution receipt is issued.

### Phase D — Installation milestone
1. Operator records the simulated or real installation milestone.
2. Evidence reference and timestamp are attached.
3. Verifier approves the milestone.
4. Project becomes `ACTIVE_SIMULATED` for the hackathon.
5. UI prominently identifies whether the installation is simulated or real.

### Phase E — Generation data
1. Simulator or trusted source submits an interval reading.
2. API validates schema, interval, unit, uniqueness, and plausible range.
3. Reading receives a payload hash and source provenance.
4. Verifier approves/rejects/flags the batch.
5. Only verified batches increase eligible generation.
6. UI updates project production, energy allocation, and estimated impact.

### Phase F — P2P market
1. Seller publishes an offer backed by verified unallocated kWh.
2. Buyer publishes demand for an interval.
3. Matching engine finds eligible offers/requests.
4. Platform previews quantity, price, fees, and total before confirmation.
5. Both parties confirm the simulated trade.
6. Quantity is reserved to prevent double selling.
7. Trade is marked `SETTLEMENT_PENDING`.

### Phase G — Revenue settlement
1. Settlement period closes.
2. Engine selects only verified generation and confirmed trades in that period.
3. It subtracts explicitly defined costs/reserves/fees from collected simulated proceeds.
4. It calculates the distributable pool.
5. It applies the agreed split to eligible participants.
6. It validates that sum of allocations equals the distributable pool (within documented integer rounding).
7. A settlement run is created with immutable inputs, formula version, and output hash.
8. Each participant receives a statement and simulated balance credit.
9. On testnet, an optional contract emits a settlement event; the database stores the transaction hash.
10. Disputes pause later settlements for the affected project; do not silently mutate finalized settlement runs.

### Phase H — Renewable attributes, points, impact
1. Eligible generation units receive internal attribute records.
2. Allocated/retired units are marked to prevent double claims.
3. Incentive points are awarded only if the event meets the published rules.
4. Estimated avoided emissions are calculated with a versioned factor.
5. Dashboard and downloadable impact report show methodology and disclaimers.

### Phase I — Project closeout
1. Project reaches end date or is cancelled.
2. Outstanding trades, balances, disputes, and refunds are reconciled.
3. Final statement is generated.
4. Project becomes `COMPLETED` only after required settlement tasks pass.
5. All records remain auditable.

---

## 6. Money and energy allocation rules

### 6.1 Separate four concepts

Do not mix these values:
- **Energy:** kWh or Wh.
- **Project contribution:** test credits contributed toward project funding.
- **Trade proceeds:** test credits paid by buyers in the simulated market.
- **Ownership/revenue share:** contractual percentage used to distribute net proceeds.

A contribution percentage does not automatically mean the contributor owns a legal share of a real asset. In this demo it is only a simulated project funding share unless legal agreements establish otherwise.

### 6.2 Suggested demo funding-share formula

For accepted contributions `c_i` and total accepted funding `F`:

`fundingShare_i = c_i / F`

Display as a percentage rounded for UI, but retain integer amounts and exact numerator/denominator for calculations. If funding is not complete, label the share “provisional.”

### 6.3 Suggested settlement waterfall

Configure these rules per project and show them before any demo contribution:

1. `grossProceeds` = sum of confirmed simulated trade payments for the settlement period.
2. `refundsAndAdjustments` = approved refunds/reversals.
3. `operatingReserve` = explicitly configured amount or percentage, capped at available gross proceeds.
4. `platformFee` = disclosed percentage or fixed amount, capped at remaining proceeds.
5. `distributablePool` = max(0, grossProceeds - refundsAndAdjustments - operatingReserve - platformFee).
6. Split the distributable pool using the project agreement, for example:
   - 70% to project funders, split by eligible funding share.
   - 20% to rooftop owner.
   - 10% to operator/maintenance reserve.
7. Verify all shares sum to 100% and all amounts sum to the pool after deterministic rounding.

**Example only:** Gross simulated proceeds = 10,000 test credits; approved refunds = 0; operating reserve = 1,000; platform fee = 500. Distributable pool = 8,500. If split is 70/20/10: funders receive 5,950, owner receives 1,700, operator/reserve receives 850. If funder A contributed 60% of eligible funding and funder B 40%, A receives 3,570 and B receives 2,380. These are demo numbers, not a financial forecast.

### 6.4 If the project is cancelled
- Before funding target: automatically mark contributions refundable in the demo ledger.
- After funding close but before installation: apply the explicit cancellation policy; do not invent an automatic real-world refund promise.
- After generation/trading begins: settle already-confirmed periods, freeze disputed items, and apply the signed agreement.
- Every refund/reversal gets a separate ledger event and references the original transaction.

### 6.5 If energy is insufficient
- Never allocate more than verified available kWh.
- Partial-fill a trade if the buyer agreed to partial fills; otherwise cancel or leave unmatched.
- Record shortfall reason and any price/settlement adjustment.
- Do not make the UI imply that a trade is physically delivered unless the meter/grid arrangement confirms it.

### 6.6 Rounding
- Use integer Wh for energy and integer minor units for currency/test credits.
- Use deterministic largest-remainder allocation or another documented rule to distribute rounding residuals.
- Assert `sum(allocationAmounts) == distributablePool`.
- Never use JavaScript floating-point arithmetic as the authoritative money calculation.

---

## 7. Example transaction lifecycle

Assume a demo rooftop project with a funding target of 200,000 BL credits.

### Funding
- Funder A contributes 120,000 credits (60%).
- Funder B contributes 80,000 credits (40%).
- Total reaches 200,000; project becomes `FUNDED`.

### Simulated generation and trade
- Verified/simulated generation batch: 600 kWh.
- 400 kWh is reserved for a confirmed demo trade.
- 200 kWh remains unallocated.
- Buyer pays 4,000 test credits for 400 kWh at 10 credits/kWh.
- UI says “Simulated trade — no physical delivery or bill change.”

### Settlement
- Gross proceeds: 4,000.
- Operating reserve: 400.
- Platform fee: 200.
- Distributable pool: 3,400.
- Funder pool (70%): 2,380.
- Rooftop owner (20%): 680.
- Operator/maintenance (10%): 340.
- Funder A (60% of funder pool): 1,428.
- Funder B (40%): 952.
- Check: 1,428 + 952 + 680 + 340 = 3,400.

### Impact
- Eligible generation = 600 kWh only if the full batch is verified.
- If using a sample emissions factor of 0.7 kg CO₂e/kWh, estimated avoided emissions = 420 kg CO₂e.
- This is an illustrative calculation; production must use an authoritative, geographically appropriate factor and clear methodology.
- The 400 kWh trade allocation must be linked to the generation batch and cannot be claimed again by another buyer.

---

## 8. Architecture recommendation

### MVP architecture

- **Frontend:** React + TypeScript + Vite.
- **UI:** Tailwind CSS + accessible component system.
- **Data fetching:** TanStack Query or a consistent equivalent.
- **Backend API:** Node.js + TypeScript + Express/Fastify.
- **Validation:** Zod or equivalent shared schemas.
- **Database:** PostgreSQL; Prisma or Drizzle ORM.
- **Charts:** Recharts.
- **Smart contracts:** Solidity, OpenZeppelin libraries, Hardhat or Foundry.
- **Chain:** Local Anvil/Hardhat first; optional low-cost EVM testnet after tests pass.
- **Wallet:** wagmi + viem or ethers, with chain/network checks.
- **File evidence:** local/dev object storage or an S3-compatible service; store only references and hashes on-chain.
- **Testing:** Vitest/Jest, API integration tests, Playwright for critical UI journeys.
- **Observability:** structured logs, request IDs, error reporting, and health endpoint.

### Architecture boundary

Use PostgreSQL for application workflows and private data. Use the blockchain only for the records that benefit from independent auditability: project agreement hash, accepted contribution events in the demo, verified batch hash, settlement run hash, and relevant events. Do not put personal data, private site addresses, documents, or meter identifiers on a public chain.

### Suggested folder structure

```text
bright-ledger/
  apps/
    web/
      src/
        app/
        components/
        features/
          sites/
          projects/
          funding/
          generation/
          market/
          settlement/
          impact/
          audit/
        lib/
    api/
      src/
        modules/
          auth/
          users/
          sites/
          projects/
          funding/
          meter-data/
          offers/
          trades/
          settlement/
          incentives/
          impact/
          audit/
        middleware/
        config/
        server.ts
  packages/
    shared/
      src/
        schemas/
        types/
        constants/
  contracts/
    src/
      ProjectRegistry.sol
      FundingEscrowDemo.sol
      GenerationRegistry.sol
      SettlementLedger.sol
      IncentivePoints.sol
    test/
    scripts/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  docs/
    PRODUCT_SPEC.md
    API_SPEC.md
    CONTRACTS.md
    THREAT_MODEL.md
  .env.example
  README.md
```

---

## 9. Database schema

Use UUIDs for database IDs. Keep all timestamps in UTC. Use integer minor units for money/test credits and integer Wh for energy wherever practical.

### `users`
- `id` UUID PK
- `display_name`
- `email` unique nullable for wallet-only demo
- `wallet_address` unique nullable
- `role` enum
- `status` enum
- `created_at`, `updated_at`

### `sites`
- `id` UUID PK
- `owner_user_id` FK users
- `name`
- `country_code`, `region`, `city`
- `public_location_label`
- `private_address_encrypted` nullable
- `roof_area_m2`, `usable_area_m2`
- `roof_type`, `shading_pct`
- `grid_connection_status`
- `review_status`
- `evidence_refs` JSONB
- `created_at`, `updated_at`

### `solar_estimates`
- `id` UUID PK
- `site_id` FK
- `methodology_version`
- `capacity_kwp`
- `estimated_daily_kwh`
- `estimated_monthly_kwh`
- `estimated_capex_minor`
- `currency_code`
- `resource_source`
- `assumptions` JSONB
- `created_at`

### `projects`
- `id` UUID PK
- `site_id` FK
- `developer_user_id` FK users
- `name`, `description`
- `status` enum
- `capacity_kwp`
- `funding_target_minor`
- `currency_code`
- `expected_monthly_kwh`
- `funding_deadline`
- `agreement_version`
- `agreement_hash`
- `allocation_rules` JSONB
- `simulation_mode` boolean NOT NULL DEFAULT true
- `created_at`, `updated_at`

### `contributions`
- `id` UUID PK
- `project_id` FK
- `contributor_user_id` FK users
- `amount_minor` BIGINT CHECK > 0
- `currency_code`
- `status` enum: pending/accepted/refund_pending/refunded/rejected
- `idempotency_key` unique
- `payment_reference` nullable
- `chain_tx_hash` nullable
- `created_at`, `updated_at`

### `generation_batches`
- `id` UUID PK
- `project_id` FK
- `meter_ref_hash` (never public raw meter ID)
- `interval_start`, `interval_end`
- `energy_wh` BIGINT CHECK >= 0
- `source_type` enum: simulator/csv/api/meter
- `source_reference`
- `payload_hash`
- `verification_status`
- `anomaly_flags` JSONB
- `submitted_by` FK users
- `verified_by` FK users nullable
- `verified_at` nullable
- `chain_tx_hash` nullable
- `created_at`
- Unique constraint appropriate to project + meter hash + interval.

### `energy_offers`
- `id` UUID PK
- `project_id` FK
- `generation_batch_id` FK
- `interval_start`, `interval_end`
- `available_energy_wh` BIGINT CHECK > 0
- `remaining_energy_wh` BIGINT CHECK >= 0
- `price_minor_per_kwh` BIGINT CHECK >= 0
- `seller_user_id` FK users
- `status` enum
- `created_at`, `updated_at`

### `energy_requests`
- `id` UUID PK
- `buyer_user_id` FK users
- `interval_start`, `interval_end`
- `requested_energy_wh` BIGINT CHECK > 0
- `remaining_energy_wh` BIGINT CHECK >= 0
- `max_price_minor_per_kwh` BIGINT CHECK >= 0
- `status` enum
- `created_at`, `updated_at`

### `trades`
- `id` UUID PK
- `offer_id` FK
- `request_id` FK
- `seller_user_id` FK users
- `buyer_user_id` FK users
- `energy_wh` BIGINT CHECK > 0
- `price_minor_per_kwh` BIGINT
- `gross_amount_minor` BIGINT
- `status` enum
- `simulation_mode` boolean
- `confirmed_at`, `settled_at` nullable
- `chain_tx_hash` nullable
- `created_at`, `updated_at`

### `settlement_runs`
- `id` UUID PK
- `project_id` FK
- `period_start`, `period_end`
- `status` enum: draft/validated/finalized/disputed/reversed
- `gross_proceeds_minor`
- `refunds_minor`
- `operating_reserve_minor`
- `platform_fee_minor`
- `distributable_pool_minor`
- `rules_version`
- `input_hash`
- `output_hash`
- `chain_tx_hash` nullable
- `created_by`, `finalized_at`
- Unique constraint on project + period + rules version as appropriate.

### `settlement_allocations`
- `id` UUID PK
- `settlement_run_id` FK
- `recipient_user_id` FK users
- `allocation_type` enum: funder/owner/operator/reserve/refund/fee
- `amount_minor` BIGINT CHECK >= 0
- `calculation_details` JSONB
- `status` enum: pending/credited/paid/reversed
- `created_at`
- Unique constraint on settlement run + recipient + allocation type.

### `renewable_attributes`
- `id` UUID PK
- `generation_batch_id` FK
- `energy_wh` BIGINT CHECK > 0
- `status` enum: available/allocated/retired/reversed
- `allocated_to_trade_id` nullable FK trades
- `methodology_version`
- `created_at`
- Prevent over-allocation with transactional checks or a separate allocation table.

### `incentive_ledger`
- `id` UUID PK
- `user_id` FK users
- `points_delta` BIGINT
- `reason_code`
- `source_event_id`
- `rules_version`
- `idempotency_key` unique
- `created_at`

### `audit_events`
- `id` UUID PK
- `actor_user_id` nullable FK users
- `action`
- `entity_type`, `entity_id`
- `previous_state` JSONB nullable
- `new_state` JSONB nullable
- `reason` nullable
- `payload_hash`
- `chain_tx_hash` nullable
- `request_id`
- `created_at`
- Application role must not have permission to update/delete audit rows.

### `outbox_events` (recommended)
- `id` UUID PK
- `event_type`
- `aggregate_type`, `aggregate_id`
- `payload` JSONB
- `status`
- `attempts`
- `created_at`, `processed_at`
Use an outbox pattern so a committed database transaction cannot lose a needed background job/chain submission.

---

## 10. Smart contract design

### Contract principles
- Keep contracts small, independently testable, and purpose-specific.
- Use OpenZeppelin libraries rather than writing token/security primitives from scratch.
- Start on a local chain; use a testnet only after all tests pass.
- No private user data on-chain.
- Avoid a custom tradable token for the hackathon. Use test ETH or a clearly labelled mock credit ledger.
- No admin backdoor that can silently rewrite past events.
- Use pause controls for new operations, not for erasing records.
- Include events for state changes.
- Apply checks-effects-interactions and reentrancy protections for external value transfers.
- Consider a multisig or timelock for any privileged production operations; not needed for the local demo.

### Contract A: `ProjectRegistry`
Purpose:
- Register project metadata hash, owner/operator addresses, target, deadline, simulation flag, status.
- Store only hashes and non-sensitive summary fields.
- Emit `ProjectCreated`, `ProjectStatusChanged`, `AgreementHashUpdated`.

Suggested functions:
- `createProject(bytes32 projectId, bytes32 metadataHash, uint256 fundingTarget, uint64 deadline, bool simulationMode)`
- `setProjectStatus(bytes32 projectId, ProjectStatus status)` with role and valid-transition checks
- `setAgreementHash(bytes32 projectId, bytes32 agreementHash)` only before funding opens or via versioned update

### Contract B: `FundingEscrowDemo`
Purpose:
- Demonstrate contributions, funding completion, and refund accounting on a local/test chain.
- Prefer test ETH or a mock-credit token only; no real currency.
- Track per-project contributions and total raised.
- Prevent contributions after close/deadline or beyond allowed cap.
- Provide refund path if target fails by deadline.
- Emit contribution/refund events.
- Never claim that demo contributions buy legal equity or guarantee returns.

### Contract C: `GenerationRegistry`
Purpose:
- Record `projectId`, interval, energy amount, source hash, verifier, and status.
- Accept only authorized verifier/relayer submissions.
- Reject duplicate batch IDs and invalid intervals.
- Emit `GenerationSubmitted`, `GenerationVerified`, `GenerationRejected`.
- Store data hash and reference, not raw personal/meter data.
- The contract cannot independently confirm a meter is honest; verifier/oracle trust assumptions must be documented.

### Contract D: `SettlementLedger`
Purpose:
- Record settlement run hash and participant allocations, or just settlement hash for a lower-cost MVP.
- Require a verified input batch and finalized rules version.
- Ensure sum of allocations equals the distributable pool.
- Prevent the same settlement run from finalizing twice.
- Emit `SettlementFinalized` and `AllocationRecorded`.
- If actual funds are not being transferred, call it a settlement **record**, not payment execution.

### Contract E: `IncentivePoints` (optional)
MVP recommendation: keep points in PostgreSQL only.
If a contract is required for judging:
- Use a non-transferable badge/points contract on a testnet.
- Only an authorized issuer may award points for a verified event.
- Prevent duplicate award by event ID.
- Clearly display no cash value and no redemption.
- Do not market it as an investment token.

### Contract state machine rules
- No `ACTIVE_SIMULATED` project before funding success and required milestones.
- No settlement for unverified generation.
- No finalization for a disputed project.
- No duplicate generation batch, trade, refund, or settlement run.
- No transition out of a terminal state except a documented correction/reopen process.
- All transitions should have tests.

---

## 11. API design

Use `/api/v1`. Return consistent error responses and validation details. Require authentication for writes. Enforce role-based authorization on the server.

### Sites
- `POST /sites`
- `GET /sites`
- `GET /sites/:id`
- `PATCH /sites/:id`
- `POST /sites/:id/submit`
- `POST /sites/:id/review`

### Solar estimates
- `POST /sites/:id/estimate`
- `GET /sites/:id/estimates/latest`

### Projects
- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `POST /projects/:id/publish`
- `POST /projects/:id/cancel`
- `GET /projects/:id/timeline`

### Funding
- `POST /projects/:id/contributions`
- `GET /projects/:id/contributions`
- `GET /contributions/:id/receipt`
- `POST /projects/:id/close-funding`
- `POST /contributions/:id/refund` (authorized workflow only)

### Generation
- `POST /projects/:id/generation-batches`
- `GET /projects/:id/generation-batches`
- `POST /generation-batches/:id/verify`
- `POST /generation-batches/:id/reject`

### Market
- `POST /offers`
- `GET /offers`
- `POST /requests`
- `GET /requests`
- `POST /trades/match-preview`
- `POST /trades/:id/confirm`
- `POST /trades/:id/cancel`
- `GET /trades/:id/receipt`

### Settlement
- `POST /projects/:id/settlement-runs/preview`
- `POST /projects/:id/settlement-runs`
- `POST /settlement-runs/:id/validate`
- `POST /settlement-runs/:id/finalize`
- `GET /settlement-runs/:id`
- `GET /users/me/settlements`

### Incentives and impact
- `GET /users/me/points`
- `GET /projects/:id/impact`
- `GET /projects/:id/renewable-attributes`

### Audit and health
- `GET /projects/:id/audit-events`
- `GET /health`
- `GET /ready`

API safety:
- Validate every input.
- Use pagination and stable sorting.
- Apply rate limits to auth and write routes.
- Use idempotency keys for contributions, meter ingestion, trade confirmation, and settlement finalization.
- Do not trust amounts or roles supplied by the browser.
- Return a correlation/request ID for troubleshooting.

---

## 12. UI/UX pages and required states

1. **Landing page:** clear value proposition; CTA to explore projects; demo disclaimer.
2. **Role onboarding:** Owner / Developer / Funder / Buyer / Verifier (demo role switch only in development).
3. **Marketplace:** approved rooftops/projects, filters, status labels, estimated generation and funding progress.
4. **Site detail:** usable area, assumptions, review status, estimated capacity/capex, private-data warning.
5. **Project detail:** funding terms, allocation waterfall, risk/disclosure panel, lifecycle timeline, energy/impact charts.
6. **Create project wizard:** site → capacity/estimate → budget → allocation rules → review/publish.
7. **Funding drawer/modal:** contribution amount, test-credit balance, percentage after contribution, risks, confirmation.
8. **Operator dashboard:** generation submissions, anomalies, verification state, project milestones.
9. **P2P market:** offers, requests, match preview, quantity and price, simulation badge.
10. **Trade receipt:** quantity, interval, price, buyer/seller aliases, status, no-physical-transfer disclaimer.
11. **Settlement preview:** gross proceeds → refunds → reserve → fee → distributable pool → each allocation.
12. **Impact dashboard:** verified/simulated kWh, estimated CO₂e, factor source, attributes allocated/remaining.
13. **Audit explorer:** chronological events, actor, hashes, chain explorer link when available.
14. **Dispute center:** reason, affected batch/trade, frozen state, review history.
15. **Admin/seed data:** local development only; do not expose unrestricted admin tools in production.

### UX quality requirements
- Every asynchronous action has loading, success, error, retry, and disabled states.
- Never show a successful contribution/trade before server/contract confirmation.
- Use explicit statuses and clear next actions.
- Make simulated data visually distinct from real or externally verified data.
- Responsive on mobile and desktop.
- Keyboard accessible, sufficient contrast, labelled forms, focus states.
- Use skeletons for loading, optimistic UI only where safe, and avoid layout shift.
- Include empty, error, partial-fill, insufficient-funds, expired, disputed, and rejected states.
- Display time zone and interval boundaries consistently.

---

## 13. Non-functional requirements

### Security
- Role-based access control enforced on backend.
- Use secure password/session handling if email login is implemented.
- Never store private keys or seed phrases.
- Encrypt sensitive personal/site data at rest and in transit.
- Avoid putting personal data on-chain.
- Rate-limit endpoints and validate all uploaded files.
- Protect against SQL injection, XSS, CSRF (as applicable), SSRF, IDOR, replay, duplicate submissions, and reentrancy.
- Follow least privilege for database and contract roles.
- Use environment variables for secrets; commit only `.env.example`.
- Pin dependency versions and run audit tooling.
- Have a documented threat model and emergency pause procedure.

### Reliability and data integrity
- Idempotent critical writes.
- Database transactions for funding, energy reservations, and settlement.
- Unique constraints for duplicate meter intervals and idempotency keys.
- Append-only audit history.
- Background jobs retry safely.
- Reconcile database state with chain events using transaction hashes and event logs.
- Do not treat an unconfirmed chain transaction as final.

### Performance
- Marketplace and dashboard target: under 2 seconds for common local-demo reads under expected hackathon load.
- Paginate tables and avoid fetching all events at once.
- Cache safe aggregate reads; invalidate after writes.
- Index project status, timestamps, foreign keys, wallet address, and query fields.
- Do not block the UI while a chain transaction confirms; show pending state.

### Maintainability
- TypeScript strict mode.
- Shared request/response schemas.
- Small modules and domain services.
- Unit tests for formulas and state transitions.
- Document assumptions, units, error codes, and environment setup.

---

## 14. Failure cases and how to handle them

| Failure | Required behavior |
|---|---|
| Funding target not reached | Mark funding failed at deadline; create refund records for every accepted demo contribution. |
| Duplicate contribution request | Idempotency key returns original receipt; do not count twice. |
| Wallet transaction rejected | Keep project unchanged; show rejected/pending state accurately. |
| Chain RPC unavailable | Queue/retry non-critical anchoring; do not claim on-chain confirmation. |
| Duplicate meter interval | Reject or return original batch based on idempotency key. |
| Meter reading is implausible | Mark `NEEDS_REVIEW`; do not include it in settlement. |
| Verifier rejects batch | Keep record and reason; no allocation or points. |
| Energy offer oversubscribed | Reserve available Wh transactionally; never allow negative remaining energy. |
| Buyer/seller cancellation race | Use state transition with optimistic locking/DB transaction; only one transition succeeds. |
| Settlement sum mismatch | Abort finalization and surface calculation details; never silently balance it. |
| Settlement finalized twice | Unique constraint/idempotency check returns existing finalized result. |
| Dispute after finalization | Freeze future related settlement; create a linked correction/reversal, do not edit history. |
| Token/points double award | Unique source-event idempotency key. |
| Invalid emissions factor | Block impact calculation or mark unavailable; never silently use a made-up factor. |
| Unauthorized role action | Return 403, write security log, do not mutate state. |
| Partial backend/chain failure | Use pending/reconciliation state and retry; do not pretend both sides committed atomically. |

---

## 15. Testing plan and acceptance criteria

### Unit tests
- Solar estimator assumptions and units.
- Funding share formula.
- Settlement waterfall and split.
- Integer rounding and exact sum.
- Energy reservation and no overselling.
- Incentive idempotency.
- State transition validator.
- Emissions calculation with versioned factor.

### Integration tests
- Site submit → review → approved.
- Project publish → contributions → funded.
- Funding deadline failure → refund ledger.
- Generation submit → anomaly → verify/reject.
- Verified batch → offer → match → confirm.
- Settlement preview → validation → finalize.
- Dispute freezes settlement.
- API authorization for each role.
- Database rollback on settlement mismatch.

### Contract tests (if using contracts)
- Duplicate project/batch/run rejection.
- Contribution after deadline rejection.
- Refund path after failed funding.
- Unauthorized verifier rejection.
- No settlement before generation verification.
- Allocation sum equality.
- Pause and role controls.
- Reentrancy protection for any external value transfer.
- Fuzz/property tests for totals, quantities, and state transitions.

### End-to-end acceptance criteria
- A judge can create/select an owner, approve a rooftop, create a project, fund it with two demo accounts, submit a generation batch, verify it, create and confirm a simulated P2P trade, finalize settlement, and see updated balances and impact.
- Every key action has a timeline event and a receipt.
- The demo clearly distinguishes estimates, simulations, verified inputs, and on-chain records.
- No contribution, energy quantity, or settlement is counted twice.
- Settlement allocations sum exactly to the distributable pool.
- The README can take a developer from clone to working local demo with one documented command sequence.

---

## 16. Seed data for a convincing demo

Seed at least:
- 3 rooftop sites in different review states.
- 2 funded/active simulated projects.
- 3 demo funders.
- 2 demo buyers.
- 2 demo sellers/prosumers.
- 5 generation batches: verified, pending, rejected, duplicate attempt, anomaly flagged.
- 4 energy offers and 3 requests, including one partial match.
- 3 settlement runs: successful, disputed, and draft.
- Audit events across the lifecycle.
- One incentive award and one prevented duplicate award.

Suggested demo project:
- Project: “Sunrise Community Roof”
- Site: 1,000 sq. ft. roof (or store as m² and convert for display)
- Estimated capacity: configurable illustrative value, not an engineering promise
- Funding target: 200,000 BL demo credits
- Funder A: 120,000 credits
- Funder B: 80,000 credits
- Sample generation: 600 kWh
- Simulated trade: 400 kWh at 10 demo credits/kWh
- Gross proceeds: 4,000 demo credits
- Reserve: 400; fee: 200; distributable: 3,400
- Split: 70% funder pool, 20% owner, 10% operator/reserve
- Funder A: 1,428; Funder B: 952; owner: 680; operator/reserve: 340
- Impact factor example: 0.7 kg CO₂e/kWh, explicitly marked illustrative and replaceable by a sourced factor.

---

## 17. Copilot implementation prompts

Use these prompts one at a time. Ask Copilot to inspect the existing repository before making changes and to summarize files changed after each step.

### Prompt 1 — Repository foundation
> Read `docs/PRODUCT_SPEC.md` fully. Inspect the current repository before coding. Build a monorepo with a React + TypeScript + Vite frontend, Node.js + TypeScript API, shared Zod schemas, PostgreSQL/Prisma, linting, formatting, and tests. Create `.env.example`, README setup instructions, health/readiness endpoints, and a deterministic seed script. Do not implement blockchain or financial logic yet. Ensure `npm` scripts and local development commands work.

### Prompt 2 — Database and domain models
> Implement the Prisma schema from the product specification for users, sites, solar estimates, projects, contributions, generation batches, offers, requests, trades, settlement runs, allocations, renewable attributes, incentive ledger, audit events, and outbox events. Add enums, indexes, unique constraints, and check constraints through SQL migrations where Prisma cannot express them. Generate migrations and seed data. Add tests for schema constraints and document all units.

### Prompt 3 — Domain rules
> Implement pure TypeScript domain services for project state transitions, solar estimates, funding completion/refunds, energy reservation, P2P matching, settlement waterfall, largest-remainder allocation, incentive idempotency, and emissions estimates. Use integer minor units for money and Wh for energy. No floating-point money math. Add comprehensive unit tests, including boundary and failure cases. Do not trust client-supplied totals.

### Prompt 4 — API
> Implement the `/api/v1` endpoints described in `docs/PRODUCT_SPEC.md`, with shared Zod validation, authentication middleware, role-based authorization, pagination, structured errors, request IDs, rate limiting, idempotency keys, and audit events. Use database transactions for contributions, energy reservations, and settlement finalization. Add API integration tests for all critical lifecycle and failure paths.

### Prompt 5 — Frontend
> Build a polished, responsive Bright Ledger dashboard using React, TypeScript, Tailwind, and accessible components. Pages: marketplace, site detail, project detail, create project wizard, funding modal, operator generation dashboard, P2P market, trade receipt, settlement preview, impact dashboard, audit explorer, and dispute center. Use the API and shared types. Show simulation/verification states clearly. Every async action needs loading, pending, success, error, and retry states. Do not hardcode financial totals in the UI.

### Prompt 6 — Blockchain layer
> Add optional local-chain smart contracts using Solidity and OpenZeppelin. Implement ProjectRegistry, FundingEscrowDemo, GenerationRegistry, and SettlementLedger with events, role checks, state-transition checks, duplicate prevention, pause controls, and tests. Use a local chain first and test-only assets. Do not add a tradable token. Keep personal data off-chain. Document what is and is not proven by each on-chain hash. Add a backend adapter that records transaction hashes and reconciles events safely.

### Prompt 7 — Security and correctness review
> Audit the repository against `docs/PRODUCT_SPEC.md`. Find and fix authorization gaps, IDOR, replay/duplicate requests, race conditions, double allocation, settlement rounding mismatches, state transition errors, unsafe upload handling, secret exposure, chain confirmation assumptions, and inaccurate simulation claims. Add tests for every fix. Produce `docs/THREAT_MODEL.md` and a checklist of remaining risks. Do not claim production readiness without an independent audit.

### Prompt 8 — Judge demo mode
> Implement a deterministic demo mode with seeded roles and a guided end-to-end walkthrough: approve rooftop → create project → fund with two demo users → submit and verify generation → match and confirm simulated trade → preview and finalize settlement → show impact and audit trail. Make reset idempotent and local-development-only. Add a visible “DEMO / SIMULATED DATA” label and prevent demo balances from being presented as real money.

---

## 18. Suggested build order for a hackathon

### Priority 0 — Must work
1. Seeded demo accounts and clear simulation label.
2. Rooftop/project marketplace.
3. Project funding progress with two funders.
4. Generation batch submission and verification state.
5. P2P offer/request matching with energy reservation.
6. Settlement waterfall with exact arithmetic.
7. Impact dashboard and audit timeline.
8. One end-to-end test and a clean README.

### Priority 1 — Add if stable
- Wallet connect.
- Local-chain contract events and hashes.
- Downloadable settlement receipt.
- CSV meter-data import.
- Dispute workflow.
- Non-transferable incentive points.

### Priority 2 — Do not risk the demo for these
- Real payments.
- Live utility/meter integration.
- Tradable tokens.
- Official REC/carbon-credit issuance.
- AI site matching that claims engineering accuracy.
- Mainnet deployment.

A reliable full-lifecycle simulation is stronger than a half-working live chain integration. If the contract layer is unstable, keep the business logic working locally and demonstrate a local-chain audit trail separately.

---

## 19. Compliance, trust, and presentation guardrails

Before real-world deployment:
- Consult the applicable state electricity regulator and distribution licensee about participant eligibility, metering, trading intervals, billing, and settlement.
- Review the relevant P2P guidelines and current amendments for the target jurisdiction.
- Get legal advice before offering pooled investments, fractional ownership, revenue-sharing securities, custody, or redeemable/tradable tokens.
- Use a licensed payment provider if real payments are introduced.
- Define privacy, data retention, consent, security, and grievance procedures.
- Obtain an engineering site survey and relevant grid/interconnection approvals before claiming a site is installable.
- Use authoritative, dated emissions factors and avoid double counting.
- Do not claim official renewable certificates or carbon credits without the required program/registry process.

### Judge-facing pitch (30 seconds)

> Bright Ledger connects underused rooftops with community solar project funding and a transparent energy marketplace. The platform follows a project from site approval and pooled demo funding through generation records, P2P trade matching, settlement allocation, and climate-impact estimates. Every important action has an audit trail, while the UI distinguishes simulated data from verified evidence. Our goal is to make distributed clean-energy participation more transparent and easier to coordinate.

### Demo checklist
- [ ] All seeded accounts work.
- [ ] Reset demo returns to a known state.
- [ ] Every action has loading and failure handling.
- [ ] Funding cannot exceed target without explicit rules.
- [ ] Duplicate generation and contribution attempts are rejected/idempotent.
- [ ] Energy cannot be sold twice.
- [ ] Settlement sum equals distributable pool.
- [ ] Disputed batch blocks settlement.
- [ ] All simulated transactions are labelled.
- [ ] Network/chain failure does not show false success.
- [ ] README, architecture diagram, and demo script are ready.

---

## 20. External references

1. Powerledger — Energy trading and traceability: https://powerledger.io/offerings/
2. Powerledger — Platform: https://powerledger.io/platform/
3. PowerXchange — P2P energy platform: https://www.powerxchange.io/
4. PVVNL — P2P energy trading pilot workflow: https://www.pvvnl.org/P2P-Energy-Trading
5. DERC — P2P Energy Transaction Guidelines (2024 PDF): https://derc.gov.in/sites/default/files/DERC%20Peer%20to%20Peer%20Energy%20Transaction%20Guidelines%202024%20-%2024.06.2024.pdf
6. Ethereum.org — ERC-20 token standard: https://ethereum.org/developers/docs/standards/tokens/erc-20/
7. Ethereum.org — Smart contract security: https://ethereum.org/developers/docs/smart-contracts/security
8. Energy Web — Verification protocol: https://energyweb.org/protocol/

**Final reminder:** This document is an implementation plan for a hackathon prototype, not legal, investment, engineering, or regulatory advice. Treat all example financial values as test data.
