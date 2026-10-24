# Bridge Ledger

## Hackathon Requirements, Product Specification & Judging Playbook

**Event:** IEEE ClimateChain Global Hackathon 2026\
**Track:** Renewable Energy & Energy Trading\
**Project category:** Blockchain · Climate Tech · Peer-to-Peer Energy ·
Optional AI\
**Document purpose:** One source of truth for the problem, solution,
scope, requirements, architecture, implementation, demo, and judging
preparation.

> **Naming note:** This document uses **Bridge Ledger** as the project
> name, matching the latest project brief. Earlier branding material
> used "Bright Ledger." Confirm the final spelling and use it
> consistently in the Devpost submission, UI, repository, demo video,
> and slides.

------------------------------------------------------------------------

## 1. Executive Summary

Bridge Ledger is a prototype platform that connects **rooftop/space
owners, solar investors, and energy participants** to make community
solar projects easier to discover, fund, account for, and audit. It
combines project matching, simulated fractional funding, transparent
energy-generation records, agreed revenue-share calculations, and
clean-energy impact reporting.

The project addresses a practical gap: a person may have a suitable
rooftop or parcel but lack the upfront capital for solar installation,
while another person may have capital but no suitable site. Bridge
Ledger models how these parties can coordinate through a shared project
record and clear rules.

For the hackathon, Bridge Ledger should demonstrate a complete, credible
proof of concept rather than claim to operate a live electricity market.
Use test wallets, simulated balances, sample meter readings, and
non-cash points. Clearly label every estimate and simulated transaction.
Real electricity sales, investment products, token redemption, and grid
dispatch require jurisdiction-specific approvals and real-world
partners.

**One-line pitch:** *Bridge Ledger turns unused solar-ready space into
traceable community-solar projects, with transparent funding, energy
accounting, and climate-impact evidence.*

## 2. Hackathon Context and Track Alignment

### 2.1 Event context supplied in the project brief

The IEEE ClimateChain Global Hackathon 2026 invites solutions using
blockchain, AI, and data-driven approaches to address climate
challenges. The supplied event description highlights transparency,
accountability, efficient climate action, carbon markets, renewable
energy, sustainable supply chains, climate data, and alignment with
global climate goals.

The supplied Devpost text lists: - **Track:** Renewable Energy & Energy
Trading - **Challenge:** Enable decentralized and efficient energy
systems - **Problem:** Energy markets remain centralized and inefficient
despite renewable growth - **Example build directions:** Peer-to-peer
energy trading, renewable certificate tracking, microgrid coordination
systems, and tokenized incentives for clean energy

The supplied deadline is **25 October 2026 at 7:30 PM GMT+5:30**.
Re-check the live Devpost page before submission in case the event page
or deadline changes.

### 2.2 Why Bridge Ledger belongs in this track

Bridge Ledger contributes to the track by: 1. Making solar-ready spaces
discoverable to project funders. 2. Modeling fractional project funding
with transparent contribution records. 3. Recording energy-generation
batches and allocation calculations. 4. Providing auditable project
settlement and renewable-evidence records. 5. Showing how clean-energy
incentives could be administered without pretending that a token
automatically has monetary value.

### 2.3 Scope boundary

The hackathon prototype is a **coordination, accounting, and
verification prototype**. Unless real integrations and approvals are
obtained, it does not: - physically route electricity between
households; - replace a distribution utility, meter, grid operator, or
energy supplier; - guarantee investment returns, energy savings, or
token value; - independently prove that a submitted meter reading is
true; - issue legally recognized renewable-energy certificates or carbon
credits.

## 3. Problem Statement

### 3.1 Core problem

Renewable-energy adoption can be constrained by fragmented coordination
among people who have suitable space, people who can finance
installations, and people or organizations that may benefit from the
generated energy. Project information, contribution terms, generation
data, ownership/revenue shares, and impact claims can be difficult to
keep consistent and auditable across participants.

### 3.2 Specific pain points

-   **Capital-access gap:** A rooftop owner may not be able to pay the
    upfront installation cost.
-   **Space-access gap:** A potential solar investor may lack a suitable
    installation site.
-   **Coordination friction:** Finding a site, agreeing on terms, and
    tracking contributions may require multiple disconnected processes.
-   **Opaque accounting:** Participants need a clear record of who
    contributed what and how project benefits are calculated.
-   **Weak evidence trails:** Generation and environmental claims are
    less credible when data sources and verification status are unclear.
-   **Reward confusion:** "Tokens" can be mistaken for money or carbon
    credits even when there is no issuer, buyer, backing, or redemption
    mechanism.

### 3.3 Problem statement for Devpost

> Solar-ready rooftops and potential solar funding are often
> disconnected. Rooftop owners may lack upfront capital, while
> prospective funders may lack suitable sites and a transparent way to
> track project contributions, energy generation, and agreed benefits.
> Bridge Ledger prototypes a shared, auditable workflow for matching
> sites with funders, recording project contributions and generation
> evidence, calculating pre-agreed shares, and reporting climate-related
> metrics---without requiring the hackathon team to finance a real
> installation.

## 4. Proposed Solution

Bridge Ledger offers a role-based workflow:

1.  A **Space Owner** lists a rooftop or site with location, usable
    area, ownership/permission status, and supporting evidence.
2.  The platform estimates indicative solar potential using clearly
    labelled assumptions or a data source.
3.  An **Investor/Funder** reviews the project and contributes simulated
    funds to a funding target.
4.  A project agreement stores the approved contribution and
    benefit-sharing rules.
5.  A generation record is submitted from a simulated meter feed or
    sample dataset.
6.  A verification step labels the record as pending, approved,
    rejected, or disputed.
7.  Approved generation records are used to calculate illustrative
    allocations and project metrics.
8.  The dashboard displays the audit trail, renewable energy recorded,
    allocation calculations, and estimated emissions avoided.

### 4.1 Core differentiator

The innovation is not merely a listing marketplace. It is the
combination of: - site-to-funder project matching; - fractional funding
simulation; - transparent, rule-based allocation calculations; -
evidence-linked generation records; - an auditable event history; -
carefully qualified climate-impact reporting.

