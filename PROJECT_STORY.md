# Bright Ledger — Project Story

## The Future of Energy

Bright Ledger is a prototype for making local renewable-energy activity easier to discover, coordinate, and review. It brings energy listings, proposed trades, evidence review, and community-solar project planning into one modular application.

Bright Ledger does not deliver electricity, verify meter readings independently, or process real-world investments. Its current escrow flow runs on Ethereum Sepolia testnet, and its community-solar investor-interest records are simulated and non-cash.

## Inspiration

Renewable energy is increasingly generated close to where people live and work. Rooftop solar is one example: it can create opportunities for local producers, consumers, and communities, but coordinating those participants is not always straightforward. People need ways to find compatible offers, compare terms, and keep a clear record of what each participant has agreed to do.

That coordination challenge inspired Bright Ledger. We wanted to explore how a shared digital marketplace could make local energy activity more visible while keeping the roles understandable: Energy Producers offer energy, Energy Consumers request or purchase it, Project Owners propose community-solar projects, and Investors can register interest.

The goal is not to replace utilities or existing energy markets. It is to prototype a flexible coordination layer that could be adapted to local rules and trusted data sources over time.

## What it does

Bright Ledger brings several related workflows together:

- **Energy marketplace:** Energy Producers can publish offers and Energy Consumers can submit requests with quantities, prices, locations, energy sources, and delivery windows.
- **Explainable matching:** Rules compare location, available quantity, price limits, and delivery timing to identify compatible listings.
- **Documented trade flow:** Participants confirm trade terms; the buyer funds testnet escrow; the seller submits delivery evidence; and the buyer can approve release or open a dispute. An authorized verifier can resolve a dispute by releasing or refunding the escrow.
- **Community-solar planning:** Any signed-in participant role can submit project and cost assumptions for independent review. Participants may register simulated interest and record simulated income allocations against the project's revenue-share agreement, but the prototype does not accept investments, verify real proceeds, transfer funds, or promise returns.
- **Optional AI assistance:** With explicit consent, AI can provide preliminary evidence triage or a project-plan advisory. Its output is advisory only; it cannot verify delivery, approve evidence, or validate project costs.

The platform records workflow information; it does not deliver electricity or prove that renewable energy was generated. Ethereum Sepolia escrow uses test ETH with no real-world value.

## How we built it

We built Bright Ledger as three connected workspaces:

- **Frontend:** React, TypeScript, and Vite provide the participant interface and connect to injected EVM wallets.
- **Backend:** A TypeScript and Express API handles accounts, marketplace operations, trade workflows, and PostgreSQL persistence.
- **Blockchain:** Solidity contracts and Hardhat tests support the testnet escrow lifecycle.

PostgreSQL stores application records and versioned schema migrations. The backend validates important trade transitions and checks contract receipts for chain-backed actions. The contract holds testnet escrow during a trade; the application does not hold users’ wallet keys. The system can also run locally with Docker Compose and a local EVM, while its hosted architecture separates the frontend, API, and database.

We kept matching rules deterministic so participants can understand why listings are considered compatible. AI features are optional, consent-gated, and separated from decisions that belong to people.

## Challenges we ran into

**Designing a fair trade lifecycle.** A peer-to-peer energy trade involves different responsibilities. The buyer should fund the purchase; the seller should provide delivery evidence; and the buyer should decide whether that evidence is acceptable. Treating each step as a distinct state helped make responsibilities clearer and reduced the risk of leaving a trade stuck without an understandable next action.

**Keeping the prototype honest about what it can prove.** A database entry is not proof that electricity reached a buyer, and a submitted file is not automatically authentic. We had to distinguish a recorded workflow from independently verified real-world outcomes, especially in project planning and environmental-impact language.

**Connecting off-chain records to on-chain escrow.** The application needs to coordinate user actions, API state, and contract events without taking custody of private keys. That required careful validation of transaction receipts and explicit handling of outcomes such as release, dispute, and refund.

**Making AI useful without making it authoritative.** Evidence and project details can be sensitive, and AI analysis can be incomplete or wrong. We made analysis opt-in and consent-gated, and designed it as a review aid rather than an automated approval or investment recommendation.

**Designing for different local energy markets.** Rules and infrastructure vary by region. The prototype therefore uses configurable listing information and transparent compatibility rules rather than assuming one universal energy-market process.

## Accomplishments that we're proud of

- We brought marketplace listings, matching, trade records, project planning, and evidence review into one coherent product experience.
- We implemented a buyer-funded testnet escrow flow with evidence review and a dispute path, instead of treating seller evidence as a payment.
- We made the participant terminology clearer and more professional: Energy Producer, Energy Consumer, Investor, and Project Owner.
- We opened project creation to every participant role while retaining independent approval for authorized verifiers and admins.
- We added a persistent simulated income-allocation record that follows project share terms without suggesting that money was paid.
- We kept AI advisory and optional, with user consent required before sending relevant information for analysis.
- We built a modular codebase with separate frontend, backend, and blockchain workspaces, plus automated backend and contract tests.
- We documented important limitations so prototype records and testnet transactions are not mistaken for verified energy delivery or real investment activity.

## What we learned

We learned that a trustworthy marketplace is as much about clear responsibilities and boundaries as it is about matching participants. Trade states, evidence expectations, and dispute resolution need to be understandable to everyone involved.

We also learned to be precise about claims. Blockchain can make selected records and escrow transitions auditable, but it cannot independently establish that an energy meter is accurate or that electricity was delivered. AI can help organize a review, but it cannot replace human judgment or trusted data. Those distinctions shaped both the implementation and the language used in the product.

Finally, building the frontend, API, database, and contract together reinforced the value of testing the complete lifecycle—not just individual screens or functions.

## What's next for Bright Ledger

Our next steps are to strengthen the foundations required for a responsible real-world pilot:

1. **Integrate trusted energy data** from meters, inverters, or authorized providers, with clear provenance and independent validation.
2. **Study local regulations and utility processes** before defining any real energy-trading or settlement workflow.
3. **Improve operational readiness** with monitoring, backups, load testing, privacy controls, and a documented process for disputes and privileged roles.
4. **Review smart contracts independently** and improve the security and recovery procedures before considering any non-testnet assets.
5. **Validate community-solar planning assumptions** with project developers and technical experts; keep investment functionality disabled until legal, financial, and governance requirements are addressed.
6. **Evaluate accessibility and usability** with Energy Producers, Energy Consumers, and community project stakeholders.

Bright Ledger is a starting point: a transparent, extensible prototype for exploring how local renewable-energy coordination could work. Any move beyond testnet and simulated records must be grounded in trusted data, local approvals, and independent review.
