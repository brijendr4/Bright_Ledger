# Bright Ledger — Collateral-Backed Project Manager & Secure Settlement Model
Version: 1.0  
Date: 30 October 2026  
Status: Hackathon architecture proposal — not a production legal, financial, or security opinion

## 1. Executive summary

Bright Ledger is a proposed platform for rooftop solar project discovery, pooled project funding, peer-to-peer (P2P) energy allocation/trading, renewable attribute tracking, and transparent settlement.

The proposed new participant is a **Bonded Project Operator** (also called Project Manager or Operator). The operator coordinates project execution: onboarding the rooftop owner, coordinating installer and meter integrations, collecting evidence, submitting milestone claims, and initiating settlement proposals.

To align the operator's incentives with project participants, the operator posts a **refundable crypto performance bond** into a dedicated on-chain bond vault. In Hindi, this is similar to *girvi* (pledged collateral), but the professional term depends on the legal structure:

- **Performance bond / operator bond:** collateral pledged by the operator to secure performance of specified duties.
- **Security deposit:** refundable amount held to secure contractual obligations.
- **Collateral:** an asset pledged to secure an obligation or debt.
- **Escrow:** assets held by a neutral arrangement until defined release conditions are met.
- **Collateralized loan:** a loan secured by collateral; this is a different model and should not be confused with an operator performance bond.
- **Liquidation:** sale or conversion of collateral under pre-agreed conditions, usually when loan health or collateral coverage breaches a threshold.
- **Slashing:** forfeiture of some or all bonded assets after a defined, provable violation and due process.

**Recommended design:** Do not give the operator direct custody of investor funds, energy-sale proceeds, or user collateral. Keep funds in segregated smart-contract vaults. Give the operator limited operational permissions. Require independent evidence and multi-party approval for sensitive actions.

No architecture can guarantee that incidents will never occur. The goal is to reduce the likelihood and impact of incidents, make actions auditable, and provide recovery procedures.

## 2. The product model and participant roles

### 2.1 Participants

1. **Rooftop / Site Owner**
   - Lists a roof or site, proves authority to use it, shares location and technical details, and signs a site-use agreement.
   - Receives the agreed lease, revenue share, or other contractual consideration.
   - Does not automatically transfer property ownership to Bright Ledger.

2. **Project Investor / Funding Participant**
   - Commits funds to a specific project under disclosed terms.
   - Receives the contractual project entitlement, which may be a revenue share, repayment claim, or another legally reviewed right.
   - Must see project risks, fees, lock-up, exit conditions, and loss scenarios before committing.

3. **Energy Buyer / Consumer**
   - Buys or is allocated eligible energy through a permitted utility, microgrid, or market arrangement.
   - A blockchain record does not itself grant a right to physically consume electricity or bypass the distribution utility.

4. **Bonded Project Operator (new role)**
   - Coordinates project execution and operational workflows.
   - Posts an operator performance bond.
   - Submits milestone evidence and settlement proposals.
   - Cannot unilaterally withdraw project funds, rewrite investor entitlements, mint arbitrary claims, or release their own bond.

5. **Installer / EPC Contractor**
   - Supplies and installs equipment under a contract.
   - Submits installation, commissioning, warranty, and safety evidence.

6. **Meter / Data Provider**
   - Supplies generation, import/export, and meter-quality data.
   - Data is signed or authenticated where possible.
   - A meter reading is an external fact; blockchain cannot independently prove that the physical meter is accurate.

7. **Verifier / Independent Reviewer**
   - Checks project milestones, meter evidence, disputes, and operator claims.
   - Should be operationally independent of the operator and beneficiary.

8. **Protocol Governance / Security Council**
   - Controls emergency pause and carefully scoped administrative functions through a multi-signature wallet.
   - Cannot arbitrarily confiscate user assets or change past settlement records.

9. **Oracle / Attestation Provider**
   - Relays off-chain facts (meter readings, asset prices, project status) to smart contracts.
   - Should use multiple sources, signatures, freshness checks, and fallback rules where feasible.

### 2.2 Keep roles separate

The operator is not the escrow agent, auditor, oracle, lender, and judge all at once. Combining all these roles creates conflicts of interest and a single point of failure.