### 4.2 Primary users

  -----------------------------------------------------------------------
  User                    Need                    Bridge Ledger
                                                  capability
  ----------------------- ----------------------- -----------------------
  Space owner             Find a funder without   Site listing, project
                          paying all installation proposal, agreement and
                          costs upfront           owner-share view

  Investor/funder         Evaluate a project and  Project details,
                          trace contributions     simulated funding,
                                                  contribution history,
                                                  share rules

  Energy                  Understand available    Project generation and
  participant/buyer       project energy and      allocation view;
                          recorded allocations    simulated buyer
                                                  workflow only

  Project verifier/admin  Review evidence and     Verification queue,
                          resolve questionable    evidence metadata,
                          records                 audit log

  Hackathon judge         Understand value        Demo mode, sample
                          quickly and inspect a   project, visible
                          working flow            calculations,
                                                  transaction timeline
  -----------------------------------------------------------------------

## 5. Goals, Non-Goals, and Success Measures

### 5.1 Goals

-   Demonstrate the end-to-end lifecycle of one community-solar project.
-   Make the distinction between on-chain records and off-chain evidence
    understandable.
-   Show an auditable funding and energy-accounting flow.
-   Deliver a smooth, responsive web UI that works on a laptop and
    mobile screen.
-   Present measurable climate-related indicators with explicit
    assumptions.
-   Provide a public code repository, setup instructions, tests, and a
    3--5 minute demo video.

### 5.2 Non-goals for the hackathon MVP

-   Building physical solar infrastructure.
-   Real-money crowdfunding or investment solicitation.
-   Live grid settlement or utility integration.
-   Legally enforceable energy delivery.
-   Trading a token on an exchange.
-   Issuing official carbon credits or renewable certificates.
-   Predicting guaranteed financial returns.
-   A production-grade identity/KYC or regulatory compliance system.

### 5.3 Proposed prototype success measures

These are **team-defined targets**, not official hackathon judging
weights: - A judge can complete the core demo in under 4 minutes. - At
least one sample project can move from listing to simulated funding to
generation record to settlement calculation. - Every simulated figure is
visibly labelled. - Every approved generation record shows its source,
timestamp, verifier/status, and linked transaction or record ID. -
Critical calculations have unit tests. - No private keys, secrets, or
real personal data are committed to the repository. - UI interactions
provide immediate feedback; asynchronous operations have loading,
success, and error states.

## 6. Product Scope and Priorities

### P0 --- Must build

1.  Landing page with clear problem, solution, and CTA.
2.  Role/demo selector or seeded demo accounts.
3.  Project marketplace with search/filter and project detail.
4.  Space-owner site/project submission form.
5.  Funding progress and simulated contributions.
6.  Project agreement with editable or seeded share percentages.
7.  Generation-record entry using sample meter data.
8.  Admin/verifier approval flow.
9.  Settlement calculator showing the math and assumptions.
10. Dashboard with energy, funding, participant shares, and estimated
    climate impact.
11. Transaction/audit history.
12. README, environment setup, tests for key calculations, and demo
    script.

### P1 --- Build if time allows

-   Wallet connection to a local chain or EVM testnet.
-   Smart-contract events displayed in the UI.
-   AI-assisted project matching based on location, area, and indicative
    generation.
-   Evidence file metadata and content hash.
-   Notifications and dispute status.
-   Exportable project report.

### P2 --- Future roadmap

-   Smart-meter integration and signed meter data.
-   Utility/aggregator integrations.
-   Formal verification/oracle infrastructure.
-   Role-based production identity verification.
-   Renewable certificate integrations with an authorized issuer.
-   Real payment rails and compliant settlement.
-   Multi-project portfolio and community microgrid coordination.

## 7. Functional Requirements

Use IDs to link implementation, tests, and the demo.

### 7.1 Identity and roles

-   **FR-001:** The application shall support Space Owner,
    Investor/Funder, Energy Participant, and Verifier/Admin roles.
-   **FR-002:** Demo mode shall provide seeded users or a role switcher
    that is clearly marked as a prototype convenience.
-   **FR-003:** Production-style authorization shall prevent ordinary
    users from approving their own submitted evidence.
-   **FR-004:** The application shall not request or store wallet seed
    phrases or private keys.

### 7.2 Site and project management

-   **FR-010:** A Space Owner shall be able to create a site listing
    with name, approximate location, available area, site type,
    permission status, and notes.
-   **FR-011:** A project shall display its funding target, funding
    progress, estimated capacity/generation, status, and assumptions.
-   **FR-012:** The application shall validate required fields and
    sensible numeric ranges.
-   **FR-013:** The UI shall distinguish owner-submitted information
    from independently verified information.
-   **FR-014:** Users shall be able to filter projects by status,
    region, target amount, or indicative capacity.
-   **FR-015:** The platform shall show a clear review/approval state
    before a listing is treated as verified.

### 7.3 Solar estimates and matching

-   **FR-020:** The system shall estimate indicative system capacity
    from usable area only when a documented assumption is configured.
-   **FR-021:** Every estimate shall show its units, source/assumption,
    and "estimate---not a guarantee" disclaimer.
-   **FR-022:** Matching shall rank projects using transparent criteria
    such as location, area, estimated generation, and funding status.
-   **FR-023:** If AI is included, the UI shall describe the
    recommendation as decision support and allow users to inspect the
    factors. AI is optional; a deterministic scoring baseline is
    acceptable and easier to explain.
-   **FR-024:** Missing solar or location data shall not be silently
    fabricated; the system shall show "not available" or a clearly
    labelled demo value.

### 7.4 Funding simulation

-   **FR-030:** An Investor/Funder shall be able to select a project and
    enter a simulated contribution.
-   **FR-031:** The system shall validate the contribution against the
    remaining target and demo balance.
-   **FR-032:** The project shall update its funding progress after a
    successful simulated contribution.
-   **FR-033:** Each contribution shall have an ID, contributor, amount,
    timestamp, project ID, and status.
-   **FR-034:** The UI shall label simulated balances and contributions
    as test/demo data.
-   **FR-035:** The application shall not represent a contribution as a
    real investment, payment, or guaranteed financial return.

### 7.5 Agreements and benefit shares

-   **FR-040:** A project agreement shall store the agreed share
    percentages or allocation rules for relevant participants.
-   **FR-041:** The system shall validate that share percentages sum to
    the configured total (normally 100%) and reject invalid agreements.
-   **FR-042:** Agreement changes shall be versioned; prior versions
    shall remain auditable.
-   **FR-043:** A user shall be able to inspect the calculation rule
    before accepting the demo agreement.
