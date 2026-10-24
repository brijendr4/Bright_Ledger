# Bright Ledger — Complete P2P Energy Trading App UI/UX & Frontend Design Specification
**Version:** 1.0  
**Purpose:** Design and build a complete, responsive, interactive blockchain-enabled peer-to-peer renewable-energy trading application for a hackathon.  
**Brand reference:** The attached Bright Ledger logo board.  
**Tagline:** *Clean Energy. Real Value.*

> This specification is a design and implementation handoff. It describes intended UX, architecture, and performance targets—not proof that a deployed product already meets them. Real meter integration, legal electricity-market permissions, payments, and production blockchain security must be validated separately.

---

## 1. Product vision

Bright Ledger connects renewable-energy producers and consumers through a transparent P2P trading workflow. Producers publish available energy, consumers submit requests, a matching engine proposes compatible trades, trade milestones are recorded, delivery evidence is reviewed, and eligible participants receive **demo incentive points**.

The app should feel like a polished climate-tech fintech product: calm, premium, trustworthy, easy to scan, and fast to operate. Take inspiration from high-quality Dribbble fintech and climate-tech dashboards without copying a specific designer's work.

### Core principles
1. **Clarity before decoration:** every screen explains the current state and next action.
2. **Responsive by default:** desktop, tablet, and mobile all support core workflows.
3. **Fast interactions:** local UI actions respond immediately; remote work is shown honestly as pending.
4. **Trust through evidence:** display source, timestamp, trade relationship, and verification state for energy readings.
5. **No fake success:** a submitted blockchain transaction is not the same as a confirmed or settled trade.
6. **Hackathon-friendly:** demo mode works without physical meters, a paid RPC service, or cash-funded rewards.
7. **Accessible:** keyboard navigation, readable contrast, visible focus, reduced-motion support, and useful screen-reader labels.

---

## 2. Brand system based on the supplied logo

The reference board shows:
- A circular sun-and-solar-panel symbol.
- Deep forest/teal green as the primary brand color.
- Warm solar gold/yellow for the sun and highlights.
- Warm off-white backgrounds.
- A refined serif “Bright Ledger” wordmark.
- The tagline “CLEAN ENERGY. REAL VALUE.”
- Dark, light, app-icon, and monochrome lockups.

Use the exact supplied logo asset wherever possible. Do not redraw it with emoji or replace it with a generic leaf/lightning symbol. Keep enough clear space around the logo and use the matching dark/light variant for the background.

### 2.1 Color tokens

These are implementation starting points estimated from the visual reference; verify against the original vector/logo file before final brand production.

| Token | Value | Use |
|---|---|---|
| Forest 950 | `#062F2A` | Deep hero, dark theme, primary brand |
| Forest 900 | `#0B3932` | Sidebar, primary button |
| Forest 800 | `#124A3E` | Hover and raised dark surface |
| Forest 700 | `#1D604D` | Secondary green |
| Solar 500 | `#F4BD36` | Main accent, generation highlights |
| Solar 400 | `#FFD15C` | Accent hover |
| Cream 50 | `#FAFAF5` | Main light background |
| Cream 100 | `#F2F2E9` | Subtle panels |
| White | `#FFFFFF` | Cards |
| Ink 950 | `#102C28` | Primary light-theme text |
| Ink 700 | `#40534E` | Secondary text |
| Ink 500 | `#687771` | Metadata |
| Border | `#E1E6DD` | Light surfaces |
| Dark border | `#2B5149` | Dark surfaces |
| Success | `#227A53` | Confirmed/healthy |
| Warning | `#A96812` | Attention/pending action |
| Danger | `#B53B35` | Error/rejection |
| Info | `#276B8A` | Informational status |

**Color rules**
- Green is the foundation; gold is the accent. Do not make every card gold.
- Never rely on color alone for statuses: use a label and, where useful, an icon.
- Ensure text contrast meets WCAG AA targets.
- Avoid glowing neon, excessive gradients, glassmorphism, and blurred panels. Use gradients only sparingly in marketing visuals.

### 2.2 Typography

- **Display / marketing:** DM Serif Display, Cormorant Garamond, or a licensed serif matching the logo's editorial feel.
- **App UI:** Inter or Manrope, with system fallbacks.
- **Numbers:** tabular numerals for balances, kWh, prices, and timestamps.