Recommended separation:
- Operator: coordinates and submits.
- Smart contracts: enforce programmed rules and hold assets.
- Verifier: reviews external evidence.
- Multisig: approves exceptional administrative actions.
- Oracle: transports data, not decides commercial disputes.
- Users: retain withdrawal rights where contractually and technically available.

## 3. Two distinct collateral models — do not mix them up

### Model A (recommended): Operator performance bond

The manager/operator pledges crypto as *girvi* to demonstrate commitment to its operational duties.

Example:
- Operator posts 5,000 USDC-equivalent test tokens into `OperatorBondVault`.
- Bond is locked for the project term plus a claims/dispute window.
- Operator earns a disclosed management fee when verified milestones are accepted.
- If the operator commits a specifically defined breach (e.g., falsified milestone evidence, unauthorized action, or failure to meet a controllable contractual duty), a dispute process can slash a defined portion.
- If obligations are completed and no valid claim remains, the bond is released to the operator.

Important limitations:
- The bond is not a guarantee of all project principal or energy output.
- A token's market value can fall; stablecoins also have issuer, depeg, freeze, custody, and chain risks.
- Slashing must not be triggered by a vague “bad performance” judgment.
- A bond should be sized using risk analysis, not an arbitrary large number.
- Use a dispute window, evidence requirements, and independent review before slashing except for narrowly defined emergency freezes.

### Model B: Borrower / project collateralized financing

A project owner or borrower pledges crypto to secure a loan. This is a separate credit product:
- Lender advances a loan.
- Borrower posts eligible collateral.
- Contract calculates loan-to-value (LTV).
- If collateral value falls, borrower may top up or repay.
- If LTV breaches a liquidation threshold, collateral may be liquidated under disclosed rules.

This model introduces price-oracle, volatility, liquidation, borrower-protection, lending-law, and consumer-credit risks. Do not add it to the first hackathon version unless the project specifically needs crypto-backed lending.

**Recommendation:** Implement Model A as the hackathon innovation. Describe it as an operator performance bond, not as “the manager guarantees all investor money.”

## 4. Proposed Bright Ledger feature: Bonded Operator & Milestone Settlement

Suggested product name: **Bonded Operator Assurance (BOA)**.

The operator posts a bond and earns a reputation record based on completed, independently verified project milestones.

### 4.1 Innovative feature set

1. **Operator Bond Vault**
   - Dedicated contract per operator or project.
   - Stores token, amount, lock duration, bond owner, and release conditions.
   - No operator withdrawal while bond is locked.
   - Emits events for deposit, lock, claim, slash, and release.

2. **Milestone Escrow**
   - Funding is divided into milestone tranches.
   - Example milestones: site due diligence, equipment procurement, installation, commissioning, meter validation.
   - Funds release only after evidence is submitted and approved under the project's policy.
   - The operator can submit a release request but cannot approve their own request.

3. **Proof-of-Generation Settlement**
   - Meter readings are submitted with timestamp, meter identifier, project identifier, signature, and sequence number.
   - Validation checks reject stale, duplicated, out-of-order, or implausible readings.
   - Settlement uses approved kWh, not an operator-entered free-form number.
   - The dashboard distinguishes “reported”, “verified”, and “settled” energy.

4. **Revenue Allocation Engine**
   - Applies the signed project agreement's split to net distributable proceeds.
   - Example: 70% investor pool, 20% site owner, 10% operator/service reserve. These are illustrative only, not recommended commercial terms.
   - Fees, taxes, grid charges, maintenance, and reserve deductions must be disclosed before the project starts.
   - Rounding dust is assigned by a deterministic rule and logged.

5. **Renewable Attribute / Certificate Registry**
   - Records certificate identifiers, issuer, technology, generation period, quantity, geography, status, and retirement/transfer history.
   - Prevents double counting within Bright Ledger by enforcing unique IDs and state transitions.
   - A platform record is not automatically an officially recognized Renewable Energy Certificate (REC), carbon credit, or guarantee of environmental claims. Recognition depends on the relevant registry, standard, and jurisdiction.