-   **FR-044:** The interface shall distinguish energy allocation from
    cash/revenue allocation. They are not interchangeable.

### 7.6 Generation and evidence

-   **FR-050:** The system shall accept a generation batch with project
    ID, interval, kWh, source, submission timestamp, and evidence
    reference.
-   **FR-051:** The record shall support Pending, Approved, Rejected,
    and Disputed states.
-   **FR-052:** A verifier shall be able to approve or reject a pending
    record with a reason.
-   **FR-053:** The application shall retain the original submitted
    value and create a correction/replacement record rather than
    silently overwriting an approved record.
-   **FR-054:** The system shall display the origin and verification
    status of each generation batch.
-   **FR-055:** Sample meter data must be clearly labelled as simulated.
-   **FR-056:** An optional evidence hash may be stored on-chain; the
    underlying document should remain off-chain unless there is a strong
    reason otherwise.

### 7.7 Settlement and rewards

-   **FR-060:** The system shall calculate allocations only from
    approved generation batches and the current applicable agreement
    version.
-   **FR-061:** The calculation output shall show the formula, inputs,
    units, rounding, and resulting shares.
-   **FR-062:** The system shall create an immutable settlement record
    or append-only audit event for each finalized calculation.
-   **FR-063:** The demo may award non-cash points for verified
    renewable generation or verified project milestones.
-   **FR-064:** Points shall be described as non-cash and non-redeemable
    unless an actual sponsor-backed redemption arrangement exists.
-   **FR-065:** The system shall not call points "carbon credits" or
    "official renewable certificates."
-   **FR-066:** If a batch is disputed or rejected, the system shall not
    include it in finalized settlement calculations.

### 7.8 Dashboard and audit

-   **FR-070:** The dashboard shall display energy recorded, approved
    generation, project funding progress, allocation summary, and
    estimated climate impact.
-   **FR-071:** Climate-impact estimates shall display the
    emissions-factor source, period, units, and calculation method.
-   **FR-072:** The user shall be able to view project events in
    chronological order.
-   **FR-073:** If blockchain is connected, the UI shall show network,
    transaction status, and transaction hash where available.
-   **FR-074:** Pending, confirmed, failed, and simulated transactions
    shall be visually distinct.
-   **FR-075:** The system shall provide a project-level report or
    export if time permits.

## 8. Non-Functional Requirements

-   **NFR-001 Performance:** Main dashboard interactions should feel
    immediate. Use optimistic UI only for reversible presentation state;
    never imply that a blockchain transaction is confirmed before
    confirmation.
-   **NFR-002 Responsiveness:** Support common mobile, tablet, and
    desktop widths without horizontal overflow.
-   **NFR-003 Accessibility:** Use semantic controls, keyboard
    navigation, visible focus, accessible labels, sufficient contrast,
    and status text not conveyed by color alone.
-   **NFR-004 Reliability:** Network and contract failures shall produce
    recoverable error messages and retry paths.
-   **NFR-005 Security:** Validate inputs on client and server; enforce
    role checks server-side; protect secrets; use least privilege.
-   **NFR-006 Data integrity:** Use database constraints and
    transactions for critical state transitions. Approved records must
    be append-only or versioned.
-   **NFR-007 Auditability:** Each material event shall have an
    actor/system identity, timestamp, target record, action, and result.
-   **NFR-008 Privacy:** Keep personal details and large evidence files
    off-chain. Store only the minimum metadata necessary.
-   **NFR-009 Transparency:** Clearly identify simulated values,
    estimated metrics, and unverified submissions.
-   **NFR-010 Maintainability:** Use typed interfaces, modular services,
    documented environment variables, and automated tests for
    calculations.
-   **NFR-011 Portability:** A new developer should be able to run the
    prototype using the README and a local database/blockchain setup.
-   **NFR-012 Observability:** Log errors and important state
    transitions without logging secrets or sensitive personal data.
-   **NFR-013 Cost awareness:** Prefer a local blockchain or low-cost
    EVM testnet and avoid requiring paid APIs for the demo.
-   **NFR-014 UX motion:** Use short, purposeful transitions; respect
    reduced-motion preferences; avoid animations that block task
    completion.

### 8.1 Performance acceptance targets for the prototype

These are proposed targets to measure, not claims of existing
performance: - Cached local navigation: target under 100 ms to visual
response on a typical laptop. - API read endpoints: target p95 under 500
ms in a local/demo environment. - Marketplace filtering: target under
150 ms for the seeded dataset. - Avoid loading large charting, wallet,
and map bundles until needed. - Use pagination or virtualization if
lists grow. - Show a loading indicator when an operation takes longer
than roughly 200 ms. - Do not block the whole page while a single panel
loads. - Measure actual results and document the test environment.

## 9. User Stories and Acceptance Criteria

### Story A --- Space Owner lists a site

**As a Space Owner**, I want to list a solar-ready site so potential
funders can evaluate it.

Acceptance: - Required fields are validated. - Indicative values include
assumptions and units. - Submission creates a project/site record. - The
record begins in a review state where appropriate. - The owner can view
and edit permitted fields.

### Story B --- Funder contributes to a project

**As a Funder**, I want to make a simulated contribution so the project
can show funding progress.

Acceptance: - The contribution is not allowed to exceed the configured
demo balance or remaining target. - The project progress updates only
after the contribution succeeds. - The contribution appears in the
history with a timestamp and status. - The UI clearly says "simulated
contribution."

### Story C --- Verifier approves a generation batch

**As a Verifier**, I want to review a submitted generation record so
only approved data affects settlement.

Acceptance: - Pending records appear in a review queue. - Approve/reject
actions require a reason or confirmation. - The state change is recorded
in the audit log. - Rejected/disputed records do not affect finalized
calculations.

### Story D --- Participant inspects settlement

**As a participant**, I want to see how generation is allocated so I can
understand the calculation.

Acceptance: - The formula, inputs, shares, and rounding are visible. -
Only approved batches are included. - The agreement version is shown. -
The result can be reproduced from the displayed inputs.

### Story E --- Judge evaluates climate impact

**As a judge**, I want to inspect project metrics and evidence so I can
judge whether the climate claims are credible.

Acceptance: - Renewable generation is shown in kWh. - Avoided-emissions
estimates state the emissions factor and source or explicitly identify a
demo assumption. - The UI separates measured, simulated, and estimated
values. - A transaction/event history is available.