Suggested scale:
- Landing H1: 48–64 px desktop, 36–44 px mobile.
- Page title: 28–36 px desktop, 24–30 px mobile.
- Section title: 18–22 px.
- Card title: 15–18 px.
- Body: 14–16 px.
- Metadata: 12–13 px; never use metadata size for a critical warning alone.

Use serif typography sparingly. Tables, forms, navigation, and status labels should remain sans-serif for quick scanning.

### 2.3 Layout and shape

- Maximum content width: 1440 px.
- Desktop gutters: 32 px; tablet: 24 px; mobile: 16 px.
- Base spacing: multiples of 4 px.
- Standard card radius: 18 px.
- Large panels: 24 px.
- Inputs/buttons: 12 px.
- Borders before shadows; shadows reserved for menus, popovers, and overlays.
- Touch targets: aim for at least 44 × 44 px.

### 2.4 Theme modes

**Warm Light (default):** warm off-white page, white cards, dark-green text, forest-green primary buttons, solar-gold highlights.

**Forest Night (optional):** deep green page (`#071F1C`), raised green cards (`#0B302A`), cream-white text, gold accents, subtle dark-green borders.

Theme control must work. Respect `prefers-color-scheme` on first visit, then save the user's preference locally. Avoid a flash of the wrong theme during initial render.

---

## 3. Product roles and permissions

### Prosumer / energy seller
- Create, edit, pause, and cancel eligible energy offers.
- Review match proposals.
- Submit delivery evidence.
- View trades, audit history, and earned demo points.

### Consumer / energy buyer
- Browse and filter offers.
- Create energy requests.
- Review compatible matches and trade terms.
- Track evidence and settlement status.
- View activity history.

### Evidence reviewer / microgrid operator
- Review evidence assigned to their role.
- Approve or reject with a reason.
- View trade timeline and source metadata.
- Cannot approve their own submission unless an explicit policy allows it.

### Administrator
- Configure demo parameters, permitted network/contract settings, and role assignments.
- Review system health and audit events.
- Cannot bypass contract permissions or rewrite immutable on-chain history.
- Admin actions must be authorized on the server and, where applicable, by the contract.

For a hackathon demo, one account may switch between demo roles, but the UI must visibly label this as a demo feature.

---

## 4. Information architecture and navigation

### Desktop sidebar
1. Overview
2. Energy Market
3. My Offers
4. My Requests
5. Trades
6. Renewable Evidence
7. Rewards
8. Activity / Audit
9. Settings

Sidebar footer:
- Network status.
- Wallet address, shortened with copy action.
- Theme toggle.
- Help and demo-data disclosure.

### Mobile bottom navigation
- Home
- Market
- Trades
- Rewards
- More

Put less-frequent screens (Evidence, Offers, Requests, Audit, Settings) inside “More” or contextual links. Do not squeeze a desktop sidebar into a narrow phone viewport.

### Primary user journeys

**Publish energy:** Overview → Create Offer → Enter quantity/price/time window/microgrid → Review → Publish → Offer appears in My Offers.

**Request energy:** Market → Filter listings → Open offer → Request Match → Review terms → Confirm request.

**Follow trade:** Trades → Trade Detail → View timeline → Submit evidence → Wait for review → View settlement and points.

**Review evidence:** Evidence Queue → Open item → Inspect source and interval → Approve or reject with reason → Timeline updates.

**Verify activity:** Activity/Audit → Filter events → Open details → Copy transaction hash or visit configured explorer.

---

## 5. Global application shell

### Desktop
- Collapsible left sidebar, approximately 248 px expanded.
- Top bar with page context, search/quick action where relevant, network/wallet indicator, notifications, and avatar/menu.
- Main content area with consistent page gutters and responsive grid.
- Avoid nested scrolling containers except for deliberate table/list panels.

### Mobile
- Compact top bar with logo mark, screen title, and wallet/network status.
- Bottom navigation with clear selected state.
- Single-column content.
- Forms use full-width fields and a sticky submit bar only when it does not cover content.
- Tables become cards or simplified row layouts.