6. **Operator Reputation Passport**
   - Tracks completed milestones, dispute outcomes, response times, and historical bond releases/slashes.
   - Avoid a single opaque “trust score”; show the underlying facts and dates.
   - Do not expose private identity data on a public chain.

7. **Dispute & Challenge Window**
   - Participants can challenge a milestone or settlement within a defined period.
   - Dispute freezes only the disputed tranche or claim, not every project asset.
   - An independent reviewer or agreed arbitration process decides.
   - A rejected claim returns to the normal workflow; a substantiated breach may trigger partial slashing.

8. **Emergency Circuit Breaker**
   - Pauses deposits, new funding, milestone releases, or settlement functions as appropriate.
   - Does not erase balances or permit an admin to seize assets.
   - Withdrawals of undisputed funds should remain available where safe.
   - Unpause requires documented review and multisig approval.

## 5. End-to-end operational and security flow

### Phase 0 — Protocol and project setup

1. Deploy reviewed contracts to a testnet.
2. Configure token allowlist, project templates, role registry, fee schedule, limits, and dispute windows.
3. Register project signatories and verifier addresses.
4. Publish the project agreement hash and version.
5. Set a project-specific multisig policy (e.g., 2-of-3 for routine admin actions, 3-of-5 for critical actions; exact threshold depends on the threat model).
6. Verify contract addresses and source code publicly.
7. Run test transactions and emergency-pause drills.

### Phase 1 — Participant onboarding

1. User creates account and connects a wallet.
2. Backend performs applicable identity, sanctions, fraud, and eligibility checks where required by law and the business model.
3. User proves wallet control by signing a nonce-based message.
4. Backend verifies signature, nonce expiry, chain ID, and replay protection.
5. User accepts terms and project risk disclosures.
6. Store sensitive identity documents off-chain in encrypted, access-controlled storage; store only necessary references or hashes on-chain.

Security notes:
- Never ask users for seed phrases or private keys.
- Use hardware-backed or reputable wallet security for privileged operators.
- Apply rate limits, bot protection, MFA for web accounts, and session revocation.
- Wallet connection is not identity verification.

### Phase 2 — Site listing and technical due diligence

1. Site owner submits proof of authority, location, roof area, shading, structural information, utility connection, and photos.
2. Operator coordinates a site assessment.
3. Qualified technical reviewer approves feasibility, grid interconnection path, equipment sizing, and safety requirements.
4. Store report off-chain; anchor its hash and version on-chain.
5. Project cannot enter funding until required checks pass.

### Phase 3 — Operator bond deposit

1. Operator selects an approved bond token.
2. UI shows token contract, network, amount, USD estimate, lock period, slashing conditions, and release conditions.
3. Operator approves only the exact token allowance needed (or uses permit-based approval if supported and audited).
4. Operator deposits to `OperatorBondVault`.
5. Contract verifies token allowlist, amount, minimum bond, project assignment, and lock duration.
6. Contract emits `BondDeposited` and `BondLocked`.
7. UI verifies transaction receipt and finality before displaying “Bond active”.

Controls:
- Do not accept arbitrary ERC-20 tokens.
- Reject fee-on-transfer, rebasing, or non-standard tokens unless explicitly supported and tested.
- Set per-operator and per-project caps.
- Bond owner must be the operator or an explicitly disclosed guarantor.
- Bond cannot be withdrawn by the operator while active.

### Phase 4 — Investor funding

1. Investors review project data, agreement, risks, fees, and target amount.
2. Each investor signs a contribution transaction.
3. Contributions enter a project-specific `ProjectEscrow`, not the operator's wallet.
4. Contract enforces minimum/maximum contribution, funding deadline, project cap, and investor eligibility flags where required.
5. If funding target is not met by deadline, define refund path.
6. If funded, project enters “funded / awaiting deployment” state.
7. All deposits, refunds, and status transitions emit events.

Controls:
- Per-wallet and global caps.
- No hidden admin minting of investor claims.
- Exact accounting per investor.
- Refund path tested before accepting funds.
- Reentrancy protection and checks-effects-interactions.
- Avoid mixing funds between projects.

### Phase 5 — Procurement, installation, and milestone release