## 10. Example Calculation Rules

All values below are illustrative demo data, not market forecasts or a
guarantee of financial return.

### 10.1 Funding progress

`funding_progress_percent = (total_successful_demo_contributions / funding_target) * 100`

Clamp the display to 0--100%, but preserve the underlying amounts.
Reject zero or negative targets.

### 10.2 Capacity estimate from area

If the prototype uses an area heuristic, configure an explicit
assumption such as `assumed_area_per_kw_m2`. Then:

`estimated_capacity_kw = usable_area_m2 / assumed_area_per_kw_m2`

This is only a rough prototype heuristic. Real capacity depends on
module efficiency, roof geometry, shading, setbacks, structural
constraints, and local conditions. Do not use the estimate as an
engineering design.

### 10.3 Generation allocation

For an approved batch of `approved_generation_kwh` and participant
allocation percentages:

`participant_energy_kwh = approved_generation_kwh * participant_energy_share_percent / 100`

Validate that shares sum to 100% if the agreement is designed to
allocate all energy. If some energy is reserved for losses, storage, or
unallocated surplus, model that explicitly instead of hiding it.

### 10.4 Illustrative value/revenue allocation

Only if the demo includes an explicitly hypothetical realized value:

`illustrative_value = eligible_kwh * assumed_value_per_kwh`

`participant_value_share = illustrative_value * participant_revenue_share_percent / 100`

The interface must say this is an illustrative accounting calculation,
not a real payment or promised return. Real settlement requires
permitted arrangements, actual metering, applicable tariffs, fees,
taxes, maintenance, and verified payment records.

### 10.5 Estimated avoided emissions

If an appropriate grid emissions factor is available:

`estimated_avoided_kg_co2e = eligible_renewable_kwh * grid_emissions_factor_kg_co2e_per_kwh`

Document the emissions factor's source, geography, date/year, and
methodology. If no defensible factor is available, show the renewable
kWh and mark avoided emissions "not calculated" or use a clearly
labelled demo assumption. Avoid double counting and do not describe the
result as an independently verified carbon credit.

### 10.6 Reward points

A simple demo policy might award points per approved milestone or per
defined energy band. Keep the policy configurable and show it to users.
Points have no monetary value unless a real sponsor or redemption
mechanism defines one.

## 11. Technical Architecture

### 11.1 Recommended hackathon architecture

``` text
┌──────────────────────────────────────────────────────────┐
│ React + TypeScript Web App                              │
│ Marketplace · Project Detail · Funding · Evidence       │
│ Dashboard · Settlement · Audit Trail                    │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTPS / JSON API
┌─────────────────────────▼────────────────────────────────┐
│ Backend API (Node.js + Express or NestJS)                │
│ Auth/Roles · Validation · Project Service                │
│ Funding Service · Evidence/Verification · Metrics        │
│ Settlement Service · Audit/Event Service                 │
└──────────────┬────────────────────────┬──────────────────┘
               │                        │
┌──────────────▼─────────────┐  ┌───────▼──────────────────┐
│ PostgreSQL                 │  │ EVM Smart Contract       │
│ User/profile metadata      │  │ Project registry         │
│ Sites/projects             │  │ Contribution events      │
│ Contributions/agreements   │  │ Approved record hashes   │
│ Generation/evidence refs   │  │ Settlement references    │
│ Verification/audit records │  │ Testnet/local chain      │
└────────────────────────────┘  └──────────────────────────┘
               ▲                        ▲
               │                        │
┌──────────────┴─────────────┐  ┌───────┴──────────────────┐
│ Demo meter / sample data   │  │ Wallet client (optional) │
│ CSV/JSON fixtures          │  │ EVM wallet / test wallet  │
└────────────────────────────┘  └──────────────────────────┘
```

### 11.2 Technology recommendations

-   **Frontend:** React, TypeScript, Vite.
-   **UI:** Tailwind CSS or CSS Modules; a reusable component system.
-   **Data fetching:** TanStack Query or equivalent caching layer.
-   **Backend:** Node.js with Express for speed, or NestJS for
    structure.
-   **Database:** PostgreSQL; Supabase is an optional hosted shortcut.
-   **Blockchain:** Solidity with Hardhat or Foundry; local EVM for
    reliable demos, testnet if time and faucet access permit.
-   **Wallet:** Ethers.js or viem with an EVM-compatible wallet.
-   **Charts:** Recharts or a similarly lightweight charting library.
-   **Testing:** Vitest/Jest, API tests, and Solidity tests.
-   **Deployment:** Any team-accessible frontend/backend host; do not
    make a paid service a hard dependency.

### 11.3 Data placement rule

**On-chain:** project IDs, agreement/version hashes, contribution events
or references, approved generation-record hashes, settlement references,
and relevant status events---only where the contract needs public
auditability.

**Off-chain:** user profile details, contact information, exact private
addresses, evidence files, meter payloads, detailed operational data,
and large documents.

Do not put personal data or raw evidence documents on a public
blockchain. A hash proves that a later file matches the hashed content;
it does not prove the content itself was true.

## 12. Database Schema

A suggested relational model follows. Use UUIDs for application records
and store blockchain transaction hashes separately.

### 12.1 `users`

-   `id UUID PRIMARY KEY`
-   `display_name TEXT NOT NULL`
-   `email TEXT UNIQUE` (only if needed for the prototype)
-   `role TEXT NOT NULL CHECK (role IN ('space_owner','funder','energy_participant','verifier','admin'))`
-   `wallet_address TEXT NULL`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
-   `is_active BOOLEAN NOT NULL DEFAULT true`

### 12.2 `sites`