### Global components
- `AppShell`
- `SidebarNav`
- `MobileBottomNav`
- `TopBar`
- `NetworkBadge`
- `WalletConnectButton`
- `StatusBadge`
- `MetricCard`
- `DataSourceBadge`
- `EnergyChart`
- `TradeTimeline`
- `EvidenceCard`
- `FilterBar`
- `EmptyState`
- `Skeleton`
- `Toast`
- `ConfirmDialog`
- `CopyButton`
- `Pagination`
- `ErrorPanel`

---

## 6. Screen specifications

### 6.1 Landing / connect wallet

**Purpose:** explain the value proposition quickly and let a visitor enter the demo.

Layout:
- Top nav: logo, “How it works”, “Climate impact”, `Connect wallet`.
- Hero headline: **“Make clean energy count.”**
- Supporting copy: “Discover local renewable-energy offers, coordinate trades, and track evidence from match to settlement.”
- Main CTA: `Explore demo`.
- Secondary CTA: `Connect wallet`.
- Lightweight energy-flow visual: solar generation → local trade → evidence → incentive points.
- Three benefit cards: P2P trading, renewable evidence, clean-energy incentives.
- Footer disclosure: “Prototype data may be simulated. Demo points have no cash value.”

Interactions:
- `Explore demo` enters a sandbox with clearly labelled synthetic data.
- `Connect wallet` opens a wallet provider flow.
- If no wallet is available, show setup guidance without removing the demo path.
- Never block the landing screen on a decorative animation.

### 6.2 Overview dashboard

The first authenticated view must answer:
1. What energy activity is happening?
2. What needs my attention?
3. Which trades are active?
4. Is the app/network connected?

Header:
- Greeting and date range.
- Network/wallet state.
- Primary `Create offer` action.

Metric row:
- Renewable energy offered (kWh).
- Matched energy (kWh).
- Active trades.
- Demo points earned.

Main content:
- Left 2/3: energy activity chart, with period selector.
- Right 1/3: “Your next actions” panel.
- Lower row: recent trades and market opportunities.

Behavior:
- Metric cards navigate to filtered detail screens.
- Values change after a successful API response, not before an unconfirmed chain action.
- Initial load uses stable skeletons; reserve space to prevent layout shift.
- Empty states include a direct next action.
- Every metric that uses synthetic data carries a `SIMULATED` source badge.

### 6.3 Energy Market

Controls:
- Search.
- `Offers` / `Requests` segmented control.
- Delivery window.
- Quantity range.
- Price range.
- Microgrid/service area.
- Renewable source.
- Sort by newest, quantity, or price where relevant.

Listing content:
- Quantity available/requested in kWh.
- Price per kWh.
- Delivery window.
- Microgrid/service area.
- Source/evidence label.
- Status.
- Contextual action: `View details`, `Request match`, or `Review request`.

Desktop: list/table with optional right-hand details panel.  
Mobile: cards, showing quantity, price, delivery window, and status first.

Behavior:
- Local filters update immediately.
- Server-backed search debounces 200–300 ms.
- Cancel stale requests so slow results cannot overwrite newer filters.
- Preserve filters when opening and returning from a listing.
- If the backend knows why a match is incompatible, explain it in plain language.
- Do not label an action “Buy now” if actual payment and electricity delivery are not implemented.

### 6.4 Create Offer / Create Request

Use a focused form, not a wizard, unless future complexity makes a multi-step flow necessary.

Fields:
- Energy quantity (kWh).
- Offer minimum price or request maximum price per kWh.
- Delivery start and end.
- Microgrid/service area.
- Renewable source.
- Evidence source.
- Optional note.

Form behavior:
- Persistent visible labels; placeholders are examples only.
- Inline validation with clear unit hints.
- Review summary before a consequential submit.
- Prevent duplicate submission while a request is in progress.
- Generate an idempotency key for create operations.
- On network error, retain all form values and offer retry.
- Show “Publishing…” while pending; show “Published” only after API confirmation.
- Never reset the form before success.

### 6.5 Trade list

Filters:
- All / Needs action / Pending / Settled / Disputed.
- Date range.
- Buyer/seller role.
- Search by trade ID or wallet address.

Rows/cards:
- Trade ID.
- kWh.
- Agreed price.
- Counterparty.
- Current status.
- Last update.
- Next action.

Behavior:
- Cursor pagination or page-based pagination.
- Keep sort/filter state while navigating into a trade.
- Provide a useful empty state for every filter.
- Do not fetch full evidence files or full chain logs for every row.

### 6.6 Trade detail — key trust screen