1. Operator submits milestone request with evidence.
2. Evidence includes supplier invoice, delivery record, installer report, serial numbers, geotagged/time-stamped photos where appropriate, and verifier attestation.
3. Verifier reviews evidence independently.
4. Participants receive notification and challenge window begins.
5. If approved and unchallenged, contract releases only the approved tranche to the named vendor or approved destination.
6. Vendor payment is pull-based where possible; recipient withdraws from a credit balance.
7. If challenged, only the disputed tranche is frozen pending resolution.

Controls:
- Operator cannot approve own milestone.
- Vendor wallet changes require re-verification and timelock.
- Payment destination is allowlisted per milestone.
- Milestone amount cannot exceed the approved budget.
- Change orders require explicit approval and versioned agreement.

### Phase 6 — Meter onboarding and energy verification

1. Register meter ID, project ID, data provider, unit, timezone, and expected reporting interval.
2. Meter gateway signs readings or sends them through an authenticated provider API.
3. Oracle adapter validates source signature, freshness, sequence number, duplicate status, bounds, and project-meter binding.
4. Independent anomaly rules flag sudden spikes, impossible negative generation, stale data, missing intervals, and meter replacement.
5. Readings move through statuses: `REPORTED → VALIDATED → VERIFIED → SETTLED`.
6. Rejected or disputed readings remain visible with reason codes.
7. Periodic independent meter reconciliation is required for production deployment.

Important: The oracle is a bridge, not proof that a physical meter is honest. Use certified meters, secure installation, tamper seals, utility data where available, multiple attestations, and field audits.

### Phase 7 — Settlement and distribution

1. Calculate gross eligible energy value from the permitted sale/use arrangement.
2. Deduct only pre-agreed items: grid/market charges, taxes, maintenance, insurance, platform fees, and reserves.
3. Produce a signed settlement statement with period, kWh, tariff/value source, deductions, net proceeds, and allocation formula.
4. Verifier or authorized settlement role approves the statement.
5. Contract credits beneficiary balances according to the immutable project agreement.
6. Beneficiaries withdraw their balances themselves (pull payment).
7. Emit `SettlementProposed`, `SettlementApproved`, `CreditAllocated`, and `Withdrawal` events.
8. Provide downloadable receipts and on-chain transaction references.

Do not promise fixed returns. Energy generation, tariff, curtailment, downtime, maintenance, and regulatory arrangements can change actual proceeds.

### Phase 8 — Bond release, claim, or slashing

Normal release:
1. Project reaches completion or defined service period ends.
2. Claims window expires.
3. No unresolved valid claim remains.
4. Verifier confirms closeout.
5. Multisig/contract policy authorizes release.
6. Operator withdraws the bond.

Claim/slashing:
1. A participant submits a claim with a defined breach code and evidence.
2. Contract locks only the disputed bond amount.
3. Operator receives notice and response period.
4. Independent reviewer examines evidence.
5. A decision is recorded with rationale and evidence hash.
6. If upheld, only the pre-agreed penalty is slashed; if rejected, the locked amount is released.
7. Appeal path is available where practical.
8. All decisions are auditable.

Never implement an unrestricted `adminSlashAll()` function.

## 6. Smart contract architecture

Recommended modular contracts (names are illustrative):

- `BrightLedgerAccessManager`: role-based access and delayed privileged actions.
- `ProjectRegistry`: project metadata hash, lifecycle state, parties, and configuration.
- `OperatorBondVault`: operator bond deposits, locks, claims, partial slash, release.
- `ProjectEscrow`: segregated investor contributions, funding caps, refunds.
- `MilestoneEscrow`: milestone tranches, evidence references, challenge states, release.
- `MeterRegistry`: approved meter/provider mapping and reading sequence metadata.
- `EnergyOracleAdapter`: signed reading intake and validation interface.
- `SettlementEngine`: approved net proceeds and allocation math.
- `PayoutVault`: beneficiary credit balances and pull withdrawals.
- `CertificateRegistry`: renewable attribute IDs, transfers, retirement, and duplicate prevention.
- `DisputeManager`: claim lifecycle, challenge windows, reviewer decisions.
- `EmergencyController`: narrowly scoped pause/unpause functions.
- `AuditEventEmitter`: consistent event schema for monitoring and analytics.