-   `id UUID PRIMARY KEY`
-   `owner_user_id UUID REFERENCES users(id)`
-   `name TEXT NOT NULL`
-   `site_type TEXT NOT NULL`
-   `region_label TEXT`
-   `usable_area_m2 NUMERIC CHECK (usable_area_m2 > 0)`
-   `permission_status TEXT NOT NULL`
-   `description TEXT`
-   `verification_status TEXT NOT NULL DEFAULT 'pending'`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
-   `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Avoid exposing exact residential coordinates publicly in the MVP.

### 12.3 `projects`

-   `id UUID PRIMARY KEY`
-   `site_id UUID NOT NULL REFERENCES sites(id)`
-   `title TEXT NOT NULL`
-   `description TEXT`
-   `funding_target NUMERIC NOT NULL CHECK (funding_target > 0)`
-   `currency_code CHAR(3) NOT NULL DEFAULT 'INR'` (demo display only
    unless real payments exist)
-   `estimated_capacity_kw NUMERIC`
-   `estimated_generation_kwh_month NUMERIC`
-   `estimate_method TEXT`
-   `status TEXT NOT NULL CHECK (status IN ('draft','review','open','funded','active','paused','completed','cancelled'))`
-   `chain_id BIGINT`
-   `contract_address TEXT`
-   `onchain_project_id TEXT`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### 12.4 `contributions`

-   `id UUID PRIMARY KEY`
-   `project_id UUID NOT NULL REFERENCES projects(id)`
-   `funder_user_id UUID NOT NULL REFERENCES users(id)`
-   `amount NUMERIC NOT NULL CHECK (amount > 0)`
-   `currency_code CHAR(3) NOT NULL`
-   `is_simulated BOOLEAN NOT NULL DEFAULT true`
-   `status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded'))`
-   `tx_hash TEXT`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### 12.5 `agreements`

-   `id UUID PRIMARY KEY`
-   `project_id UUID NOT NULL REFERENCES projects(id)`
-   `version INTEGER NOT NULL CHECK (version > 0)`
-   `energy_share_rules JSONB NOT NULL`
-   `revenue_share_rules JSONB NOT NULL`
-   `agreement_hash TEXT`
-   `status TEXT NOT NULL CHECK (status IN ('draft','proposed','accepted','superseded'))`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
-   `created_by UUID REFERENCES users(id)`
-   `UNIQUE(project_id, version)`

Validate share totals in application logic and tests; use a normalized
participant-share table if queries need to be more relational.

### 12.6 `generation_batches`

-   `id UUID PRIMARY KEY`
-   `project_id UUID NOT NULL REFERENCES projects(id)`
-   `period_start TIMESTAMPTZ NOT NULL`
-   `period_end TIMESTAMPTZ NOT NULL`
-   `generation_kwh NUMERIC NOT NULL CHECK (generation_kwh >= 0)`
-   `source_type TEXT NOT NULL`
-   `source_reference TEXT`
-   `evidence_hash TEXT`
-   `status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','disputed','superseded'))`
-   `submitted_by UUID REFERENCES users(id)`
-   `reviewed_by UUID REFERENCES users(id)`
-   `review_reason TEXT`
-   `chain_tx_hash TEXT`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
-   `CHECK (period_end > period_start)`

### 12.7 `settlements`

-   `id UUID PRIMARY KEY`
-   `project_id UUID NOT NULL REFERENCES projects(id)`
-   `agreement_id UUID NOT NULL REFERENCES agreements(id)`
-   `generation_batch_id UUID NOT NULL REFERENCES generation_batches(id)`
-   `calculation_inputs JSONB NOT NULL`
-   `allocation_results JSONB NOT NULL`
-   `estimated_value NUMERIC`
-   `is_simulated BOOLEAN NOT NULL DEFAULT true`
-   `status TEXT NOT NULL CHECK (status IN ('calculated','finalized','disputed','voided'))`
-   `chain_tx_hash TEXT`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### 12.8 `rewards`

-   `id UUID PRIMARY KEY`
-   `user_id UUID NOT NULL REFERENCES users(id)`
-   `project_id UUID REFERENCES projects(id)`
-   `points INTEGER NOT NULL CHECK (points >= 0)`
-   `reason TEXT NOT NULL`
-   `is_cash_redeemable BOOLEAN NOT NULL DEFAULT false`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### 12.9 `audit_events`