Header:
- Trade ID and plain-language status.
- Quantity and agreed price.
- Buyer and seller shortened wallet addresses with copy actions.
- Network and transaction status.

Content:
- Trade summary.
- Event timeline.
- Evidence card.
- Actions available to the current role.
- Matching explanation and trade terms.
- On-chain transaction records.
- Policy/rule version.
- Audit event list.

Example timeline:
1. Match proposed.
2. Trade commitment submitted.
3. Blockchain confirmation received.
4. Delivery evidence submitted.
5. Evidence approved or rejected.
6. Settlement recorded.
7. Demo points issued, if eligible.

Status vocabulary:
- `Draft`
- `Awaiting match`
- `Match proposed`
- `Awaiting participant confirmation`
- `Transaction submitted`
- `Waiting for blockchain confirmation`
- `Committed`
- `Evidence needed`
- `Under review`
- `Disputed`
- `Settled`
- `Failed — action required`

Never display `Settled` merely because a transaction hash exists. Distinguish transaction broadcast, mined/confirmed receipt, evidence approval, and final settlement.

### 6.7 Renewable Evidence

Show:
- Source type: `SIMULATED`, `MANUAL`, `METER SIGNED`, or `EXTERNAL API`.
- Reading interval.
- Reported and committed kWh.
- Evidence reference/hash.
- Linked trade.
- Reviewer and decision.
- Rejection reason or correction request.
- Timestamp and provenance.

Actions:
- `Approve evidence`
- `Reject evidence`
- `Request correction`

Rules:
- Approval/rejection opens a confirmation dialog showing the trade and quantity.
- Rejection requires a reason.
- The UI must not imply that a simulated reading is independently verified.
- A reviewer must be authorized by the backend and/or contract; hiding the button is not security.

### 6.8 Rewards

- Prominent label: **Demo points — no cash value**.
- Points balance and a short explanation of the active rule.
- Rule version, for example “10 demo points per eligible verified kWh,” only if this rule is configured.
- History: points, eligible kWh, linked trade, timestamp, issuance reference.
- Empty state explaining eligibility.

Do not add cash-out, investment, token-price, or financial-return claims to the hackathon demo unless those features are genuinely implemented and legally reviewed.

### 6.9 Activity / Audit

Filters:
- Date.
- Event type.
- Trade ID.
- Actor.
- Status.
- On-chain vs application event.

Table/list fields:
- Event.
- Timestamp.
- Actor.
- Result.
- Related trade.
- Transaction hash where applicable.

Interactions:
- Open event detail in a side panel/dialog.
- Copy hash.
- Open explorer only if a real chain and valid explorer URL are configured.
- Explain whether an event is application-generated or on-chain.

### 6.10 Settings

- Wallet connection and address.
- Preferred theme.
- Preferred microgrid/service area.
- Notification settings.
- Active network.
- Contract address and deployment environment.
- Data source disclaimer.
- Sign out of Bright Ledger without implying that the wallet provider has been disconnected from other applications.
- Remove a wallet profile only after a fresh wallet signature; anonymize its profile while retaining linked marketplace records for audit history.

Wallet sign-in uses a short-lived, single-use server challenge signed by the wallet. A changed or disconnected provider account invalidates the Bright Ledger session and requires the user to sign in again. Never request or store a seed phrase or private key.

Admin settings are role-gated on the server and contract, not just hidden in the frontend.

### 6.11 Notifications

Notification categories:
- Match proposal.
- Trade needs confirmation.
- Evidence requested.
- Evidence approved/rejected.
- Trade settled/failed.
- Network/service issue.

Each notification should deep-link to the relevant trade or screen. Avoid noisy notifications for every polling update. The current implementation derives updates from trade/evidence state and stores read/unread IDs per account in browser storage; it is not push delivery or server-side notification history. Include a “mark all as read” action.

### 6.12 Demo mode

Provide seed data with unmistakable labels:
- Sample solar prosumer.
- Sample consumer.
- Synthetic energy offers and requests.
- Simulated meter readings.
- Mock evidence review.
- Testnet/local-chain transaction states where configured.
- Demo points.

A visible `DEMO DATA` banner should appear in demo mode. Demo mode must not claim to control real meters, deliver electricity, or move real money.

---

## 7. Interaction and motion specification