Keep each contract small and focused. Avoid an upgradeable proxy in the first prototype unless the team understands initialization, storage layout, upgrade authorization, and timelock risks. Prefer immutable contracts for the demo.

### Suggested role matrix

| Role | Allowed | Not allowed |
|---|---|---|
| Site owner | List site, sign agreements, view project, claim payout | Release escrow or alter splits |
| Investor | Fund, view records, challenge within window, withdraw credit | Change project rules unilaterally |
| Operator | Submit milestones, coordinate vendors, propose settlement | Approve own claims, withdraw escrow, change splits |
| Verifier | Approve/reject evidence under policy | Move funds or alter investor balances |
| Oracle reporter | Submit signed meter data | Set tariffs or decide disputes |
| Settlement role | Trigger settlement after required approvals | Override verified readings or change split |
| Guardian multisig | Pause scoped functions, revoke compromised roles | Arbitrarily transfer user funds |
| Timelock admin | Execute pre-announced privileged changes after delay | Bypass delay for ordinary upgrades |

## 7. Security threat model and mitigations

### 7.1 Key and account compromise
Threat: operator, verifier, or admin key is stolen.

Mitigations:
- Multisig for privileged roles.
- Hardware wallets for signers.
- MFA and phishing-resistant authentication for web accounts.
- Role separation and least privilege.
- Timelock for role changes and upgrades.
- Emergency role revocation and key-rotation runbook.
- Never store private keys or seed phrases on the backend.

### 7.2 Rogue or colluding operator
Threat: operator fabricates evidence, redirects funds, colludes with vendor, or attempts self-approval.

Mitigations:
- Operator cannot approve own milestones.
- Independent verifier and separate payout authority.
- Vendor allowlist and change-delay.
- Signed, versioned project agreement.
- Milestone evidence hashes and audit logs.
- Bond claim only through objective, pre-defined breach process.
- Random field inspections and participant challenge window.

### 7.3 Smart contract exploit
Threat: reentrancy, access-control flaw, arithmetic error, signature replay, unsafe token behavior, logic bug.

Mitigations:
- Use audited standard libraries (e.g., OpenZeppelin) rather than custom primitives.
- Checks-effects-interactions; reentrancy guard on external-value paths.
- Safe ERC-20 handling and token allowlist.
- Solidity 0.8+ checked arithmetic; explicit bounds and invariant checks.
- EIP-712 typed signatures with chain ID, contract address, nonce, deadline, and domain separation.
- Fuzzing, invariant testing, static analysis, testnet adversarial testing.
- Independent audit before mainnet or real value.
- Minimize contract complexity and external calls.

### 7.4 Oracle / meter manipulation
Threat: false generation readings, replayed messages, compromised gateway, meter swap.

Mitigations:
- Signed readings, unique sequence numbers, timestamps, freshness windows.
- Meter ID bound to a project.
- Multiple independent sources or utility reconciliation.
- Plausibility bounds and anomaly detection.
- Hardware tamper controls and field audits.
- Do not settle on unverified or stale readings.
- Oracle outage should stop settlement rather than invent a value.

### 7.5 Collateral depeg / price volatility
Threat: bonded token loses value or becomes frozen/unavailable.

Mitigations:
- Use a narrow allowlist of reviewed assets.
- Display asset and issuer risks.
- Apply conservative haircuts and minimum bond coverage.
- Monitor depeg and liquidity thresholds.
- Pause new project admission if bond coverage becomes inadequate.
- Do not auto-liquidate an operator performance bond based only on a market-price feed; its purpose is performance security, not a leveraged loan.
- If collateralized lending is ever added, implement a separate risk engine, conservative LTV, liquidation buffer, oracle circuit breakers, and borrower notice rules.

### 7.6 Frontend / API / database compromise
Threat: attacker changes displayed payout address, project details, or evidence.