-   `id UUID PRIMARY KEY`
-   `actor_user_id UUID REFERENCES users(id)`
-   `entity_type TEXT NOT NULL`
-   `entity_id TEXT NOT NULL`
-   `action TEXT NOT NULL`
-   `before_data JSONB`
-   `after_data JSONB`
-   `request_id TEXT`
-   `tx_hash TEXT`
-   `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

### 12.10 Indexes and integrity

-   Index `projects(status, created_at)`.
-   Index `projects(site_id)`.
-   Index `contributions(project_id, status)`.
-   Index `generation_batches(project_id, status, period_start)`.
-   Index `audit_events(entity_type, entity_id, created_at)`.
-   Add idempotency keys for contribution and settlement creation.
-   Use database transactions for critical multi-record updates.
-   Never treat a client-submitted transaction hash alone as proof of a
    successful on-chain state change; verify receipt and expected
    event/contract state.

## 13. Smart Contract and Blockchain Design

### 13.1 What blockchain should do

Use blockchain for shared, tamper-evident records and enforceable state
transitions---not as a database for every UI detail. The contract can
record project registration, agreement hashes, contribution references,
generation evidence hashes approved by an authorized verifier, and
settlement references.

### 13.2 MVP contract modules

A single compact contract is acceptable for the hackathon. Possible
functions: - `createProject(projectRef, fundingTarget, agreementHash)` -
`updateAgreement(projectId, agreementHash, version)` subject to role and
state rules - `recordContribution(projectId, contributionRef, amount)`
for test-only accounting or actual testnet token handling -
`submitGenerationEvidence(projectId, batchRef, evidenceHash, generationWh)` -
`verifyGenerationEvidence(batchRef, approved)` restricted to authorized
verifier -
`recordSettlement(projectId, batchRef, settlementRef, allocationHash)` -
read functions for project status and record references

Function names are design suggestions, not an audited contract ABI.

### 13.3 Roles and state rules

-   Project creator may register a project but cannot self-approve
    generation evidence if the demo is modeling independent
    verification.
-   Only authorized verifier role may approve/reject evidence.
-   A generation batch may be settled only after approval.
-   Agreement versions should be immutable once referenced by a
    finalized settlement.
-   Use events for important changes.
-   Add explicit checks for duplicate IDs, invalid amounts, invalid
    state transitions, and unauthorized callers.
-   If a test token is used, make it unmistakably a test asset with no
    promised value.

### 13.4 Events

-   `ProjectCreated`
-   `AgreementUpdated`
-   `ContributionRecorded`
-   `GenerationEvidenceSubmitted`
-   `GenerationEvidenceVerified`
-   `SettlementRecorded`

Events should include stable identifiers and enough context to find the
corresponding off-chain record without publishing private data.

### 13.5 Oracle and data trust

Blockchain cannot independently know whether electricity was generated.
For the MVP, use a clearly labelled sample meter feed and a verifier
action. For a future system, consider signed meter readings, device
identity, trusted gateways, independent verification, anomaly detection,
and a dispute process. Explain the trust assumptions in the
presentation.

### 13.6 Security checklist

-   Use a current, reviewed OpenZeppelin access-control/reentrancy
    pattern where appropriate.
-   Avoid custom token economics unless necessary.
-   Use checks-effects-interactions when transferring assets.
-   Avoid storing private or personal data on-chain.
-   Pin compiler/dependency versions.
-   Run unit tests and static analysis available to the team.
-   Test unauthorized calls, duplicate submissions, invalid shares, and
    settlement before approval.
-   Never deploy with a real private key committed in source or `.env`
    tracked by Git.
-   Clearly disclose that a hackathon contract is not audited and not
    production-ready.

## 14. API Design

Example REST endpoints; adapt names to the implementation.

  ----------------------------------------------------------------------------------------
  Method                  Endpoint                                 Purpose
  ----------------------- ---------------------------------------- -----------------------
  GET                     `/api/projects`                          List/filter projects

  POST                    `/api/sites`                             Create site listing

  GET                     `/api/projects/:id`                      Project detail

  POST                    `/api/projects`                          Create project

  POST                    `/api/projects/:id/contributions`        Create simulated
                                                                   contribution

  GET                     `/api/projects/:id/contributions`        Contribution history

  POST                    `/api/projects/:id/agreements`           Create agreement
                                                                   version

  POST                    `/api/projects/:id/generation-batches`   Submit generation
                                                                   evidence

  GET                     `/api/verifications/pending`             List pending evidence

  POST                    `/api/generation-batches/:id/decision`   Approve/reject evidence

  POST                    `/api/projects/:id/settlements`          Calculate/finalize
                                                                   settlement

  GET                     `/api/projects/:id/audit`                Audit/event history

  GET                     `/api/dashboard/summary`                 Dashboard metrics
  ----------------------------------------------------------------------------------------

API rules: - Validate all input server-side. - Return consistent error
shapes with a safe message and request ID. - Use authentication and
authorization for non-demo deployments. - Make state-changing endpoints
idempotent where retries could duplicate contributions or settlements. -
Do not trust role, amount, verification state, or project totals
supplied by the browser.

## 15. UI/UX and Brand Requirements

### 15.1 Brand

Use the attached solar/sun logo direction consistently. The prior visual
direction is a premium, clean-energy fintech interface: - Deep forest
green for trust and primary surfaces. - Solar gold/yellow for sunlight,
highlights, and key calls to action. - Warm off-white for spacious,
readable backgrounds. - Dark green text, clear typography, restrained
shadows, and crisp line icons.

The name in this requirements document is **Bridge Ledger**. If the
final logo image still says "Bright Ledger," either update the logo
wordmark or make a deliberate project-name decision before the
submission. Do not mix both names across the product.

### 15.2 Required screens

1.  Landing / project overview.
2.  Sign-in or demo-role selection.
3.  Dashboard.
4.  Project marketplace.
5.  Project detail and solar estimate.
6.  Create/edit site listing.
7.  Funding contribution modal/page.
8.  Agreement and share rules.
9.  Generation evidence submission.
10. Verifier review queue.
11. Settlement breakdown.
12. Audit/transaction history.
13. Rewards and climate impact.
14. Settings/network status.

### 15.3 Smooth interaction rules

-   Use skeletons or local placeholders for data loading.
-   Debounce text search.
-   Cache stable reads and invalidate only affected queries after
    mutations.
-   Update local UI immediately for local-only actions, but label
    blockchain actions pending until confirmed.
-   Use pagination for larger tables.
-   Lazy-load charts and optional wallet/map features.
-   Avoid full-page reloads.
-   Use short transitions (roughly 150--220 ms) and respect reduced
    motion.
-   Keep filters and form values when users return from a detail page.
-   Provide empty, loading, success, failure, and retry states.
-   Make simulated/demo mode visible in the header or relevant
    transaction panel.

### 15.4 Visual hierarchy

Prioritize: 1. What the project is and its current state. 2. Funding
progress and estimated generation. 3. Evidence/verification status. 4.
Share calculation and assumptions. 5. Audit record and climate metrics.

Do not use a large climate-impact number without its units, period,
methodology, and estimate label.

## 16. Climate Impact Measurement

### 16.1 Indicators

-   Renewable generation recorded (kWh).
-   Approved renewable generation (kWh).
-   Number of solar-ready sites listed.
-   Number of projects funded in the simulation.
-   Number of participants coordinated.
-   Share of generation with evidence reviewed.
-   Estimated avoided emissions, only where a defensible factor is
    available.
-   Estimated capacity supported by the demo (kW), clearly labelled as
    an estimate.

### 16.2 Impact logic

Bridge Ledger's immediate contribution is enabling better coordination
and traceability. It does not itself create renewable electricity.
Climate impact depends on projects being installed and operated,
electricity actually generated, and credible measurement.

### 16.3 Avoid overclaiming

-   Separate **potential impact**, **simulated impact**, and **measured
    impact**.
-   Do not claim reductions in emissions solely because a project was
    listed or funded.
-   Do not claim carbon credits from an energy record.
-   Do not count the same generation toward multiple parties' exclusive
    environmental claims without a defined accounting method.
-   State that real-world impact requires installation, meter
    verification, and a defensible baseline/emissions factor.

## 17. Security, Privacy, and Risk Register

  -----------------------------------------------------------------------
  Risk                    Why it matters          Mitigation in MVP
  ----------------------- ----------------------- -----------------------
  Fake generation data    Can inflate impact or   Label demo data;
                          settlement              require verifier state;
                                                  retain evidence source

  Double counting         Same energy can be      Unique batch IDs,
                          allocated or claimed    period checks,
                          twice                   settlement idempotency

  Unauthorized approval   Participants could      Role checks; separate
                          approve their own       verifier role
                          claims                  

  Misleading token claims Points could be         Non-cash label; no
                          mistaken for            unsupported redemption
                          money/carbon credits    promise

  Smart contract bug      Incorrect state or loss Minimal contract,
                          of test assets          tests, no real funds,
                                                  disclose unaudited
                                                  status

  Wallet phishing/secrets Could compromise users  Never request seed
                                                  phrase; never store
                                                  private key

  Personal data on-chain  Public, persistent      Store only
                          disclosure              hashes/references
                                                  on-chain

  Fake financial          Users may assume        Show assumptions; no
  projections             guaranteed returns      guarantee language

  API/database            Could falsify off-chain Server-side validation,
  manipulation            data                    authorization, audit
                                                  logs

  AI bias or opaque       Could unfairly rank     Explain scoring
  matching                projects                factors; allow
                                                  inspection;
                                                  deterministic fallback

  Latency/network failure Breaks live demo        Seeded local mode,
                                                  clear retry state,
                                                  recorded backup demo

  Regulatory uncertainty  Real energy/investment  Prototype-only scope;
                          activity may require    no real money or
                          approvals               electricity sales
  -----------------------------------------------------------------------

## 18. Testing and Quality Plan

### 18.1 Unit tests

-   Funding progress and overfunding validation.
-   Area-to-capacity estimate using configured assumptions.
-   Share percentages sum to the required total.
-   Generation allocation and rounding.
-   Avoided-emissions calculation with units.
-   Reward policy.
-   State transition validation.
-   Rejected/disputed batch excluded from settlement.

### 18.2 API/integration tests

-   Create site and project.
-   Record a simulated contribution exactly once.
-   Submit a generation batch.
-   Reject unauthorized verification attempt.
-   Approve evidence and create settlement.
-   Verify audit events are written.
-   Handle invalid project IDs and malformed numeric values.

### 18.3 Smart-contract tests

-   Authorized project creation.
-   Unauthorized verifier call fails.
-   Duplicate batch reference rejected.
-   Settlement before evidence approval fails.
-   Invalid state transitions fail.
-   Events emit expected identifiers.
-   Agreement version changes do not rewrite prior settlement
    references.

### 18.4 UI acceptance checks

-   Core flow works at laptop and mobile widths.
-   Every action has loading/success/error feedback.
-   Keyboard focus is visible.
-   No hidden horizontal overflow.
-   All simulated amounts and climate estimates are labelled.
-   Wallet rejection and network mismatch are handled.
-   Demo can be reset to a known starting state.

## 19. Build Plan for a Small Hackathon Team

Given the supplied deadline, prioritize a working story over breadth.
The plan below is relative; adjust to actual remaining time.

### Phase 1 --- Lock the story

-   Confirm final spelling: Bridge Ledger or Bright Ledger.
-   Create one canonical project scenario and sample dataset.
-   Define the exact demo flow and the calculation formulas.
-   Assign owners for frontend, backend/data, contract, and pitch; one
    person may cover multiple roles.

### Phase 2 --- Build the vertical slice

-   Create project listing and detail.
-   Implement demo funding.
-   Submit generation batch and approve it.
-   Calculate settlement and update dashboard.
-   Add audit timeline.

### Phase 3 --- Add blockchain proof

-   Deploy a small contract locally or to a testnet.
-   Emit at least one meaningful event (for example, evidence verified
    or settlement recorded).
-   Show transaction status/hash in the UI.
-   If chain integration threatens completion, preserve a fully working
    local demo and explain the intended chain boundary honestly. Do not
    fake a real transaction.

### Phase 4 --- Harden and polish

-   Add input validation and role checks.
-   Test calculations and invalid state transitions.
-   Add loading/error states and mobile layout.
-   Verify README instructions on a clean environment.
-   Record a backup demo video.

### Phase 5 --- Submission

-   Publish source code and documentation.
-   Deploy a working demo if possible.
-   Record a 3--5 minute video.
-   Complete the Devpost description and track alignment.
-   Verify all links and submit before the posted deadline.

## 20. Devpost Submission Checklist

### Track alignment

-   [ ] Explicitly select **Renewable Energy & Energy Trading**.
-   [ ] State how Bridge Ledger addresses decentralized energy
    coordination and transparent accounting.
-   [ ] Explain the role of blockchain and any AI/data component.

### Project description

-   [ ] Problem and target users.
-   [ ] Solution and differentiator.
-   [ ] Core features.
-   [ ] Technical architecture and technology stack.
-   [ ] Climate impact approach and limitations.
-   [ ] Scalability and adoption path.
-   [ ] What is built versus simulated.
-   [ ] Risks and future work.

### Required deliverables from the supplied event description

-   [ ] **Demo video:** 3--5 minutes, showing the project in action.
-   [ ] **Code repository:** public GitHub or equivalent link, with
    source and documentation.
-   [ ] **Prototype/demo:** working prototype, mockup, or proof of
    concept.
-   [ ] **Submission before deadline:** verify the live Devpost page and
    time zone.

### Repository checklist

-   [ ] Clear README and project description.
-   [ ] Architecture diagram.
-   [ ] Setup and run instructions.
-   [ ] `.env.example` without secrets.
-   [ ] Sample/demo data.
-   [ ] Tests and test instructions.
-   [ ] Contract address/network only if genuinely deployed.
-   [ ] Screenshots and demo video link.
-   [ ] License if appropriate.
-   [ ] No API keys, private keys, seed phrases, personal data, or large
    private evidence files.

## 21. Demo Video Script (3--5 Minutes)

Target duration: approximately 4 minutes.

### 0:00--0:25 --- The problem

"Solar-ready rooftops and solar funding do not always meet. Owners may
lack upfront capital, while funders need a suitable site and a
transparent way to track project progress, generation, and agreed
benefits."

### 0:25--0:45 --- Introduce Bridge Ledger

"Bridge Ledger is a community-solar coordination and
verifiable-accounting prototype. It connects sites and funders, records
generation evidence, and makes allocation calculations auditable."

### 0:45--1:25 --- List and discover a project

Show a site/project, its area, status, indicative capacity, assumptions,
and funding target. Explain that estimates are not engineering
guarantees.

### 1:25--2:00 --- Simulated funding and agreement

Make a demo contribution. Show progress updating and reveal the agreed
share rules. State clearly that the contribution is simulated and no
real money is moved.

### 2:00--2:45 --- Generation evidence and verification

Submit a sample generation batch. Switch to the verifier role, inspect
the source/status, and approve it. Explain that blockchain preserves a
tamper-evident record but cannot independently prove a meter reading is
truthful.

### 2:45--3:25 --- Settlement and impact

Show the formula, approved kWh, share allocation, audit event, and
climate dashboard. Explain the emissions factor or label the metric as a
demo assumption.

### 3:25--3:50 --- Technical proof

Show the repository, smart contract event/transaction hash if
implemented, and one automated test. Do not show a fake transaction
hash.

### 3:50--4:10 --- Impact and next step

"Bridge Ledger does not claim to replace utilities or create
electricity. It demonstrates how transparent coordination and
evidence-linked accounting could support community solar, with real
deployment dependent on verified meters, energy partners, and local
rules."

## 22. Judging Criteria: How to Demonstrate Each One

The supplied Devpost description lists five criteria. No numeric weights
were included in the provided text, so do not assume a scoring
percentage.

### 22.1 Climate Impact

**Judges ask:** Does the solution address a real environmental challenge
and contribute to sustainability, transparency, renewable adoption,
carbon tracking, or ecosystem protection?

Demonstrate: - The capital/space coordination gap. - A full example
project with a generation record. - Renewable kWh with clear measurement
status. - A defensible emissions calculation or explicit reason it is
not calculated. - A clear path from prototype to actual installed
capacity and verified meter data.

Avoid: - Treating a listing or simulated contribution as emissions
reduction. - Unsupported carbon-credit claims. - Presenting estimated
generation as measured generation.

### 22.2 Innovation & Creativity

**Judges ask:** Is the idea fresh and does it apply blockchain/emerging
technology in a distinctive way?

Demonstrate: - Site-to-funder matching plus fractional funding
simulation. - Agreement-versioned share rules. - Evidence-linked
generation records. - Verifier-controlled approval and settlement
gating. - Optional transparent matching score or anomaly flag, if
genuinely implemented.

Explain why a shared audit trail adds value compared with an ordinary
CRUD marketplace.

### 22.3 Technical Execution

**Judges ask:** Does the project function as intended and use technology
effectively?

Demonstrate: - A live end-to-end flow. - Working calculations and
tests. - Actual contract code and an event/transaction if blockchain is
claimed. - Clear API/database design. - Error handling, role checks, and
honest transaction states.

Do not claim blockchain or AI integration that is only described in
slides.

### 22.4 Practical Usefulness

**Judges ask:** Could it realistically help communities, organizations,
policymakers, or businesses?

Demonstrate: - A plausible user journey for a rooftop owner and a
funder. - Transparent assumptions and agreement terms. - An adoption
path involving installers, site owners, funders, verifiers, and where
required utilities/aggregators. - A realistic scope boundary for legal
and operational requirements.

### 22.5 Presentation & Communication

**Judges ask:** Is the demo engaging and easy to understand, with the
problem, solution, and environmental impact communicated clearly?

Demonstrate: - A one-sentence pitch. - A single end-to-end scenario. -
Simple visual status labels: Simulated, Pending, Approved, On-chain,
Estimated. - A concise architecture explanation. - A strong final
statement about measured impact and future validation.

### 22.6 Judge-facing proof table

  -----------------------------------------------------------------------
  Criterion               Evidence to show        Common weakness to
                                                  avoid
  ----------------------- ----------------------- -----------------------
  Climate Impact          Approved generation     Big unsupported CO₂
                          record + impact formula number
                          and assumptions         

  Innovation              Site/funder matching +  Generic marketplace
                          traceable settlement    with no meaningful
                          workflow                ledger

  Technical Execution     Working flow, tests,    Screenshots only or
                          real contract event if  fake blockchain status
                          claimed                 

  Practical Usefulness    Roles, agreement,       Ignoring metering,
                          realistic deployment    utility, or regulation
                          path                    

  Presentation            Clear 3--5 minute story Too many features and
                          and readable UI         unclear demo data
  -----------------------------------------------------------------------

## 23. Final Recommended MVP Scenario

Use one consistent seeded scenario across UI, tests, and video.

-   **Site:** Demo Rooftop A
-   **Owner:** Demo Space Owner
-   **Project:** Community Solar Pilot
-   **Funder:** Demo Funder 1 and optionally Demo Funder 2
-   **Funding:** Simulated target and simulated contributions
-   **Generation:** One sample batch with a defined interval and kWh
    value
-   **Verification:** Pending → Approved
-   **Agreement:** Example shares, visibly marked as illustrative
-   **Settlement:** Calculation from approved generation and agreement
    version
-   **Impact:** Renewable kWh; emissions estimate only if the factor is
    documented
-   **Audit:** Timeline linking each action to its record/transaction ID

Use internally consistent values. Put the scenario data in a fixture
file so the frontend, backend, tests, and demo all show the same values.

## 24. Final Definition of Done

Bridge Ledger is ready for submission when: - \[ \] The project name and
logo are consistent everywhere. - \[ \] The track and problem statement
are explicit. - \[ \] A judge can complete the end-to-end flow without
developer intervention. - \[ \] The prototype clearly separates real,
simulated, estimated, and verified data. - \[ \] Funding, generation,
and share calculations are test-covered. - \[ \] At least one meaningful
blockchain interaction is implemented if blockchain integration is
claimed. - \[ \] Unauthorized and invalid state transitions are
blocked. - \[ \] Climate metrics show sources/assumptions and avoid
overclaiming. - \[ \] The UI is responsive and provides
loading/error/retry feedback. - \[ \] The repository contains code,
setup instructions, architecture, sample data, and tests. - \[ \] The
3--5 minute demo video shows the working product. - \[ \] The Devpost
submission has working links and is submitted before the verified
deadline.

## 25. References and Source Boundaries

This document is based primarily on the project brief and the IEEE
ClimateChain Global Hackathon 2026/Devpost information pasted by the
project owner in the conversation. It preserves the supplied track,
challenge, problem, submission requirements, prizes, and five judging
criteria.

**Not supplied in the pasted material:** official numeric judging
weights, detailed smart-contract rules, legal eligibility interpretation
for this specific project, or a definitive regulatory assessment. Check
the live event rules for eligibility, required forms, and the final
deadline. Technical architecture, database schema,
functional/non-functional requirements, acceptance criteria, and the
recommended build plan are project design recommendations created for
this prototype, not official IEEE requirements.

**Important disclaimer:** This is a hackathon product/engineering
specification, not legal, financial, engineering, investment, or
regulatory advice. A real energy-sharing or investment service requires
qualified local review, verified data, appropriate partners, and
applicable approvals.