The app should feel smooth because interactions respond quickly—not because everything is animated.

### Timing targets

| Interaction | Target |
|---|---:|
| Local toggle/filter/chip | Immediate; ideally under 100 ms |
| Hover/focus state | 100–160 ms |
| Button press | 80–120 ms |
| Tooltip | 150–200 ms |
| Menu/popover | 140–200 ms |
| Modal | 160–220 ms |
| Tab indicator | 120–180 ms |
| Toast | 160–200 ms |

Use opacity and transform for motion. Avoid animating layout dimensions, large shadows, filters, and blur. Do not delay an action to finish an animation.

### Required behaviors
- Buttons show immediate press/focus feedback and stable loading state.
- Disable duplicate submissions only while the same action is pending.
- Toasts are dismissible and announced accessibly.
- Critical errors stay visible in the affected panel.
- Dialogs trap focus and return focus to the trigger.
- Copy actions show a small “Copied” confirmation.
- Tables support keyboard focus and a mobile card alternative.
- Charts have keyboard-accessible tooltips and a textual summary.
- Pending blockchain operations do not freeze the rest of the app.
- Optimistic UI is allowed only when rollback is safe and pending state is clearly marked.
- Respect `prefers-reduced-motion`; remove non-essential transitions when enabled.

---

## 8. Performance: low latency, smooth UI, and honest blockchain states

“Zero delay” cannot be guaranteed for remote servers or blockchain confirmations. The engineering objective is **instant local feedback, fast data loading, and clear pending states**.

### 8.1 Initial performance targets

| Metric | Initial target | Measurement note |
|---|---|---|
| Local control response | Ideally under 100 ms | No network dependency |
| Market search debounce | 200–300 ms | Prevent request storms |
| API p95 | Under 500 ms for common demo endpoints | Measure on a defined environment |
| First meaningful screen | Target within 2.5 s on a typical test connection | Device/network dependent |
| Cumulative Layout Shift | Below 0.1 | Reserve chart/card/image space |
| Long main-thread task | Avoid tasks over 50 ms | Profile on representative devices |
| Route navigation | Render shell immediately | Load screen data progressively |
| Blockchain confirmation | Variable | Never promise a fixed confirmation time |

These are goals, not current measured results. Run performance tests before claiming the app meets them.

### 8.2 Frontend optimization
- Use React + TypeScript or an equivalent typed component framework.
- Route-level code splitting and lazy-load low-frequency screens.
- Keep the initial JavaScript bundle small and inspect bundle size.
- Tree-shake icon imports.
- Use CSS transitions for small interactions.
- Keep state close to the component that owns it.
- Avoid unnecessary global state and unnecessary memoization.
- Debounce search and cancel stale requests with `AbortController`.
- Paginate or virtualize long trade/audit lists.
- Limit chart points and avoid full chart re-animation on every refresh.
- Reserve space for data, charts, and images to prevent layout shift.
- Cache stable read data and invalidate after confirmed mutations.
- Avoid aggressive polling; use server-sent events/WebSockets where justified, or bounded polling with backoff.
- Keep the page usable during offline or slow-network states.

### 8.3 API/database optimization
- Index trade status, participant IDs, delivery windows, and created/updated timestamps according to actual query patterns.
- Paginate history endpoints.
- Return only fields needed for list views.
- Do not include full evidence blobs in listing responses.
- Use database connection pooling.
- Avoid N+1 queries and inspect query plans.
- Keep blockchain RPC calls out of synchronous market-list endpoints.
- Use a durable job queue/outbox for chain writes and asynchronous reconciliation.
- Log request ID, route, response status, and duration.
- Add rate limits to expensive matching and evidence-review endpoints.
- Show last-updated time for potentially stale cached status.

### 8.4 Blockchain pending-state UX
1. On wallet confirmation, show `Submitting transaction…`.
2. When a transaction hash is returned, show `Transaction submitted` and the hash.
3. Show `Waiting for confirmation` until a receipt and configured confirmation policy are satisfied.
4. Show `Confirmed` only after the receipt is successful.
5. Show `Failed` with a recovery action if the receipt fails.
6. Persist transaction tracking so refresh does not lose the status.
7. Reconcile backend state with chain events.
8. Keep unrelated UI usable while pending.

Never invent a percentage progress bar if actual progress is unknown. Use a spinner plus accurate text.