Mitigations:
- Backend never controls on-chain funds.
- Verify contract events and balances from chain, not only database values.
- Signed API responses for critical off-chain attestations.
- TLS, secure headers, CSRF protection, rate limiting, input validation.
- Secrets manager; no secrets in frontend bundles or Git.
- Database least privilege, encryption at rest, backups, audit logs.
- Withdrawal destination shown clearly and confirmed by wallet signature.
- Alert users about address changes.

### 7.7 Denial of service and transaction manipulation
Threat: spam, gas spikes, front-running, chain congestion, stuck transactions.

Mitigations:
- Rate limits, per-wallet caps, minimum transaction sizes.
- Deadline and nonce checks.
- Slippage/price bounds if swaps are ever introduced.
- Do not rely on transaction ordering for fairness.
- Retryable off-chain queues with idempotency keys.
- Clear pending/confirmed/finalized transaction states.
- Use a chain with suitable security and predictable finality; document chain outage risk.

### 7.8 Governance capture / insider abuse
Threat: one admin changes beneficiaries, contract logic, or pause settings.

Mitigations:
- Multisig with independent signers.
- Timelock for sensitive changes.
- Publicly visible proposal and execution events.
- No single EOA as super-admin.
- Scope pause permissions narrowly.
- Emergency pause does not equal confiscation.
- Regular access review and signer rotation.

## 8. Failure and incident response playbooks

| Incident | Immediate response | Recovery |
|---|---|---|
| Suspected contract exploit | Guardian pauses affected functions | Independent triage, disclose, patch/deploy after review |
| Operator key compromise | Revoke operator role; freeze new claims | Reassign operator; review pending milestones |
| Verifier compromise | Suspend verifier; pause affected approvals | Re-verify affected claims with independent reviewer |
| Oracle outage | Stop new settlement calculations | Resume only after source health and data reconciliation |
| Meter anomaly | Mark affected readings disputed | Field inspection and corrected signed data |
| Stablecoin depeg | Stop new deposits in affected asset | Apply published contingency and withdrawal policy |
| Disputed milestone | Freeze only disputed tranche | Independent decision and appeal |
| Chain congestion/outage | Show pending state; do not mark as paid | Resume after finality; reconcile duplicate submissions |
| Database breach | Isolate service, rotate secrets, preserve logs | Restore from clean backup; notify affected users as required |

Every incident should have:
- Incident commander and escalation contacts.
- Timestamped incident log.
- Scope and affected project IDs.
- User communication plan.
- Evidence preservation.
- Recovery approval and postmortem.
- Root-cause remediation and regression tests.

## 9. Financial controls and example

Illustrative testnet example only:

- Project funding target: 20,000 test USDC.
- Operator performance bond: 1,000 test USDC.
- Funding: held in `ProjectEscrow`.
- Operator bond: held separately in `OperatorBondVault`.
- Milestone 1: 20% after verified procurement.
- Milestone 2: 50% after installation evidence.
- Milestone 3: 30% after commissioning and meter validation.

The operator does not receive the 20,000 project pool. Vendors receive only approved milestone amounts. The 1,000 bond remains locked under its own terms. A proven breach may cause a defined partial slash; successful completion releases it.

Example energy distribution (illustrative, subject to contract and law):
- Net distributable proceeds: 100 units.
- Investor pool: 70 units.
- Site owner: 20 units.
- Operations reserve: 10 units.

The platform must state whether investor entitlement is a loan, revenue share, ownership interest, service credit, or other legal right. Do not call all of these “investment tokens” interchangeably.

## 10. Professional crypto and energy terminology

| Term | Meaning in Bright Ledger |
|---|---|
| Collateral | Asset pledged to secure an obligation |
| Performance bond | Collateral securing an operator's contractual performance |
| Security deposit | Refundable amount held against specified obligations |
| Escrow | Assets held under conditional release rules |
| Custody | Safekeeping/control of assets or private keys |
| Non-custodial | Platform does not control users' private keys or freely move their assets |
| Multisig | Wallet requiring multiple authorized signatures |
| Role-based access control (RBAC) | Permissions assigned to defined roles |
| Timelock | Delay between privileged action scheduling and execution |
| Slashing | Forfeiture of bonded assets after a defined breach |
| Oracle | System that relays off-chain data to smart contracts |
| Proof of Reserve | Evidence that specified assets/reserves exist to back liabilities or tokens |
| LTV | Loan value divided by collateral value |
| Liquidation threshold | LTV/health boundary that triggers collateral liquidation in a lending design |
| Haircut | Conservative discount applied to collateral valuation |
| Reentrancy | Bug where external callbacks re-enter a function before state is safely updated |
| Pull payment | Beneficiary withdraws an accrued credit instead of contract pushing funds |
| Circuit breaker | Emergency control that halts selected functions |
| P2P energy trading | Bilateral or platform-coordinated energy transactions between participants, subject to market rules |
| REC / EAC | Renewable Energy Certificate / Energy Attribute Certificate; formal recognition depends on registry and jurisdiction |
| Curtailment | Reduction of generation or delivery due to grid/system constraints |
| Net settlement | Distribution after approved deductions |
| Attestation | Signed assertion about an off-chain fact |
| Tokenization | Digital representation of a right, claim, asset, or accounting unit; token alone does not create legal ownership |

## 11. What should be built for the hackathon

### MVP scope
1. Roles: Site Owner, Investor, Operator, Verifier, Buyer.
2. Project creation and rooftop listing.
3. Operator bond deposit on Sepolia using test ERC-20.
4. Investor test funding into isolated project escrow.
5. Three milestone states with mock evidence hashes.
6. Verifier approval and challenge window.
7. Mock smart-meter data with `REPORTED / VALIDATED / VERIFIED` states.
8. Settlement preview and pull-based test-token withdrawal.
9. Bond release after project closeout.
10. Admin pause demo and public event/audit timeline.

### Explicitly out of scope for the hackathon
- Real crypto deposits or real-money lending.
- Guaranteed investor returns.
- Real electricity sale or grid dispatch without utility/regulatory arrangements.
- Claiming mock readings are certified meter data.
- Claiming test tokens are redeemable or have monetary value.
- Production-grade legal identity verification or custody.
- Unreviewed contract upgrades or admin-controlled confiscation.

### Demo storyline
1. Rooftop owner lists a 1,000 sq. ft. site.
2. Operator posts a 1,000 test-token performance bond.
3. Three investors collectively fund a 10,000 test-token project.
4. Operator submits procurement milestone evidence.
5. Verifier approves; milestone escrow releases to the approved vendor.
6. Mock meter reports 100 kWh; oracle adapter validates and verifier confirms it.
7. Settlement engine calculates illustrative allocations.
8. Beneficiaries withdraw test-token credits.
9. Project closes and operator bond is released.
10. Show an adversarial scenario: invalid meter sequence or disputed invoice freezes only the affected tranche.

## 12. India and deployment considerations

Bright Ledger's hackathon prototype should use Sepolia testnet and test tokens only. Do not accept real crypto or market the operator bond as a regulated financial product without specialist legal review.

For an India-facing deployment, obtain current advice on:
- Virtual Digital Asset (VDA) classification, tax treatment, and reporting.
- Whether the activity makes the platform a VDA service provider or reporting entity under applicable PMLA/FIU-IND rules.
- Securities, collective investment, lending, deposit-taking, and payment-system implications of pooled project funding and revenue entitlements.
- Electricity Act, state regulations, distribution licensee/utility rules, open access, net metering, group/captive arrangements, and local P2P permissions.
- Data protection, consumer protection, KYC/AML, sanctions, and cybersecurity obligations.
- REC/EAC issuance, transfer, and retirement rules under the relevant registry and market.

A blockchain record does not override electricity regulation, property rights, contract law, or financial-services regulation.

## 13. Production readiness checklist

### Governance
- [ ] Operator, verifier, oracle, and admin roles separated.
- [ ] Multisig signers are independent and documented.
- [ ] Timelock configured for privileged changes.
- [ ] Emergency pause and recovery runbook tested.
- [ ] Role revocation and key rotation tested.

### Contract security
- [ ] Independent review/audit completed.
- [ ] Static analysis and fuzz testing run.
- [ ] Invariants tested: no over-withdrawal, no double settlement, no unauthorized slash.
- [ ] Reentrancy and access-control tests pass.
- [ ] Token allowlist and decimal handling tested.
- [ ] Replay protection and signature domain separation tested.
- [ ] Refund, cancellation, dispute, and emergency paths tested.
- [ ] No unrestricted admin transfer or slash function.