### 8.5 Resilience states
Every data-driven screen must support:
- Initial loading.
- Empty state.
- Recoverable error with retry.
- Permission denied.
- Offline/network unavailable.
- Blockchain RPC unavailable.
- Pending transaction.
- Stale cached data.
- Partial data where meaningful.
- Confirmed success.
- Failed transaction or action.

Example copy:
- “Loading your market activity…”
- “No open offers yet. Publish surplus energy to get started.”
- “Your transaction was submitted and is waiting for network confirmation.”
- “We can’t reach the blockchain network right now. Application data may still be available.”
- “Demo reading — not independently verified.”

---

## 9. Blockchain and P2P workflow reflected in the UI

The UI must represent the real backend/contract state machine. Recommended high-level flow:

1. **Create offer/request:** validate input and persist the record.
2. **Discover and match:** backend matching engine finds compatible quantity, price, time window, and microgrid.
3. **Review proposal:** both participants see quantity, price, time, fees if any, and evidence policy.
4. **Commit trade:** participants confirm; a contract call may record the commitment.
5. **Wait for chain confirmation:** display hash and pending state.
6. **Submit evidence:** source and interval are stored with provenance/hash.
7. **Review evidence:** authorized reviewer approves, rejects, or requests correction.
8. **Settle trade:** backend/contract verifies the allowed transition and records settlement.
9. **Issue incentive points:** apply a versioned rule after eligibility is confirmed.
10. **Audit:** show linked application events and on-chain events.

### State-machine safety
- A failed transaction must not silently advance the trade.
- Duplicate callbacks/events must not issue points twice.
- A trade cannot settle before required evidence/policy conditions pass.
- UI controls are not the authorization layer; server and smart contract must enforce permissions.
- If an event arrives out of order, show the last verified state and reconcile before presenting final status.
- Contract events and backend records should be traceable using trade ID and transaction hash.

---

## 10. Design tokens: CSS starter

Save as `src/styles/tokens.css`.

```css
:root {
  color-scheme: light;

  --forest-950: #062F2A;
  --forest-900: #0B3932;
  --forest-800: #124A3E;
  --forest-700: #1D604D;

  --solar-500: #F4BD36;
  --solar-400: #FFD15C;

  --cream-50: #FAFAF5;
  --cream-100: #F2F2E9;
  --white: #FFFFFF;

  --ink-950: #102C28;
  --ink-700: #40534E;
  --ink-500: #687771;
  --border: #E1E6DD;

  --surface-page: var(--cream-50);
  --surface-card: var(--white);
  --surface-raised: #FFFFFF;
  --text-primary: var(--ink-950);
  --text-secondary: var(--ink-700);
  --text-muted: var(--ink-500);

  --success: #227A53;
  --warning: #A96812;
  --danger: #B53B35;
  --info: #276B8A;

  --font-ui: "Inter", "Manrope", system-ui, sans-serif;
  --font-display: "DM Serif Display", Georgia, serif;

  --radius-input: 12px;
  --radius-card: 18px;
  --radius-panel: 24px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  --motion-fast: 120ms;
  --motion-normal: 180ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}

[data-theme="dark"] {
  color-scheme: dark;
  --surface-page: #071F1C;
  --surface-card: #0B302A;
  --surface-raised: #103B33;
  --text-primary: #F7F8F2;
  --text-secondary: #B6C5BE;
  --text-muted: #91A49B;
  --border: #2B5149;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Button starter

```css
.button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-input);
  font: 600 14px/1 var(--font-ui);
  cursor: pointer;
  transition:
    background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.button:active { transform: translateY(1px); }

.button:focus-visible {
  outline: 3px solid var(--solar-500);
  outline-offset: 3px;
}

.button-primary {
  background: var(--forest-900);
  color: var(--white);
  border-color: var(--forest-900);
}

.button-primary:hover { background: var(--forest-800); }

.button-accent {
  background: var(--solar-500);
  color: var(--forest-950);
  border-color: var(--solar-500);
}

@media (prefers-reduced-motion: reduce) {
  .button { transition: none; }
}
```

---

## 11. Suggested frontend project structure

```text
src/
├── app/
│   ├── router.tsx
│   ├── providers.tsx
│   └── query-client.ts
├── assets/
│   └── brand/
│       ├── bright-ledger-logo-light.svg
│       ├── bright-ledger-logo-dark.svg
│       └── bright-ledger-icon.svg
├── components/
│   ├── ui/
│   ├── layout/
│   ├── charts/
│   ├── tables/
│   └── feedback/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── market/
│   ├── offers/
│   ├── requests/
│   ├── trades/
│   ├── evidence/
│   ├── rewards/
│   ├── notifications/
│   └── audit/
├── hooks/
├── lib/
│   ├── api-client.ts
│   ├── wallet.ts
│   ├── formatters.ts
│   ├── validators.ts
│   └── errors.ts
├── styles/
│   ├── tokens.css
│   └── globals.css
└── types/
```

Suggested stack for a hackathon:
- React + TypeScript + Vite.
- Tailwind CSS or CSS Modules using the token system above.
- A consistent accessible component library or custom components with documented variants.
- TanStack Query or equivalent for server state.
- React Hook Form + Zod or equivalent for forms.
- Lightweight charting library.
- Wallet library compatible with the chosen EVM network.
- Backend API and PostgreSQL for durable application records.
- Local EVM development chain or testnet for the demo.

Choose the exact stack based on team familiarity. Do not add dependencies just for decoration.

---

## 12. API contract expectations for frontend

Example endpoints; adapt names to the actual backend.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/dashboard` | KPI and dashboard summary |
| GET | `/api/v1/offers` | Filtered/paginated offers |
| POST | `/api/v1/offers` | Create offer |
| PATCH | `/api/v1/offers/:id` | Update/pause/cancel offer |
| GET | `/api/v1/requests` | Filtered requests |
| POST | `/api/v1/requests` | Create request |
| POST | `/api/v1/matches/:id/accept` | Accept match proposal |
| GET | `/api/v1/trades` | Paginated trade list |
| GET | `/api/v1/trades/:id` | Trade detail and timeline |
| POST | `/api/v1/trades/:id/evidence` | Submit evidence metadata |
| POST | `/api/v1/evidence/:id/approve` | Approve evidence |
| POST | `/api/v1/evidence/:id/reject` | Reject with reason |
| GET | `/api/v1/rewards` | Points balance and history |
| GET | `/api/v1/audit` | Paginated audit events |
| GET | `/api/v1/health` | API health and configured network status |

Requirements:
- Use consistent error objects and request IDs.
- Validate all inputs on the server.
- Use idempotency keys for operations that create records or trigger chain writes.
- Do not expose private keys, RPC secrets, or admin secrets to the frontend.
- The frontend must not trust a client-supplied role as authorization.

---

## 13. Accessibility and responsive QA

- Target WCAG 2.2 AA contrast and interaction patterns.
- Keyboard navigation works across all primary workflows.
- Visible focus states.
- Semantic landmarks, headings, labels, tables, and buttons.
- Status communicated with text and not color alone.
- Support zoom and reflow without losing essential content.
- Respect reduced motion.
- Chart has text summary or accessible table.
- Screen-reader announcements for async success/error.
- Mobile layouts tested at 360 px and 390 px widths.
- No horizontal overflow for primary workflows.
- Tables convert to cards on narrow screens.
- Sticky actions never obscure form fields or errors.

---

## 14. Testing and acceptance checklist

### Visual consistency
- [ ] Correct logo variant used on light and dark backgrounds.
- [ ] Green/gold/off-white brand palette is consistent.
- [ ] Typography, spacing, radii, and borders use design tokens.
- [ ] No excessive glow, blur, or unnecessary animation.
- [ ] Dashboard hierarchy is immediately understandable.

### Functionality
- [ ] Wallet sign-in verifies a single-use signature challenge; account changes invalidate the session.
- [ ] Sign-out clears the Bright Ledger session without claiming to disconnect the provider; profile removal requires a wallet signature.
- [ ] Wallet address, active network, configured contract state, and explorer link are shown where available.
- [ ] Trade/evidence notifications deep-link, support read/unread state, and can be marked all read.
- [ ] Theme toggle changes the real theme and persists preference.
- [ ] Offers and requests can be created, validated, and listed.
- [ ] Filters, sorting, pagination, and detail navigation work.
- [ ] Trade timeline reflects backend state.
- [ ] Evidence approve/reject actions enforce permissions and require confirmation.
- [ ] Demo points are labelled no-cash-value and are issued idempotently.
- [ ] Copy actions and explorer links work only with valid data.
- [ ] No dead buttons or decorative controls masquerading as functional UI.