### Collateral
- [ ] Bond amount and coverage methodology documented.
- [ ] Token issuer, depeg, freeze, and liquidity risks disclosed.
- [ ] Lock, release, and slash rules are objective and versioned.
- [ ] Bond is segregated from project escrow.
- [ ] Disputed amount only is locked during a claim.
- [ ] No automatic price liquidation for the operator bond.

### Energy data
- [ ] Meter/provider identity verified.
- [ ] Reading signature, timestamp, sequence, and freshness checked.
- [ ] Duplicate and anomalous readings rejected/flagged.
- [ ] Independent reconciliation process exists.
- [ ] Mock and real data are clearly distinguished.
- [ ] Certificate IDs and retirement states prevent platform-level double counting.

### Operations
- [ ] Incident response plan and contact tree exist.
- [ ] Monitoring for unusual deposits, withdrawals, role changes, and oracle gaps.
- [ ] Backups and recovery drills completed.
- [ ] User-facing status distinguishes submitted, confirmed, finalized, and settled.
- [ ] Privacy review and data retention policy completed.

## 14. Reference projects and technical references

These are useful design references, not endorsements or proof that Bright Ledger's proposed model is legally deployable.

1. **Powerledger — Energy trading and traceability**  
   https://powerledger.io/platform/  
   Reference for P2P energy trading, energy provenance/flow, and environmental commodity trading including renewable energy certificates.

2. **Ethereum.org — Smart contract security**  
   https://ethereum.org/developers/docs/smart-contracts/security/  
   Reference for role-based access control, multisig, independent review, audits, timelocks, and incident recovery.

3. **OpenZeppelin Contracts — Security utilities**  
   https://docs.openzeppelin.com/contracts/5.x/api/utils  
   https://docs.openzeppelin.com/contracts/5.x/api/access  
   Reference for pausing, reentrancy protection, access management, and role-based controls. Check the exact library version used by the project.

4. **OpenZeppelin — Securing onchain systems FAQs**  
   https://www.openzeppelin.com/faqs/securing-onchain-systems  
   Reference for common attack vectors, least-privilege access control, multisig, timelocks, and emergency response.

5. **Chainlink — Proof of Reserve**  
   https://chain.link/proof-of-reserve  
   Reference for on-chain reserve verification, collateral transparency, and safeguards against under-backed issuance. This is a reference concept; it does not automatically verify Bright Ledger's operator bond or physical solar assets.

6. **Income Tax Department of India — Virtual Digital Assets**  
   https://wmstatic-prd.incometaxindia.gov.in/web/guest/w/virtual-digital-assets-2  
   Reference for India's statutory VDA definition and tax context. Obtain current legal advice for the actual business model.

7. **FIU-IND — Downloads and VDA-related guidance**  
   https://fiuindia.gov.in/files/Downloads/Downloads.html  
   Reference for current AML/CFT guidance and VDA service-provider registration materials. Applicability must be assessed by counsel.

## 15. Recommended final positioning

**Bright Ledger — A transparent marketplace for shared solar projects and peer-to-peer energy value exchange, secured by bonded operators, milestone escrow, and verifiable energy settlement.**

Suggested feature name:
**Bonded Operator Assurance (BOA)**

Suggested concise pitch:
“Bright Ledger introduces a bonded project operator who stakes a refundable performance bond, coordinates rooftop solar project execution, and submits evidence-backed milestones. Investor funds remain segregated in smart-contract escrow; independent verifiers approve releases; meter data is validated before settlement; and all allocations are auditable. This aligns operator incentives without giving one manager unrestricted custody of participant funds.”

**Critical disclaimer:** This is a hackathon architecture proposal. It is not a guarantee against theft, insolvency, oracle manipulation, physical meter fraud, chain failure, stablecoin depeg, or legal/regulatory risk. Real-value deployment requires independent smart-contract audits, operational controls, verified energy data, and jurisdiction-specific legal review.