### Performance and resilience
- [ ] Route-level code splitting implemented.
- [ ] Search is debounced and stale requests are cancelled.
- [ ] Large history lists are paginated/virtualized.
- [ ] Layout space is reserved for charts and loaded data.
- [ ] Slow network, offline, and RPC failure states are tested.
- [ ] Pending transactions do not block unrelated interactions.
- [ ] Retry does not duplicate offers, trades, or rewards.
- [ ] API p95 and Core Web Vitals are measured in a defined environment.
- [ ] Reduced-motion mode is tested.

### Trust and security
- [ ] Simulated data is labelled.
- [ ] Broadcast and confirmed transaction states are distinct.
- [ ] No trade is shown settled before policy conditions pass.
- [ ] Authorization is enforced by backend/contract.
- [ ] Evidence and reward events are auditable.
- [ ] No real-money, carbon-credit, or physical-delivery claims unless actually supported.

---

## 15. AI design / coding assistant master prompt

Provide the attached Bright Ledger logo board with this prompt:

> Build a complete responsive blockchain-enabled peer-to-peer renewable-energy trading web app named **Bright Ledger**. Treat the attached logo board as the primary brand reference: circular sun-and-solar-panel icon, deep forest green, warm solar gold, warm off-white, refined serif wordmark, and the tagline “Clean Energy. Real Value.”
>
> Create a polished climate-tech fintech interface with high-quality Dribbble-inspired visual craft, but prioritize usability, accessibility, and speed. Use warm light mode by default and a working forest-night dark theme. Use the serif font only for brand/marketing headlines; use Inter or Manrope for product UI. Use restrained gold accents, generous whitespace, clear hierarchy, thin borders, 16–20 px cards, consistent outline icons, and minimal shadows. Avoid excessive glassmorphism, glow, heavy blur, generic dashboard templates, and decorative animation.
>
> Implement these complete screens: landing/connect wallet, overview dashboard, energy market, create offer/request, my offers, my requests, trade list, trade detail with timeline, renewable evidence review, rewards, activity/audit, notifications, and settings. Include desktop sidebar, tablet collapsible navigation, and mobile bottom navigation. Dashboard should show offered kWh, matched kWh, active trades, demo points, energy activity chart, pending actions, and recent trades.
>
> Implement working interactions: wallet connect/disconnect, theme toggle, market filters, forms with validation, offer/request creation, match proposal review, trade detail navigation, timeline, evidence approval/rejection confirmation, reward history, audit filters, copy transaction hash, toasts, dialogs, loading skeletons, empty states, error/retry states, and mobile responsive navigation. Do not leave dead buttons. If a backend or wallet integration is not available, implement an explicit demo adapter and label the behavior as simulated rather than pretending it is real.
>
> Optimize perceived latency: show immediate local feedback, use route-level code splitting, debounced search, cancellable requests, pagination, minimal re-renders, small bundles, and CSS transitions around 120–180 ms. Respect `prefers-reduced-motion`. Do not animate large layout changes or block the UI while a blockchain transaction is pending.
>
> Represent blockchain state honestly: distinguish transaction submission, pending confirmation, successful confirmation, evidence approval, and final settlement. Display transaction hashes when available and link to an explorer only for the configured network. Never claim settlement before confirmation. Use a local EVM/testnet integration when configured; otherwise use a clearly labelled mock chain adapter.
>
> Use clearly labelled synthetic offers, requests, and meter readings for demo mode. Display “Demo points — no cash value.” Do not claim physical electricity delivery, real-money settlement, independently verified meter readings, or verified carbon reductions unless the system actually implements and supports them.
>
> Create reusable UI components and design tokens, typed data models, accessible loading/error/empty states, and a coherent responsive design. The result must look and behave like one product, not unrelated screens. Include setup instructions, environment variable examples, and a README. Do not place secrets in client code.

---

## 16. Final design principle

**Make the product feel instant without faking certainty.** Local controls should respond immediately; remote operations should communicate progress; blockchain actions should distinguish submission from confirmation; and energy claims should match the evidence available. Keep the Bright Ledger logo recognizable through forest green, solar gold, warm off-white, clear typography, and consistent use of the circular solar mark.
