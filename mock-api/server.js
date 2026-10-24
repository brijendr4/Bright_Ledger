import { randomUUID, createHash, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import { getAddress, verifyMessage } from 'ethers'

const app = express()
const port = Number(process.env.API_PORT ?? 4000)
const chainId = Number(process.env.CHAIN_ID ?? 31337)
const chainRpcUrl = process.env.CHAIN_RPC_URL ?? ''
const databasePath = resolve(process.env.MOCK_DATABASE_PATH ?? 'mock-api/data/bright-ledger.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })
const database = new DatabaseSync(databasePath)
database.exec(`
  CREATE TABLE IF NOT EXISTS mock_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)
const users = new Map()
const tokens = new Map()
const nonces = new Map()
const idempotency = new Map()
const demoRoles = ['prosumer', 'consumer', 'both', 'verifier', 'admin', 'funder', 'space_owner']
const demoNames = {
  prosumer: 'Avery Stone',
  consumer: 'Jordan Rivera',
  both: 'Sam Taylor',
  verifier: 'Morgan Chen',
  admin: 'Riley Brooks',
  funder: 'Casey Morgan',
  space_owner: 'Taylor Ahmed',
}

function recordEvent(project, action, detail, actor = 'Demo workspace', metadata = {}) {
  project.timeline.unshift({
    id: randomUUID(),
    action,
    detail,
    actor,
    timestamp: new Date().toISOString(),
    metadata,
    source: 'mock-api',
  })
}

const sites = [
  {
    id: 'SITE-1001', owner: 'Taylor Ahmed', name: 'Sunrise Community Roof', location: 'Istanbul, Türkiye',
    publicLocation: 'Istanbul, Türkiye', roofAreaM2: 100, usableAreaM2: 82, roofType: 'Shared rooftop',
    shadingPct: 8, gridConnectionStatus: 'Connected · demo record', reviewStatus: 'APPROVED',
    createdAt: '2026-08-11T09:00:00.000Z', evidenceRefs: ['roof-survey-demo-1001'],
    estimate: { methodologyVersion: 'illustrative-v1', capacityKwp: 10.93, dailyKwh: 43.72, monthlyKwh: 1311.6, capexMinor: 2186000, currency: 'USD cents', resourceSource: 'Illustrative regional assumptions', assumptions: { panelDensityKwpPerM2: 0.15, performanceRatio: 0.8, peakSunHours: 5, costPerKwpMinor: 200000, note: 'Not an engineering estimate; survey required.' } },
  },
  {
    id: 'SITE-1002', owner: 'Taylor Ahmed', name: 'Harbor View Rooftop', location: 'Lisbon, Portugal',
    publicLocation: 'Lisbon, Portugal', roofAreaM2: 180, usableAreaM2: 145, roofType: 'Commercial rooftop',
    shadingPct: 14, gridConnectionStatus: 'Review required', reviewStatus: 'UNDER_REVIEW',
    createdAt: '2026-09-02T11:30:00.000Z', evidenceRefs: [],
    estimate: { methodologyVersion: 'illustrative-v1', capacityKwp: 19.33, dailyKwh: 77.32, monthlyKwh: 2319.6, capexMinor: 3866000, currency: 'USD cents', resourceSource: 'Illustrative regional assumptions', assumptions: { panelDensityKwpPerM2: 0.15, performanceRatio: 0.8, peakSunHours: 5, costPerKwpMinor: 200000, note: 'Not an engineering estimate; survey required.' } },
  },
  {
    id: 'SITE-1003', owner: 'Avery Stone', name: 'Courtyard Solar Site', location: 'Nairobi, Kenya',
    publicLocation: 'Nairobi, Kenya', roofAreaM2: 76, usableAreaM2: 50, roofType: 'Residential rooftop',
    shadingPct: 22, gridConnectionStatus: 'Unknown', reviewStatus: 'NEEDS_CHANGES',
    createdAt: '2026-09-17T08:15:00.000Z', evidenceRefs: [],
    estimate: { methodologyVersion: 'illustrative-v1', capacityKwp: 6.67, dailyKwh: 21.34, monthlyKwh: 640.2, capexMinor: 1334000, currency: 'USD cents', resourceSource: 'Illustrative regional assumptions', assumptions: { panelDensityKwpPerM2: 0.15, performanceRatio: 0.8, peakSunHours: 4, costPerKwpMinor: 200000, note: 'Not an engineering estimate; survey required.' } },
  },
]

const projects = [
  {
    id: 'PRJ-SUNRISE', siteId: 'SITE-1001', name: 'Sunrise Community Roof',
    location: 'Istanbul, Türkiye', siteType: 'Shared rooftop', owner: 'Taylor Ahmed',
    area: 82, capacity: 10.93, target: 200000, raised: 200000,
    status: 'Operational', image: 'project-solar', permission: 'Owner permission stated',
    notes: 'Illustrative community roof project. All funding and generation records are simulated.',
    description: 'A pooled demonstration of rooftop solar funding, meter evidence, energy allocation and transparent settlement records.',
    expectedMonthlyKwh: 1311.6, fundingDeadline: '2026-12-31T23:59:59.000Z',
    simulationMode: true, agreementVersion: 1, agreementHash: '0x9c6e1b7c8c5c46e5b0dd-demo-agreement',
    allocationRules: { funderPct: 70, ownerPct: 20, operatorPct: 10, reserveMinor: 40000, feeMinor: 20000, version: 'waterfall-v1' },
    fundingTargetMinor: 20000000, fundingCommittedMinor: 20000000, fundingReceivedMinor: 20000000,
    contributions: [
      { id: 'CON-SUN-A', contributor: 'Casey Morgan', amountMinor: 12000000, currency: 'BL demo credits', status: 'ACCEPTED', createdAt: '2026-08-20T12:00:00.000Z', fundingShare: 60, receipt: 'RCP-SUN-A' },
      { id: 'CON-SUN-B', contributor: 'Morgan Chen', amountMinor: 8000000, currency: 'BL demo credits', status: 'ACCEPTED', createdAt: '2026-08-21T12:00:00.000Z', fundingShare: 40, receipt: 'RCP-SUN-B' },
    ],
    batches: [
      { id: 'GEN-SUN-001', meterRefHash: 'sha256:demo-meter-a1', intervalStart: '2026-09-18T08:00:00.000Z', intervalEnd: '2026-09-18T09:00:00.000Z', energyWh: 600000, tradedWh: 400000, sourceType: 'simulator', sourceReference: 'sample-meter-feed-september', payloadHash: 'sha256:demo-payload-600', verificationStatus: 'VERIFIED', anomalyFlags: [], submittedBy: 'Demo Operator', verifiedBy: 'Morgan Chen', verifiedAt: '2026-09-18T10:00:00.000Z', createdAt: '2026-09-18T09:10:00.000Z', allocatedWh: 400000 },
      { id: 'GEN-SUN-002', meterRefHash: 'sha256:demo-meter-a1', intervalStart: '2026-09-19T08:00:00.000Z', intervalEnd: '2026-09-19T09:00:00.000Z', energyWh: 1450000, sourceType: 'simulator', sourceReference: 'sample-high-reading', payloadHash: 'sha256:demo-payload-anomaly', verificationStatus: 'NEEDS_REVIEW', anomalyFlags: ['Reading exceeds configured hourly plausibility threshold'], submittedBy: 'Demo Operator', verifiedBy: null, verifiedAt: null, createdAt: '2026-09-19T09:10:00.000Z', allocatedWh: 0 },
      { id: 'GEN-SUN-003', meterRefHash: 'sha256:demo-meter-a1', intervalStart: '2026-09-20T08:00:00.000Z', intervalEnd: '2026-09-20T09:00:00.000Z', energyWh: 320000, sourceType: 'csv', sourceReference: 'sample-rejected-row-03', payloadHash: 'sha256:demo-payload-rejected', verificationStatus: 'REJECTED', anomalyFlags: ['Verifier rejected: sample interval does not reconcile'], submittedBy: 'Demo Operator', verifiedBy: 'Morgan Chen', verifiedAt: '2026-09-20T11:00:00.000Z', allocatedWh: 0 },
    ],
    trades: [{ id: 'TRD-SUN-400', generationBatchId: 'GEN-SUN-001', energyWh: 400000, priceMinorPerKwh: 1000, grossAmountMinor: 400000, status: 'SETTLED', source: 'Simulated trade', createdAt: '2026-09-18T12:00:00.000Z' }],
    attributes: [{ id: 'ATR-SUN-001', generationBatchId: 'GEN-SUN-001', energyWh: 400000, status: 'ALLOCATED', allocatedToTradeId: 'TRD-SUN-400', methodologyVersion: 'renewable-attribute-demo-v1', location: 'Istanbul, Türkiye', intervalStart: '2026-09-18T08:00:00.000Z', intervalEnd: '2026-09-18T09:00:00.000Z', label: 'Demo renewable-energy attribute — not an official certificate.' }],
    settlements: [{ id: 'SET-SUN-001', tradeIds: ['TRD-SUN-400'], periodStart: '2026-09-01T00:00:00.000Z', periodEnd: '2026-09-30T23:59:59.000Z', status: 'FINALIZED', grossProceedsMinor: 400000, refundsMinor: 0, operatingReserveMinor: 40000, platformFeeMinor: 20000, distributablePoolMinor: 340000, rulesVersion: 'waterfall-v1', inputHash: 'sha256:demo-settlement-input', outputHash: 'sha256:demo-settlement-output', allocations: [{ recipient: 'Casey Morgan', type: 'funder', amountMinor: 142800 }, { recipient: 'Morgan Chen', type: 'funder', amountMinor: 95200 }, { recipient: 'Taylor Ahmed', type: 'owner', amountMinor: 68000 }, { recipient: 'Demo Operator', type: 'operator', amountMinor: 34000 }], finalizedAt: '2026-10-01T00:00:00.000Z' }],
    disputes: [],
    milestones: [{ id: 'MS-1', title: 'Site approved', status: 'APPROVED', simulated: true, at: '2026-08-15T10:00:00.000Z' }, { id: 'MS-2', title: 'Funding target reached', status: 'COMPLETED', simulated: true, at: '2026-08-21T12:00:00.000Z' }, { id: 'MS-3', title: 'Installation milestone', status: 'COMPLETED', simulated: true, at: '2026-09-01T12:00:00.000Z' }, { id: 'MS-4', title: 'Generation data active', status: 'COMPLETED', simulated: true, at: '2026-09-18T09:10:00.000Z' }],
    timeline: [],
    impactFactor: { kgCo2ePerKwh: 0.7, source: 'Illustrative demo assumption; replace with a dated, geography-appropriate source.', geography: 'Istanbul, Türkiye', period: '2026 demo period', version: 'demo-factor-v1', date: '2026-08-01' },
    pointsAwarded: true,
  },
  {
    id: 'PRJ-HARBOR', siteId: 'SITE-1002', name: 'Harbor View Solar Collective',
    location: 'Lisbon, Portugal', siteType: 'Commercial rooftop', owner: 'Taylor Ahmed',
    area: 145, capacity: 19.33, target: 85000, raised: 27600,
    status: 'Funding', image: 'project-rooftop', permission: 'Permission pending review',
    notes: 'A mock project part-funded by multiple sample community participants.',
    description: 'Funding pool sample project; contributions and future returns are simulated only.',
    expectedMonthlyKwh: 2319.6, fundingDeadline: '2026-12-31T23:59:59.000Z',
    simulationMode: true, agreementVersion: 1, agreementHash: '0x4b62-demo-harbor-agreement',
    allocationRules: { funderPct: 70, ownerPct: 20, operatorPct: 10, reserveMinor: 0, feeMinor: 0, version: 'waterfall-v1' },
    fundingTargetMinor: 8500000, fundingCommittedMinor: 2760000, fundingReceivedMinor: 2760000,
    contributions: [{ id: 'CON-HARBOR-1', contributor: 'Casey Morgan', amountMinor: 2760000, currency: 'BL demo credits', status: 'ACCEPTED', createdAt: '2026-09-10T12:00:00.000Z', fundingShare: 100, receipt: 'RCP-HARBOR-1' }],
    batches: [], trades: [], attributes: [], settlements: [],
    disputes: [],
    milestones: [{ id: 'MS-H1', title: 'Site submitted', status: 'UNDER_REVIEW', simulated: true, at: '2026-09-02T11:30:00.000Z' }],
    timeline: [],
    impactFactor: { kgCo2ePerKwh: 0.42, source: 'Illustrative demo assumption; not a verified factor.', geography: 'Lisbon, Portugal', period: '2026 demo period', version: 'demo-factor-v1', date: '2026-08-01' },
    pointsAwarded: false,
  },
  {
    id: 'PRJ-COURTYARD', siteId: 'SITE-1003', name: 'Courtyard Solar Pilot',
    location: 'Nairobi, Kenya', siteType: 'Residential rooftop', owner: 'Avery Stone',
    area: 50, capacity: 6.67, target: 48000, raised: 0,
    status: 'Review', image: 'project-community', permission: 'Permission pending review',
    notes: 'Site needs changes before this project can be published.',
    description: 'Sample site awaiting evidence updates.',
    expectedMonthlyKwh: 640.2, fundingDeadline: '2026-12-31T23:59:59.000Z',
    simulationMode: true, agreementVersion: 1, agreementHash: null,
    allocationRules: { funderPct: 70, ownerPct: 20, operatorPct: 10, reserveMinor: 0, feeMinor: 0, version: 'waterfall-v1' },
    fundingTargetMinor: 4800000, fundingCommittedMinor: 0, fundingReceivedMinor: 0,
    contributions: [], batches: [], trades: [], attributes: [], settlements: [],
    disputes: [],
    milestones: [{ id: 'MS-C1', title: 'Site requires changes', status: 'NEEDS_CHANGES', simulated: true, at: '2026-09-17T08:15:00.000Z' }],
    timeline: [],
    impactFactor: { kgCo2ePerKwh: 0.68, source: 'Illustrative demo assumption; not a verified factor.', geography: 'Nairobi, Kenya', period: '2026 demo period', version: 'demo-factor-v1', date: '2026-08-01' },
    pointsAwarded: false,
  },
]

for (const project of projects) {
  if (!project.timeline.length) {
    recordEvent(project, 'project.seeded', 'Seeded sample project for local prototype exploration.', 'Bright Ledger Demo')
  }
}

const listings = [
  { id: 'OFF-1001', type: 'offer', owner: 'Avery Stone', quantity: 18, price: 0.14, area: 'Istanbul, Türkiye', source: 'Rooftop solar', window: 'Today, 10:00 AM–2:00 PM', status: 'Open', isMine: false },
  { id: 'OFF-1002', type: 'offer', owner: 'Sam Taylor', quantity: 12, price: 0.12, area: 'Lisbon, Portugal', source: 'Solar + storage', window: 'Tomorrow, 9:00 AM–1:00 PM', status: 'Open', isMine: false },
  { id: 'OFF-1003', type: 'offer', owner: 'Jordan Rivera', quantity: 7.5, price: 0.16, area: 'Nairobi, Kenya', source: 'Community solar', window: 'Today, 1:00–5:00 PM', status: 'Open', isMine: false },
  { id: 'OFF-1004', type: 'offer', owner: 'Avery Stone', quantity: 0, price: 0.15, area: 'Austin, United States', source: 'Rooftop solar', window: 'Tomorrow, 2:00–6:00 PM', status: 'Paused', isMine: true },
  { id: 'REQ-2001', type: 'request', owner: 'Jordan Rivera', quantity: 10, price: 0.18, area: 'Istanbul, Türkiye', source: 'Any renewable', window: 'Today, 11:00 AM–3:00 PM', status: 'Open', isMine: false },
  { id: 'REQ-2002', type: 'request', owner: 'Casey Morgan', quantity: 15, price: 0.17, area: 'Lisbon, Portugal', source: 'Rooftop solar', window: 'Tomorrow, 9:00 AM–1:00 PM', status: 'Open', isMine: false },
  { id: 'REQ-2003', type: 'request', owner: 'Morgan Chen', quantity: 6, price: 0.20, area: 'Nairobi, Kenya', source: 'Solar + storage', window: 'Today, 1:00–4:00 PM', status: 'Open', isMine: false },
]

const trades = [
  { id: 'TRD-00835', buyer: 'Jordan Rivera', seller: 'Avery Stone', quantity: 10, price: 0.14, status: 'Settled', time: 'Sep 18, 2026', hash: '0x8f3e…91b2', buyerWalletAddress: null, sellerWalletAddress: null },
  { id: 'TRD-00839', buyer: 'Casey Morgan', seller: 'Sam Taylor', quantity: 6.2, price: 0.12, status: 'Settled', time: 'Sep 20, 2026', hash: '0x0a4d…71ce', buyerWalletAddress: null, sellerWalletAddress: null },
  { id: 'TRD-00842', buyer: 'Jordan Rivera', seller: 'Avery Stone', quantity: 12.4, price: 0.14, status: 'Evidence needed', time: 'Oct 22, 2026', hash: 'Not submitted', buyerWalletAddress: null, sellerWalletAddress: null },
]
const evidence = [
  { id: 'EVD-1001', project: 'Sunrise Community Roof', source: 'Sample meter feed', quantity: 8, interval: 'Sep 20, 2026 · 9:00–10:00 AM', status: 'Pending', trade: 'TRD-00841', reference: 'sample://meter/1001' },
  { id: 'EVD-1002', project: 'Harbor View Solar Collective', source: 'Simulated smart meter', quantity: 6.2, interval: 'Sep 20, 2026 · 10:00–11:00 AM', status: 'Pending', trade: 'TRD-00842', reference: 'sample://meter/1002' },
  { id: 'EVD-1003', project: 'Sunrise Community Roof', source: 'Sample meter feed', quantity: 6.2, interval: 'Sep 19, 2026 · 1:00–2:00 PM', status: 'Approved', trade: 'TRD-00839', reference: 'sample://meter/1003' },
]

function restoreArray(target, saved, name) {
  if (!Array.isArray(saved)) throw new Error(`SQLite mock state is invalid: "${name}" must be an array.`)
  target.splice(0, target.length, ...saved)
}

const savedState = database.prepare('SELECT schema_version, payload FROM mock_state WHERE id = 1').get()
if (savedState) {
  if (savedState.schema_version !== 1) throw new Error(`Unsupported SQLite mock state version: ${savedState.schema_version}.`)
  let persisted
  try {
    persisted = JSON.parse(savedState.payload)
  } catch (error) {
    throw new Error('SQLite mock state contains invalid JSON.', { cause: error })
  }
  restoreArray(sites, persisted.sites, 'sites')
  restoreArray(projects, persisted.projects, 'projects')
  restoreArray(listings, persisted.listings, 'listings')
  restoreArray(trades, persisted.trades, 'trades')
  restoreArray(evidence, persisted.evidence, 'evidence')
  if (!Array.isArray(persisted.demoUsers)) throw new Error('SQLite mock state is invalid: "demoUsers" must be an array.')
  for (const user of persisted.demoUsers) users.set(user.id, user)
}

function saveMockState() {
  const payload = JSON.stringify({
    sites,
    projects,
    listings,
    trades,
    evidence,
    demoUsers: [...users.values()].filter((user) => user.demo),
  })
  database.prepare(`
    INSERT INTO mock_state (id, schema_version, payload, updated_at)
    VALUES (1, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(payload, new Date().toISOString())
}

function getUser(request) {
  const token = request.header('authorization')?.replace(/^Bearer\s+/i, '')
  const id = token ? tokens.get(token) : null
  const user = id ? users.get(id) : null
  if (!user) {
    const error = new Error('Sign in with a demo profile or EVM wallet.')
    error.status = 401
    error.code = 'UNAUTHENTICATED'
    throw error
  }
  return user
}

function requireRoles(user, allowed) {
  if (!allowed.includes(user.role) && !(user.role === 'both' && allowed.some((role) => ['prosumer', 'consumer'].includes(role)))) {
    const error = new Error(`This action requires one of these roles: ${allowed.join(', ')}.`)
    error.status = 403
    error.code = 'FORBIDDEN'
    throw error
  }
}

function errorResponse(response, error) {
  response.status(error.status ?? 400).json({ error: { message: error.message ?? 'Mock API request failed.', code: error.code ?? 'MOCK_API_ERROR' } })
}

function projectById(id) {
  return projects.find((project) => project.id === id)
}

function publicProject(project) {
  return {
    id: project.id, siteId: project.siteId, name: project.name, description: project.description,
    status: project.status, capacityKwp: project.capacity, fundingTargetMinor: project.fundingTargetMinor,
    currencyCode: 'BL demo credits', expectedMonthlyKwh: project.expectedMonthlyKwh,
    fundingDeadline: project.fundingDeadline, agreementVersion: project.agreementVersion,
    agreementHash: project.agreementHash, allocationRules: project.allocationRules,
    simulationMode: true, createdAt: project.timeline.at(-1)?.timestamp,
    location: project.location, owner: project.owner, siteType: project.siteType, area: project.area,
    target: project.target, raised: project.raised, image: project.image, permission: project.permission,
    milestones: project.milestones,
  }
}

function projectOverview(project) {
  const site = sites.find((item) => item.id === project.siteId)
  const verifiedWh = project.batches.filter((batch) => batch.verificationStatus === 'VERIFIED').reduce((sum, batch) => sum + batch.energyWh, 0)
  const allocatedWh = project.attributes.filter((attribute) => ['ALLOCATED', 'RETIRED'].includes(attribute.status)).reduce((sum, attribute) => sum + attribute.energyWh, 0)
  const availableWh = Math.max(0, verifiedWh - allocatedWh)
  const unsettledTrades = project.trades.filter((trade) => trade.status !== 'SETTLED')
  return {
    project: publicProject(project),
    site,
    funding: {
      targetMinor: project.fundingTargetMinor,
      committedMinor: project.fundingCommittedMinor,
      receivedMinor: project.fundingReceivedMinor,
      remainingMinor: Math.max(0, project.fundingTargetMinor - project.fundingReceivedMinor),
      currency: 'BL demo credits',
      provisionalShares: project.contributions.map((contribution) => ({ contributor: contribution.contributor, amountMinor: contribution.amountMinor, percentage: contribution.fundingShare, provisional: project.status !== 'Funded' && project.status !== 'Operational' })),
      contributions: project.contributions,
    },
    generation: {
      verifiedWh,
      availableWh,
      batches: project.batches,
      eligiblePoints: project.pointsAwarded ? project.batches.filter((batch) => batch.verificationStatus === 'VERIFIED').reduce((sum, batch) => sum + Math.floor(batch.energyWh / 100), 0) : 0,
    },
    market: { trades: project.trades, unsettledTrades },
    attributes: project.attributes,
    settlements: project.settlements,
    milestones: project.milestones,
    timeline: project.timeline,
    disputes: project.disputes,
    impact: {
      simulatedKwh: Number((verifiedWh / 1000).toFixed(3)),
      eligibleKwh: Number((verifiedWh / 1000).toFixed(3)),
      allocatedKwh: Number((allocatedWh / 1000).toFixed(3)),
      availableKwh: Number((availableWh / 1000).toFixed(3)),
      estimatedKgCo2e: Number((verifiedWh / 1000 * project.impactFactor.kgCo2ePerKwh).toFixed(3)),
      factor: project.impactFactor,
      disclaimer: 'Illustrative estimate only; not a carbon credit or independently verified emissions reduction.',
    },
  }
}

function buildSettlementPreview(project, input = {}) {
  const previouslySettledTradeIds = new Set(project.settlements.flatMap((run) => run.tradeIds ?? []))
  const periodStart = input.periodStart ?? '1970-01-01T00:00:00.000Z'
  const periodEnd = input.periodEnd ?? new Date().toISOString()
  const periodStartMs = Date.parse(periodStart)
  const periodEndMs = Date.parse(periodEnd)
  if (!Number.isFinite(periodStartMs) || !Number.isFinite(periodEndMs) || periodEndMs <= periodStartMs) {
    const error = new Error('Settlement period must contain valid start and end dates in chronological order.')
    error.status = 400
    error.code = 'INVALID_SETTLEMENT_PERIOD'
    throw error
  }
  const tradesInPeriod = project.trades.filter((trade) => trade.status === 'SETTLED' && !previouslySettledTradeIds.has(trade.id) && Date.parse(trade.createdAt) >= periodStartMs && Date.parse(trade.createdAt) <= periodEndMs)
  const grossProceedsMinor = tradesInPeriod.reduce((sum, trade) => sum + trade.grossAmountMinor, 0)
  const refundsMinor = 0
  const operatingReserveMinor = Math.min(grossProceedsMinor - refundsMinor, Math.max(0, project.allocationRules.reserveMinor))
  const afterReserve = grossProceedsMinor - refundsMinor - operatingReserveMinor
  const platformFeeMinor = Math.min(afterReserve, Math.max(0, project.allocationRules.feeMinor))
  const distributablePoolMinor = grossProceedsMinor - refundsMinor - operatingReserveMinor - platformFeeMinor
  const eligibleContributions = project.contributions.filter((contribution) => contribution.status === 'ACCEPTED')
  const funderTotal = eligibleContributions.reduce((sum, contribution) => sum + contribution.amountMinor, 0)
  const funderPool = funderTotal ? Math.floor(distributablePoolMinor * project.allocationRules.funderPct / 100) : 0
  const ownerAmount = Math.floor(distributablePoolMinor * project.allocationRules.ownerPct / 100)
  const operatorAmount = distributablePoolMinor - funderPool - ownerAmount
  let distributedFunders = 0
  const allocations = eligibleContributions.map((contribution, index) => {
    const amountMinor = index === eligibleContributions.length - 1 ? funderPool - distributedFunders : funderTotal ? Math.floor(funderPool * contribution.amountMinor / funderTotal) : 0
    distributedFunders += amountMinor
    return { recipient: contribution.contributor, type: 'funder', amountMinor, fundingShareNumerator: contribution.amountMinor, fundingShareDenominator: funderTotal }
  })
  allocations.push({ recipient: project.owner, type: 'owner', amountMinor: ownerAmount })
  allocations.push({ recipient: 'Demo Operator', type: 'operator', amountMinor: operatorAmount })
  const inputData = { projectId: project.id, trades: tradesInPeriod.map((trade) => trade.id), rules: project.allocationRules, grossProceedsMinor, refundsMinor, operatingReserveMinor, platformFeeMinor, distributablePoolMinor }
  const preview = { projectId: project.id, status: 'DRAFT', periodStart, periodEnd, tradeIds: tradesInPeriod.map((trade) => trade.id), grossProceedsMinor, refundsMinor, operatingReserveMinor, platformFeeMinor, distributablePoolMinor, rulesVersion: project.allocationRules.version, rounding: 'Integer minor units; residual assigned to final eligible funder and operator remainder.', allocations, inputHash: `sha256:${createHash('sha256').update(JSON.stringify(inputData)).digest('hex')}` }
  preview.outputHash = `sha256:${createHash('sha256').update(JSON.stringify(preview)).digest('hex')}`
  return preview
}

app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))
app.use((request, response, next) => {
  response.setHeader('x-request-id', request.header('x-request-id') ?? randomUUID())
  const sendJson = response.json.bind(response)
  response.json = (body) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && response.statusCode < 400) saveMockState()
    return sendJson(body)
  }
  next()
})

app.get('/api/health', async (_request, response) => {
  let chainConnected = false
  if (chainRpcUrl) {
    try {
      const chainResponse = await fetch(chainRpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }) })
      const chain = await chainResponse.json()
      chainConnected = Number(BigInt(chain.result)) === chainId
    } catch {
      chainConnected = false
    }
  }
  response.json({ status: 'ok', database: 'sqlite-local', persistence: 'local-file', mockApi: true, blockchain: { enabled: false, connected: chainConnected, chainId, contractAddress: null, note: 'The prototype API does not submit or verify contract transactions.' }, demoMode: true, time: new Date().toISOString() })
})
app.get('/api/ready', (_request, response) => response.json({ status: 'ready', mode: 'sqlite-local-mock' }))
app.post('/api/auth/demo', (request, response) => {
  const role = request.body?.role
  if (!demoRoles.includes(role)) return response.status(400).json({ error: { message: 'Choose a valid prototype account role.', code: 'INVALID_ROLE' } })
  let user = [...users.values()].find((entry) => entry.demoKey === `bright-ledger:${role}`)
  if (!user) {
    user = { id: randomUUID(), role, displayName: `Bright Ledger ${demoNames[role]}`, walletAddress: null, demo: true, demoKey: `bright-ledger:${role}`, demoBalance: 50000, points: role === 'prosumer' ? 120 : 0 }
    users.set(user.id, user)
  }
  const token = randomUUID()
  tokens.set(token, user.id)
  response.json({ accessToken: token, user })
})

app.post('/api/auth/nonce', (request, response) => {
  try {
    const address = getAddress(request.body?.address ?? '')
    if (typeof request.body?.displayName !== 'string' || request.body.displayName.trim().length < 2) return response.status(400).json({ error: { message: 'Enter a display name with at least two characters.' } })
    const nonce = randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
    const message = `Bright Ledger account sign-in\nAddress: ${address}\nName: ${request.body.displayName.trim()}\nRole: ${request.body.role}\nNonce: ${nonce}\nExpires: ${expiresAt}`
    nonces.set(address.toLowerCase(), { nonce, expiresAt, message, purpose: 'sign-in', name: request.body.displayName.trim(), role: request.body.role })
    response.json({ nonce, expiresAt, message })
  } catch {
    response.status(400).json({ error: { message: 'A valid EVM wallet address is required.', code: 'INVALID_ADDRESS' } })
  }
})

app.post('/api/auth/verify', (request, response) => {
  try {
    const address = getAddress(request.body?.address ?? '')
    const challenge = nonces.get(address.toLowerCase())
    if (!challenge || challenge.purpose !== 'sign-in' || challenge.nonce !== request.body?.nonce || Date.parse(challenge.expiresAt) <= Date.now()) return response.status(401).json({ error: { message: 'Wallet challenge is invalid, expired or already used.', code: 'INVALID_NONCE' } })
    if (getAddress(verifyMessage(challenge.message, request.body.signature)) !== address) return response.status(401).json({ error: { message: 'Wallet signature is invalid.', code: 'INVALID_SIGNATURE' } })
    nonces.delete(address.toLowerCase())
    let user = [...users.values()].find((entry) => entry.walletAddress?.toLowerCase() === address.toLowerCase())
    if (!user) user = { id: randomUUID(), role: challenge.role, displayName: challenge.name, walletAddress: address, demo: false, demoKey: null, demoBalance: 0, points: 0 }
    else { user.role = challenge.role; user.displayName = challenge.name }
    users.set(user.id, user)
    const token = randomUUID()
    tokens.set(token, user.id)
    response.json({ accessToken: token, user })
  } catch {
    response.status(400).json({ error: { message: 'Wallet signature could not be verified.', code: 'INVALID_SIGNATURE' } })
  }
})

app.use('/api', (request, response, next) => {
  if (['/health', '/ready', '/auth/demo', '/auth/nonce', '/auth/verify'].includes(request.path)) return next()
  try {
    request.user = getUser(request)
    next()
  } catch (error) {
    errorResponse(response, error)
  }
})

app.get('/api/me', (request, response) => {
  const { id, displayName, role, walletAddress, demo } = request.user
  response.json({ id, displayName, role, walletAddress, demo })
})

app.post('/api/auth/account-removal-challenge', (request, response) => {
  const user = request.user
  if (!user.walletAddress || user.demo) return response.status(400).json({ error: { message: 'Only a wallet-backed account can be removed here.', code: 'WALLET_ACCOUNT_REQUIRED' } })
  const nonce = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
  const message = `Bright Ledger account removal\nAddress: ${getAddress(user.walletAddress)}\nAccount: ${user.id}\nNonce: ${nonce}\nExpires: ${expiresAt}\nThis anonymizes your profile and retains marketplace audit records.`
  nonces.set(user.walletAddress.toLowerCase(), { nonce, expiresAt, message, purpose: 'remove', userId: user.id })
  response.json({ nonce, expiresAt, message })
})

app.delete('/api/me', (request, response) => {
  const user = request.user
  const challenge = user.walletAddress ? nonces.get(user.walletAddress.toLowerCase()) : null
  if (!challenge || challenge.purpose !== 'remove' || challenge.userId !== user.id || challenge.nonce !== request.body?.nonce || Date.parse(challenge.expiresAt) <= Date.now()) return response.status(401).json({ error: { message: 'Account removal challenge is invalid or expired.', code: 'INVALID_NONCE' } })
  try {
    if (getAddress(verifyMessage(challenge.message, request.body.signature)) !== getAddress(user.walletAddress)) return response.status(401).json({ error: { message: 'Wallet account-removal signature is invalid.', code: 'INVALID_SIGNATURE' } })
  } catch {
    return response.status(401).json({ error: { message: 'Wallet account-removal signature is invalid.', code: 'INVALID_SIGNATURE' } })
  }
  nonces.delete(user.walletAddress.toLowerCase())
  user.displayName = 'Removed account'
  user.walletAddress = null
  user.demoBalance = 0
  for (const token of tokens.keys()) if (tokens.get(token) === user.id) tokens.delete(token)
  response.json({ message: 'Account profile removed. Existing marketplace records remain attributed to Removed account.' })
})

app.get('/api/config', (_request, response) => response.json({ demoMode: true, mockApi: true, chain: { chainId, enabled: false, contractAddress: null } }))

app.get('/api/bootstrap', (request, response) => {
  const user = request.user
  const responseProjects = projects.map((project) => ({
    id: project.id, name: project.name, location: project.location, area: project.area, target: project.target,
    raised: project.raised, capacity: project.capacity, owner: project.owner, status: project.status,
    image: project.image, siteType: project.siteType, permission: project.permission, notes: project.notes,
  }))
  const responseTrades = trades.map((trade) => ({ ...trade }))
  const responseEvidence = evidence.map((item) => ({ ...item }))
  const contributions = projects.flatMap((project) => project.contributions.map((item) => ({ id: item.id, projectId: project.id, contributor: item.contributor, amount: item.amountMinor / 100, time: new Date(item.createdAt).toLocaleDateString('en-US'), status: item.status.toLowerCase() })))
  response.json({
    listings: listings.map((item) => ({ ...item })),
    trades: responseTrades,
    evidence: responseEvidence,
    projects: responseProjects,
    contributions,
    demoBalance: user.demoBalance ?? 0,
    points: user.points ?? 0,
    activity: [
      { title: 'market.demo_seeded', detail: 'Deterministic local sample records are available for this prototype.', time: new Date().toLocaleString('en-US'), source: 'mock-api' },
      ...projects.flatMap((project) => project.timeline.slice(0, 2).map((event) => ({ title: event.action, detail: `${project.name} · ${event.detail}`, time: new Date(event.timestamp).toLocaleString('en-US'), source: 'mock-api' }))),
    ].slice(0, 30),
  })
})

app.post('/api/listings', (request, response) => {
  const { type, quantity, price, area, source, deliveryStart, deliveryEnd } = request.body ?? {}
  if (!['offer', 'request'].includes(type) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0 || typeof area !== 'string' || !area.trim()) return response.status(400).json({ error: { message: 'Enter valid listing type, quantity, USD price and service area.', code: 'INVALID_LISTING' } })
  const listing = { id: `LST-${randomUUID().slice(0, 8).toUpperCase()}`, type, owner: request.user.displayName, quantity, price, area: area.trim(), source: source ?? 'Rooftop solar', window: `${new Date(deliveryStart).toLocaleString()} – ${new Date(deliveryEnd).toLocaleString()}`, status: 'Open', isMine: true }
  listings.unshift(listing)
  response.status(201).json({ data: listing })
})

app.patch('/api/listings/:id', (request, response) => {
  const listing = listings.find((item) => item.id === request.params.id && item.isMine)
  if (!listing) return response.status(404).json({ error: { message: 'Listing not found.', code: 'NOT_FOUND' } })
  const statusMap = { pause: 'Paused', resume: 'Open', cancel: 'Cancelled' }
  if (!statusMap[request.body?.action]) return response.status(400).json({ error: { message: 'Invalid listing action.' } })
  listing.status = statusMap[request.body.action]
  response.json({ data: listing })
})

app.post('/api/trades', (request, response) => {
  const listing = listings.find((item) => item.id === request.body?.listingId && item.status === 'Open')
  const quantity = Number(request.body?.quantity)
  if (!listing || !Number.isFinite(quantity) || quantity <= 0 || quantity > listing.quantity) return response.status(400).json({ error: { message: 'Listing or trade quantity is invalid.', code: 'INVALID_MATCH' } })
  const trade = { id: `TRD-${randomUUID().slice(0, 8).toUpperCase()}`, buyer: request.user.displayName, seller: listing.owner, quantity, price: listing.price, status: 'Awaiting confirmation', time: new Date().toLocaleDateString('en-US'), hash: 'Not submitted', buyerWalletAddress: request.user.walletAddress, sellerWalletAddress: null }
  trades.unshift(trade)
  listing.quantity = Number((listing.quantity - quantity).toFixed(3))
  if (listing.quantity === 0) listing.status = 'Matched'
  response.status(201).json({ data: trade })
})

app.post('/api/projects', (request, response) => {
  const { name, location, siteType = 'Residential rooftop', area, target, permission = 'Permission pending review', notes = '' } = request.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 3 || typeof location !== 'string' || !Number.isFinite(area) || area < 10 || !Number.isFinite(target) || target <= 0) return response.status(400).json({ error: { message: 'Project name, location, site area and funding target are required.', code: 'INVALID_PROJECT' } })
  const capacityKwp = Number((area * 0.15).toFixed(3))
  const monthlyKwh = Number((capacityKwp * 5 * 0.8 * 30).toFixed(2))
  const estimate = { methodologyVersion: 'illustrative-v1', capacityKwp, dailyKwh: Number((capacityKwp * 5 * 0.8).toFixed(2)), monthlyKwh, capexMinor: Math.round(capacityKwp * 200000), currency: 'USD cents', resourceSource: 'Illustrative regional assumptions', assumptions: { panelDensityKwpPerM2: 0.15, performanceRatio: 0.8, peakSunHours: 5, costPerKwpMinor: 200000, note: 'Not an engineering estimate; survey required.' } }
  const site = { id: `SITE-${randomUUID().slice(0, 8).toUpperCase()}`, owner: request.user.displayName, name: name.trim(), location, publicLocation: location, roofAreaM2: area, usableAreaM2: area, roofType: siteType, shadingPct: 0, gridConnectionStatus: 'Unknown · demo record', reviewStatus: 'SUBMITTED', createdAt: new Date().toISOString(), evidenceRefs: [permission, notes].filter(Boolean).slice(0, 10), estimate }
  sites.unshift(site)
  const project = { id: `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`, siteId: site.id, name: site.name, location, siteType, owner: request.user.displayName, area, capacity: capacityKwp, target, raised: 0, status: 'Review', image: 'project-new', permission, notes, description: notes || 'New community solar prototype project.', expectedMonthlyKwh: monthlyKwh, fundingDeadline: '2026-12-31T23:59:59.000Z', simulationMode: true, agreementVersion: 1, agreementHash: null, allocationRules: { funderPct: 70, ownerPct: 20, operatorPct: 10, reserveMinor: 0, feeMinor: 0, version: 'waterfall-v1' }, fundingTargetMinor: Math.round(target * 100), fundingCommittedMinor: 0, fundingReceivedMinor: 0, contributions: [], batches: [], trades: [], attributes: [], settlements: [], disputes: [], milestones: [], timeline: [], impactFactor: { kgCo2ePerKwh: 0.68, source: 'Illustrative demo assumption; not a verified factor.', geography: location, period: '2026 demo period', version: 'demo-factor-v1', date: new Date().toISOString().slice(0, 10) }, pointsAwarded: false }
  recordEvent(project, 'site.submitted', `Site ${site.id} submitted for review.`, request.user.displayName)
  projects.unshift(project)
  response.status(201).json({ data: publicProject(project) })
})

app.post('/api/projects/:id/contributions', (request, response) => {
  const project = projectById(request.params.id)
  const amount = Number(request.body?.amount)
  const key = request.body?.idempotencyKey
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (project.disputes.some((dispute) => dispute.status === 'OPEN')) return response.status(409).json({ error: { message: 'Funding is frozen while this project has an open dispute.', code: 'PROJECT_FROZEN' } })
  if (key && idempotency.has(key)) return response.json({ data: idempotency.get(key) })
  if (project.status !== 'Funding' || !Number.isFinite(amount) || amount <= 0 || amount * 100 > project.fundingTargetMinor - project.fundingReceivedMinor || amount > request.user.demoBalance) return response.status(409).json({ error: { message: 'Contribution exceeds available demo balance or project funding target.', code: 'CONTRIBUTION_LIMIT' } })
  const contribution = { id: `CON-${randomUUID().slice(0, 8).toUpperCase()}`, contributor: request.user.displayName, amountMinor: Math.round(amount * 100), currency: 'BL demo credits', status: 'ACCEPTED', createdAt: new Date().toISOString(), fundingShare: 0, receipt: `RCP-${randomUUID().slice(0, 8).toUpperCase()}` }
  project.contributions.push(contribution)
  request.user.demoBalance -= amount
  project.fundingReceivedMinor += contribution.amountMinor
  project.fundingCommittedMinor += contribution.amountMinor
  project.raised = project.fundingReceivedMinor / 100
  for (const item of project.contributions) item.fundingShare = Number((item.amountMinor / project.fundingReceivedMinor * 100).toFixed(2))
  if (project.fundingReceivedMinor >= project.fundingTargetMinor) {
    project.status = 'Funded'
    project.milestones.push({ id: randomUUID(), title: 'Funding target reached', status: 'COMPLETED', simulated: true, at: new Date().toISOString() })
  }
  recordEvent(project, 'funding.contribution_accepted', `${contribution.contributor} contributed ${amount} BL demo credits.`, request.user.displayName, { contributionId: contribution.id, idempotencyKey: key ?? null })
  if (key) idempotency.set(key, { id: contribution.id, amount, duplicate: false })
  response.status(201).json({ data: { id: contribution.id, amount, duplicate: false, receipt: contribution.receipt, status: contribution.status } })
})

app.get('/api/solar/sites', (request, response) => {
  const status = request.query.status
  const page = Math.max(1, Number(request.query.page ?? 1))
  const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 30)))
  const filtered = sites.filter((site) => !status || site.reviewStatus === String(status).toUpperCase())
  response.json({ data: filtered.slice((page - 1) * limit, page * limit), page, limit, total: filtered.length })
})

app.post('/api/solar/sites', (request, response) => {
  const user = request.user
  const input = request.body ?? {}
  if (typeof input.name !== 'string' || input.name.trim().length < 3 || typeof input.location !== 'string' || input.location.trim().length < 2 || !Number.isFinite(input.roofAreaM2) || input.roofAreaM2 < 10 || !Number.isFinite(input.usableAreaM2) || input.usableAreaM2 <= 0 || input.usableAreaM2 > input.roofAreaM2 || !Number.isFinite(input.shadingPct) || input.shadingPct < 0 || input.shadingPct > 100) return response.status(400).json({ error: { message: 'Enter valid site name, approximate location, roof/usable area and shading percentage.', code: 'INVALID_SITE' } })
  const site = { id: `SITE-${randomUUID().slice(0, 8).toUpperCase()}`, owner: user.displayName, name: input.name.trim(), location: input.location.trim(), publicLocation: input.location.trim(), roofAreaM2: input.roofAreaM2, usableAreaM2: input.usableAreaM2, roofType: input.roofType ?? 'Residential rooftop', shadingPct: input.shadingPct, gridConnectionStatus: input.gridConnectionStatus ?? 'Unknown', reviewStatus: 'SUBMITTED', createdAt: new Date().toISOString(), evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs.slice(0, 10) : [], estimate: null }
  sites.unshift(site)
  response.status(201).json({ data: site })
})

app.get('/api/solar/sites/:id', (request, response) => {
  const site = sites.find((item) => item.id === request.params.id)
  if (!site) return response.status(404).json({ error: { message: 'Site not found.', code: 'NOT_FOUND' } })
  response.json({ data: site })
})

app.post('/api/solar/sites/:id/estimate', (request, response) => {
  const site = sites.find((item) => item.id === request.params.id)
  if (!site) return response.status(404).json({ error: { message: 'Site not found.', code: 'NOT_FOUND' } })
  const density = Number(request.body?.panelDensityKwpPerM2 ?? 0.15)
  const peakSunHours = Number(request.body?.peakSunHours ?? 5)
  const costPerKwpMinor = Number(request.body?.costPerKwpMinor ?? 200000)
  if (density <= 0 || density > 0.3 || peakSunHours <= 0 || peakSunHours > 10 || costPerKwpMinor < 0) return response.status(400).json({ error: { message: 'Estimate assumptions are outside supported demo limits.', code: 'INVALID_ESTIMATE_ASSUMPTIONS' } })
  const capacityKwp = Number((site.usableAreaM2 * density).toFixed(3))
  site.estimate = { methodologyVersion: 'illustrative-v1', capacityKwp, dailyKwh: Number((capacityKwp * peakSunHours * (1 - site.shadingPct / 100) * 0.8).toFixed(2)), monthlyKwh: Number((capacityKwp * peakSunHours * (1 - site.shadingPct / 100) * 0.8 * 30).toFixed(2)), capexMinor: Math.round(capacityKwp * costPerKwpMinor), currency: 'USD cents', resourceSource: 'User-selected illustrative peak-sun-hours assumption', assumptions: { panelDensityKwpPerM2: density, performanceRatio: 0.8, peakSunHours, shadingPct: site.shadingPct, costPerKwpMinor, note: 'Illustrative estimate — site survey required.' }, createdAt: new Date().toISOString() }
  response.json({ data: site.estimate })
})

app.post('/api/solar/sites/:id/submit', (request, response) => {
  const site = sites.find((item) => item.id === request.params.id)
  if (!site) return response.status(404).json({ error: { message: 'Site not found.', code: 'NOT_FOUND' } })
  site.reviewStatus = 'SUBMITTED'
  response.json({ data: site })
})

app.post('/api/solar/sites/:id/review', (request, response) => {
  requireRoles(request.user, ['verifier', 'admin'])
  const site = sites.find((item) => item.id === request.params.id)
  if (!site) return response.status(404).json({ error: { message: 'Site not found.', code: 'NOT_FOUND' } })
  const decision = request.body?.decision
  if (!['APPROVED', 'REJECTED', 'NEEDS_CHANGES'].includes(decision)) return response.status(400).json({ error: { message: 'Choose APPROVED, REJECTED or NEEDS_CHANGES.' } })
  site.reviewStatus = decision
  const project = projects.find((item) => item.siteId === site.id)
  if (project) {
    if (decision === 'APPROVED') project.status = 'Draft'
    if (decision === 'NEEDS_CHANGES' || decision === 'REJECTED') project.status = 'Review'
    recordEvent(project, 'site.reviewed', `Site review decision: ${decision}. ${String(request.body.reason ?? '').slice(0, 240)}`, request.user.displayName)
  }
  response.json({ data: site })
})

app.get('/api/solar/projects', (request, response) => {
  const status = request.query.status
  const page = Math.max(1, Number(request.query.page ?? 1))
  const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 30)))
  const filtered = projects.filter((project) => !status || project.status.toLowerCase() === String(status).toLowerCase())
  response.json({ data: filtered.slice((page - 1) * limit, page * limit).map(publicProject), page, limit, total: filtered.length })
})

app.post('/api/solar/projects', (request, response) => {
  const input = request.body ?? {}
  const site = sites.find((item) => item.id === input.siteId)
  const targetMinor = Number(input.fundingTargetMinor)
  const funderPct = Number(input.allocationRules?.funderPct ?? 70)
  const ownerPct = Number(input.allocationRules?.ownerPct ?? 20)
  const operatorPct = Number(input.allocationRules?.operatorPct ?? 10)
  if (!site || typeof input.name !== 'string' || input.name.trim().length < 3 || !Number.isSafeInteger(targetMinor) || targetMinor <= 0 || funderPct + ownerPct + operatorPct !== 100) return response.status(400).json({ error: { message: 'Choose an existing site, valid funding target and allocation shares totaling 100%.', code: 'INVALID_PROJECT' } })
  if (site.owner !== request.user.displayName && !['admin', 'verifier'].includes(request.user.role)) return response.status(403).json({ error: { message: 'Only the site owner or a project operator can create a project for this site.', code: 'FORBIDDEN' } })
  const project = { id: `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`, siteId: site.id, name: input.name.trim(), location: site.publicLocation, siteType: site.roofType, owner: site.owner, area: site.usableAreaM2, capacity: Number((input.capacityKwp ?? site.estimate?.capacityKwp ?? site.usableAreaM2 / 7.5).toFixed(3)), target: targetMinor / 100, raised: 0, status: site.reviewStatus === 'APPROVED' ? 'Draft' : 'Review', image: 'project-new', permission: input.permission ?? 'Owner permission stated', notes: input.description ?? '', description: input.description ?? '', expectedMonthlyKwh: Number(input.expectedMonthlyKwh ?? site.estimate?.monthlyKwh ?? 0), fundingDeadline: input.fundingDeadline ?? '2026-12-31T23:59:59.000Z', simulationMode: true, agreementVersion: 1, agreementHash: null, allocationRules: { funderPct, ownerPct, operatorPct, reserveMinor: Number(input.allocationRules?.reserveMinor ?? 0), feeMinor: Number(input.allocationRules?.feeMinor ?? 0), version: 'waterfall-v1' }, fundingTargetMinor: targetMinor, fundingCommittedMinor: 0, fundingReceivedMinor: 0, contributions: [], batches: [], trades: [], attributes: [], settlements: [], disputes: [], milestones: [], timeline: [], impactFactor: { kgCo2ePerKwh: Number(input.impactFactor?.kgCo2ePerKwh ?? 0.68), source: input.impactFactor?.source ?? 'Illustrative demo assumption; not a verified factor.', geography: site.publicLocation, period: '2026 demo period', version: 'demo-factor-v1', date: new Date().toISOString().slice(0, 10) }, pointsAwarded: false }
  recordEvent(project, 'project.created', `Draft project created for site ${site.id}.`, request.user.displayName)
  projects.unshift(project)
  response.status(201).json({ data: publicProject(project) })
})

app.get('/api/solar/projects/:id', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  response.json({ data: projectOverview(project) })
})

app.get('/api/solar/projects/:id/timeline', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  response.json({ data: project.timeline })
})

app.post('/api/solar/projects/:id/publish', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (project.disputes.some((dispute) => dispute.status === 'OPEN')) return response.status(409).json({ error: { message: 'Resolve open disputes before publishing or funding.', code: 'PROJECT_FROZEN' } })
  const site = sites.find((item) => item.id === project.siteId)
  if (site?.reviewStatus !== 'APPROVED') return response.status(409).json({ error: { message: 'Site approval is required before funding opens.', code: 'SITE_NOT_APPROVED' } })
  if (project.owner !== request.user.displayName && !['admin', 'verifier'].includes(request.user.role)) return response.status(403).json({ error: { message: 'Only the project owner or an authorized operator can publish this project.', code: 'FORBIDDEN' } })
  if (project.status !== 'Review' && project.status !== 'Draft') return response.status(409).json({ error: { message: 'Project cannot be published from its current state.', code: 'INVALID_PROJECT_STATE' } })
  project.status = 'Funding'
  project.agreementHash ??= `sha256:${createHash('sha256').update(JSON.stringify(project.allocationRules)).digest('hex')}`
  recordEvent(project, 'project.published', 'Project agreement and simulated funding terms published.', request.user.displayName, { agreementHash: project.agreementHash })
  response.json({ data: publicProject(project) })
})

app.post('/api/solar/projects/:id/cancel', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (project.owner !== request.user.displayName && !['admin', 'verifier'].includes(request.user.role)) return response.status(403).json({ error: { message: 'Only the project owner or an authorized operator can cancel this project.', code: 'FORBIDDEN' } })
  if (project.disputes.some((dispute) => dispute.status === 'OPEN')) return response.status(409).json({ error: { message: 'Resolve open disputes before cancelling a project.', code: 'PROJECT_FROZEN' } })
  if (project.status === 'Completed' || project.status === 'Cancelled') return response.status(409).json({ error: { message: 'A terminal project cannot be cancelled again.', code: 'INVALID_PROJECT_STATE' } })
  const previousState = project.status
  project.status = 'Cancelled'
  for (const contribution of project.contributions) {
    if (contribution.status === 'ACCEPTED') {
      contribution.status = 'REFUNDED'
      const funder = [...users.values()].find((user) => user.displayName === contribution.contributor)
      if (funder) funder.demoBalance = (funder.demoBalance ?? 0) + contribution.amountMinor / 100
      recordEvent(project, 'funding.refund_credited', `Simulated refund recorded for contribution ${contribution.id}.`, request.user.displayName, { contributionId: contribution.id })
    }
  }
  project.fundingReceivedMinor = 0
  project.raised = 0
  recordEvent(project, 'project.cancelled', `Project cancelled from ${previousState}; accepted demo contributions were reversed in the mock ledger.`, request.user.displayName)
  response.json({ data: publicProject(project) })
})

app.post('/api/solar/projects/:id/close-funding', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (project.owner !== request.user.displayName && !['admin', 'verifier'].includes(request.user.role)) return response.status(403).json({ error: { message: 'Only the project owner or an authorized operator can close funding.', code: 'FORBIDDEN' } })
  if (project.disputes.some((dispute) => dispute.status === 'OPEN')) return response.status(409).json({ error: { message: 'Resolve open disputes before closing funding.', code: 'PROJECT_FROZEN' } })
  if (project.status !== 'Funding') return response.status(409).json({ error: { message: 'Funding is not open for this project.', code: 'INVALID_PROJECT_STATE' } })
  if (project.fundingReceivedMinor >= project.fundingTargetMinor) {
    project.status = 'Funded'
    recordEvent(project, 'funding.closed_successfully', 'Funding target reached and funding is closed.', request.user.displayName)
  } else {
    project.status = 'FUNDING_FAILED'
    for (const contribution of project.contributions) if (contribution.status === 'ACCEPTED') {
      contribution.status = 'REFUNDED'
      const funder = [...users.values()].find((user) => user.displayName === contribution.contributor)
      if (funder) funder.demoBalance = (funder.demoBalance ?? 0) + contribution.amountMinor / 100
      recordEvent(project, 'funding.refund_credited', `Funding failed; simulated refund recorded for ${contribution.id}.`, request.user.displayName)
    }
    project.fundingReceivedMinor = 0
    project.raised = 0
    recordEvent(project, 'funding.failed', 'Funding closed below target; demo refund records were created.', request.user.displayName)
  }
  response.json({ data: publicProject(project) })
})

app.get('/api/solar/projects/:id/contributions', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  response.json({ data: project.contributions })
})

app.get('/api/solar/contributions/:id/receipt', (request, response) => {
  const project = projects.find((item) => item.contributions.some((contribution) => contribution.id === request.params.id))
  const contribution = project?.contributions.find((item) => item.id === request.params.id)
  if (!contribution) return response.status(404).json({ error: { message: 'Contribution receipt not found.', code: 'NOT_FOUND' } })
  response.json({ data: { ...contribution, projectId: project.id, projectName: project.name, disclaimer: 'Simulated contribution; not a payment or investment.' } })
})

app.post('/api/solar/projects/:id/milestones', (request, response) => {
  const project = projectById(request.params.id)
  const title = String(request.body?.title ?? '').trim()
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (title.length < 3) return response.status(400).json({ error: { message: 'Enter a milestone name.' } })
  const milestone = { id: `MS-${randomUUID().slice(0, 8).toUpperCase()}`, title: title.slice(0, 100), status: 'SUBMITTED', simulated: true, at: new Date().toISOString(), evidenceReference: String(request.body?.evidenceReference ?? '').slice(0, 160), evidenceHash: `sha256:${createHash('sha256').update(String(request.body?.evidenceReference ?? '')).digest('hex')}` }
  project.milestones.push(milestone)
  recordEvent(project, 'milestone.submitted', `Simulated project milestone submitted: ${milestone.title}.`, request.user.displayName, { milestoneId: milestone.id })
  response.status(201).json({ data: milestone })
})

app.post('/api/solar/projects/:projectId/milestones/:milestoneId/verify', (request, response) => {
  requireRoles(request.user, ['verifier', 'admin'])
  const project = projectById(request.params.projectId)
  const milestone = project?.milestones.find((item) => item.id === request.params.milestoneId)
  if (!project || !milestone) return response.status(404).json({ error: { message: 'Milestone not found.', code: 'NOT_FOUND' } })
  if (!['APPROVED', 'REJECTED', 'NEEDS_CHANGES'].includes(request.body?.decision)) return response.status(400).json({ error: { message: 'Choose a valid milestone decision.' } })
  milestone.status = request.body.decision
  milestone.verifiedBy = request.user.displayName
  milestone.verifiedAt = new Date().toISOString()
  if (milestone.title.toLowerCase().includes('installation') && milestone.status === 'APPROVED' && project.status === 'Funded') project.status = 'Operational'
  recordEvent(project, 'milestone.reviewed', `Milestone ${milestone.title} marked ${milestone.status}.`, request.user.displayName, { milestoneId: milestone.id })
  response.json({ data: milestone })
})

app.post('/api/solar/projects/:id/generation-batches', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (!['Funded', 'Operational'].includes(project.status)) return response.status(409).json({ error: { message: 'The project must reach its funding target before generation can be recorded.', code: 'PROJECT_NOT_FUNDED' } })
  if (project.status === 'DISPUTED' || project.disputes.some((dispute) => dispute.status === 'OPEN')) return response.status(409).json({ error: { message: 'Generation submission is frozen while this project has an open dispute.', code: 'PROJECT_FROZEN' } })
  const input = request.body ?? {}
  const start = Date.parse(input.intervalStart)
  const end = Date.parse(input.intervalEnd)
  const kwh = Number(input.energyKwh)
  if (!Number.isFinite(kwh) || kwh < 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !['simulator', 'csv', 'api', 'meter'].includes(input.sourceType ?? 'simulator')) return response.status(400).json({ error: { message: 'Enter a non-negative kWh reading, valid interval, and supported source type.', code: 'INVALID_GENERATION_BATCH' } })
  const intervalKey = `${project.id}:${input.meterRefHash ?? 'demo-meter'}:${new Date(start).toISOString()}:${new Date(end).toISOString()}`
  const key = request.header('idempotency-key') ?? input.idempotencyKey
  const payload = { projectId: project.id, meterRefHash: input.meterRefHash ?? 'sha256:demo-meter', intervalStart: new Date(start).toISOString(), intervalEnd: new Date(end).toISOString(), energyWh: Math.round(kwh * 1000), sourceType: input.sourceType ?? 'simulator', sourceReference: String(input.sourceReference ?? '').slice(0, 160), unit: input.unit ?? 'kWh' }
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  if (key && idempotency.has(key)) {
    const previous = idempotency.get(key)
    if (previous?.kind === 'generation' && previous.fingerprint === fingerprint) return response.json({ data: previous.value, duplicate: true })
    return response.status(409).json({ error: { message: 'Idempotency key was already used for a different action or payload.', code: 'IDEMPOTENCY_CONFLICT' } })
  }
  const duplicate = project.batches.find((batch) => `${project.id}:${batch.meterRefHash}:${batch.intervalStart}:${batch.intervalEnd}` === intervalKey)
  if (duplicate) return response.status(409).json({ error: { message: 'A generation reading already exists for this meter interval.', code: 'DUPLICATE_INTERVAL' } })
  const anomalyFlags = kwh > Math.max(1000, project.capacity * 10) ? ['Reading exceeds configured hourly plausibility threshold'] : []
  const batch = { id: `GEN-${randomUUID().slice(0, 8).toUpperCase()}`, ...payload, payloadHash: `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`, verificationStatus: anomalyFlags.length ? 'NEEDS_REVIEW' : 'SUBMITTED', anomalyFlags, submittedBy: request.user.displayName, verifiedBy: null, verifiedAt: null, createdAt: new Date().toISOString(), tradedWh: 0, allocatedWh: 0 }
  project.batches.unshift(batch)
  if (key) idempotency.set(key, { kind: 'generation', fingerprint, value: batch })
  recordEvent(project, 'generation.submitted', `Submitted ${kwh} kWh from ${batch.sourceType}; payload hash ${batch.payloadHash}.`, request.user.displayName, { batchId: batch.id, anomalyFlags })
  response.status(201).json({ data: batch })
})

app.post('/api/solar/generation-batches/:id/decision', (request, response) => {
  requireRoles(request.user, ['verifier', 'admin'])
  const project = projects.find((item) => item.batches.some((batch) => batch.id === request.params.id))
  const batch = project?.batches.find((item) => item.id === request.params.id)
  if (!project || !batch) return response.status(404).json({ error: { message: 'Generation batch not found.', code: 'NOT_FOUND' } })
  if (batch.verificationStatus === 'VERIFIED' || batch.verificationStatus === 'REJECTED') return response.status(409).json({ error: { message: 'A reviewed batch is immutable; create a correction event instead.', code: 'BATCH_ALREADY_REVIEWED' } })
  if (!['VERIFIED', 'REJECTED', 'NEEDS_REVIEW'].includes(request.body?.decision)) return response.status(400).json({ error: { message: 'Choose a valid verification decision.' } })
  batch.verificationStatus = request.body.decision
  batch.verifiedBy = request.user.displayName
  batch.verifiedAt = new Date().toISOString()
  if (request.body.decision === 'REJECTED' && request.body.reason) batch.anomalyFlags.push(`Verifier rejected: ${String(request.body.reason).slice(0, 240)}`)
  if (request.body.decision === 'VERIFIED') {
    project.status = project.status === 'Funded' ? 'Operational' : project.status
    project.milestones.push({ id: randomUUID(), title: 'Generation batch verified', status: 'COMPLETED', simulated: true, at: batch.verifiedAt, reference: batch.id })
    if (!project.pointsAwarded) {
      const points = Math.floor(batch.energyWh / 1000) * 10
      const user = [...users.values()].find((entry) => entry.displayName === batch.submittedBy)
      if (user && points > 0) user.points = (user.points ?? 0) + points
      project.pointsAwarded = true
    }
  }
  recordEvent(project, `generation.${request.body.decision.toLowerCase()}`, `Generation batch ${batch.id} marked ${request.body.decision}.`, request.user.displayName, { batchId: batch.id, reason: request.body.reason ?? null })
  response.json({ data: batch })
})

app.post('/api/solar/projects/:id/market-trades', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (!['Funded', 'Operational'].includes(project.status)) return response.status(409).json({ error: { message: 'The project must be funded before energy can be traded.', code: 'PROJECT_NOT_FUNDED' } })
  if (!['prosumer', 'both', 'space_owner', 'verifier', 'admin'].includes(request.user.role)) return response.status(403).json({ error: { message: 'A prosumer, site owner or authorized verifier role is required to record a sale.', code: 'FORBIDDEN' } })
  if (project.disputes.some((dispute) => dispute.status === 'OPEN')) return response.status(409).json({ error: { message: 'Trading is frozen while this project has an open dispute.', code: 'PROJECT_FROZEN' } })
  const input = request.body ?? {}
  const batch = project.batches.find((item) => item.id === input.generationBatchId)
  const energyKwh = Number(input.energyKwh)
  const priceMinorPerKwh = Math.round(Number(input.priceUSDPerKwh) * 100)
  const energyWh = Math.round(energyKwh * 1000)
  const key = request.header('idempotency-key') ?? input.idempotencyKey
  if (key && idempotency.has(key)) {
    const previous = idempotency.get(key)
    if (previous?.kind === 'solar-trade' && previous.trade.generationBatchId === input.generationBatchId && previous.trade.energyWh === energyWh && previous.trade.priceMinorPerKwh === priceMinorPerKwh) return response.json({ data: previous.trade, duplicate: true })
    return response.status(409).json({ error: { message: 'Idempotency key was already used for a different action.', code: 'IDEMPOTENCY_CONFLICT' } })
  }
  if (!batch || batch.verificationStatus !== 'VERIFIED' || !Number.isSafeInteger(energyWh) || energyWh <= 0 || !Number.isSafeInteger(priceMinorPerKwh) || priceMinorPerKwh <= 0 || energyWh > batch.energyWh - (batch.tradedWh ?? 0)) return response.status(409).json({ error: { message: 'Choose verified, untraded generation and a valid USD/kWh price.', code: 'INVALID_PROJECT_TRADE' } })
  const trade = { id: `TRD-${randomUUID().slice(0, 8).toUpperCase()}`, generationBatchId: batch.id, energyWh, priceMinorPerKwh, grossAmountMinor: Math.round(energyWh * priceMinorPerKwh / 1000), status: 'SETTLED', source: 'Simulated project-market record; no payment or delivery.', simulationMode: true, createdAt: new Date().toISOString() }
  batch.tradedWh = (batch.tradedWh ?? 0) + energyWh
  project.trades.unshift(trade)
  recordEvent(project, 'market.trade_recorded', `${energyWh} Wh recorded at ${priceMinorPerKwh} USD cents/kWh; simulated proceeds ${trade.grossAmountMinor} USD cents.`, request.user.displayName, { tradeId: trade.id, generationBatchId: batch.id, idempotencyKey: key ?? null })
  if (key) idempotency.set(key, { kind: 'solar-trade', trade })
  response.status(201).json({ data: trade })
})

app.post('/api/solar/projects/:id/attributes/allocate', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  const batch = project.batches.find((item) => item.id === request.body?.generationBatchId)
  const tradeId = String(request.body?.tradeId ?? '').trim()
  const energyWh = Number(request.body?.energyWh)
  const key = request.header('idempotency-key') ?? request.body?.idempotencyKey
  const fingerprint = createHash('sha256').update(JSON.stringify({ projectId: project.id, generationBatchId: batch?.id ?? null, tradeId, energyWh })).digest('hex')
  if (key && idempotency.has(key)) {
    const previous = idempotency.get(key)
    if (previous?.kind === 'attribute' && previous.fingerprint === fingerprint) return response.json({ data: previous.value, duplicate: true })
    return response.status(409).json({ error: { message: 'Idempotency key was already used for a different action or payload.', code: 'IDEMPOTENCY_CONFLICT' } })
  }
  const trade = project.trades.find((item) => item.id === tradeId)
  if (!trade) return response.status(404).json({ error: { message: 'A related trade record is required.', code: 'TRADE_NOT_FOUND' } })
  const allocatedToTradeWh = project.attributes.filter((attribute) => attribute.allocatedToTradeId === tradeId).reduce((sum, attribute) => sum + attribute.energyWh, 0)
  if (!batch || batch.verificationStatus !== 'VERIFIED' || !trade || trade.generationBatchId !== batch.id || !Number.isSafeInteger(energyWh) || energyWh <= 0 || energyWh > trade.energyWh - allocatedToTradeWh) return response.status(409).json({ error: { message: 'Choose a verified generation batch and allocate no more energy than the linked trade has available.', code: 'ATTRIBUTE_OVERALLOCATION' } })
  batch.allocatedWh += energyWh
  const attribute = { id: `ATR-${randomUUID().slice(0, 8).toUpperCase()}`, generationBatchId: batch.id, energyWh, status: 'ALLOCATED', allocatedToTradeId: tradeId, methodologyVersion: 'renewable-attribute-demo-v1', location: project.location, intervalStart: batch.intervalStart, intervalEnd: batch.intervalEnd, label: 'Demo renewable-energy attribute — not an official certificate.' }
  project.attributes.push(attribute)
  recordEvent(project, 'attribute.allocated', `${energyWh} Wh linked to trade ${tradeId}.`, request.user.displayName, { attributeId: attribute.id, generationBatchId: batch.id, tradeId })
  if (key) idempotency.set(key, { kind: 'attribute', fingerprint, value: attribute })
  response.status(201).json({ data: attribute })
})

function previewSettlement(request, response) {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  const openDispute = project.disputes.find((dispute) => dispute.status === 'OPEN')
  if (openDispute) return response.status(409).json({ error: { message: 'Settlement is frozen until the project dispute is resolved.', code: 'PROJECT_FROZEN' } })
  if (!project.batches.some((batch) => batch.verificationStatus === 'VERIFIED')) return response.status(409).json({ error: { message: 'Settlement needs at least one verified generation batch.', code: 'VERIFIED_GENERATION_REQUIRED' } })
  const preview = buildSettlementPreview(project, request.body ?? {})
  if (preview.tradeIds.length === 0) return response.status(409).json({ error: { message: 'There are no unsettled trade proceeds to allocate.', code: 'SETTLED_TRADES_REQUIRED' } })
  response.json({ data: preview })
}

app.get('/api/solar/projects/:id/settlement-runs/preview', previewSettlement)
app.post('/api/solar/projects/:id/settlement-runs/preview', previewSettlement)

app.post('/api/solar/projects/:id/settlement-runs', (request, response) => {
  requireRoles(request.user, ['verifier', 'admin'])
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  const openDispute = project.disputes.find((dispute) => dispute.status === 'OPEN')
  if (openDispute) return response.status(409).json({ error: { message: 'Settlement is frozen until the project dispute is resolved.', code: 'PROJECT_FROZEN' } })
  const key = request.header('idempotency-key') ?? request.body?.idempotencyKey
  if (key && idempotency.has(key)) {
    const previous = idempotency.get(key)
    if (previous?.outputHash === request.body?.outputHash) return response.json({ data: previous, duplicate: true })
    return response.status(409).json({ error: { message: 'Idempotency key was already used for a different settlement.', code: 'IDEMPOTENCY_CONFLICT' } })
  }
  if (!request.body?.inputHash || !request.body?.outputHash) return response.status(400).json({ error: { message: 'Submit a settlement preview with its hashes and allocation breakdown.', code: 'INVALID_SETTLEMENT' } })
  const expected = buildSettlementPreview(project, request.body)
  if (request.body.inputHash !== expected.inputHash || request.body.outputHash !== expected.outputHash || JSON.stringify(request.body.allocations) !== JSON.stringify(expected.allocations) || request.body.distributablePoolMinor !== expected.distributablePoolMinor) return response.status(409).json({ error: { message: 'Settlement preview no longer matches the current ledger. Preview it again before finalizing.', code: 'SETTLEMENT_PREVIEW_STALE' } })
  if (expected.tradeIds.length === 0) return response.status(409).json({ error: { message: 'There are no unsettled trade proceeds to allocate.', code: 'SETTLED_TRADES_REQUIRED' } })
  const allocationTotal = expected.allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0)
  if (allocationTotal !== expected.distributablePoolMinor) return response.status(409).json({ error: { message: 'Settlement allocations do not equal the distributable pool.', code: 'SETTLEMENT_TOTAL_MISMATCH' } })
  const run = { ...expected, id: `SET-${randomUUID().slice(0, 8).toUpperCase()}`, status: 'FINALIZED', finalizedAt: new Date().toISOString(), rulesVersion: project.allocationRules.version }
  project.settlements.unshift(run)
  project.status = 'Completed'
  recordEvent(project, 'settlement.finalized', `Settlement ${run.id} finalized for ${allocationTotal} minor units.`, request.user.displayName, { runId: run.id, outputHash: run.outputHash })
  if (key) idempotency.set(key, run)
  response.status(201).json({ data: run })
})

app.get('/api/solar/projects/:id/impact', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  response.json({ data: projectOverview(project).impact })
})
app.get('/api/solar/projects/:id/renewable-attributes', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  response.json({ data: project.attributes })
})
app.get('/api/solar/projects/:id/audit-events', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  response.json({ data: project.timeline })
})
app.post('/api/solar/projects/:id/disputes', (request, response) => {
  const project = projectById(request.params.id)
  const reason = String(request.body?.reason ?? '').trim()
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  if (reason.length < 8) return response.status(400).json({ error: { message: 'Provide a dispute reason with at least eight characters.', code: 'INVALID_DISPUTE' } })
  const dispute = { id: `DSP-${randomUUID().slice(0, 8).toUpperCase()}`, reason: reason.slice(0, 500), status: 'OPEN', createdBy: request.user.displayName, createdAt: new Date().toISOString(), resolution: null, relatedEntityId: request.body?.relatedEntityId ?? null }
  if (!project.disputes.some((item) => item.status === 'OPEN')) project.statusBeforeDispute = project.status
  project.disputes.unshift(dispute)
  project.status = 'DISPUTED'
  recordEvent(project, 'dispute.opened', `Dispute opened: ${dispute.reason}`, request.user.displayName, { disputeId: dispute.id, relatedEntityId: dispute.relatedEntityId })
  response.status(201).json({ data: dispute })
})
app.post('/api/solar/disputes/:id/resolve', (request, response) => {
  requireRoles(request.user, ['verifier', 'admin'])
  const project = projects.find((item) => item.disputes.some((dispute) => dispute.id === request.params.id))
  const dispute = project?.disputes.find((item) => item.id === request.params.id)
  const resolution = String(request.body?.resolution ?? '').trim()
  if (!project || !dispute) return response.status(404).json({ error: { message: 'Dispute not found.', code: 'NOT_FOUND' } })
  if (dispute.status !== 'OPEN' || resolution.length < 8) return response.status(409).json({ error: { message: 'An open dispute and a resolution note of at least eight characters are required.', code: 'INVALID_DISPUTE_RESOLUTION' } })
  dispute.status = 'RESOLVED'
  dispute.resolution = resolution.slice(0, 500)
  dispute.resolvedBy = request.user.displayName
  dispute.resolvedAt = new Date().toISOString()
  if (!project.disputes.some((item) => item.status === 'OPEN')) {
    project.status = project.statusBeforeDispute ?? (project.fundingReceivedMinor >= project.fundingTargetMinor ? 'Operational' : 'Funding')
    delete project.statusBeforeDispute
  }
  recordEvent(project, 'dispute.resolved', `Dispute ${dispute.id} resolved: ${dispute.resolution}`, request.user.displayName, { disputeId: dispute.id })
  response.json({ data: dispute })
})

app.get('/api/solar/projects/:id/export', (request, response) => {
  const project = projectById(request.params.id)
  if (!project) return response.status(404).json({ error: { message: 'Project not found.', code: 'PROJECT_NOT_FOUND' } })
  response.setHeader('content-type', 'application/json')
  response.setHeader('content-disposition', `attachment; filename="${project.id.toLowerCase()}-demo-report.json"`)
  response.json({ disclaimer: 'Prototype export; all demo records are simulated.', project: publicProject(project), site: sites.find((site) => site.id === project.siteId), funding: project.contributions, generation: project.batches, attributes: project.attributes, settlements: project.settlements, impact: projectOverview(project).impact, disputes: project.disputes, auditEvents: project.timeline })
})

app.post('/api/evidence/:id/review', (request, response) => {
  const item = evidence.find((entry) => entry.id === request.params.id)
  if (!item) return response.status(404).json({ error: { message: 'Evidence not found.' } })
  item.status = request.body?.decision === 'approve' ? 'Approved' : 'Rejected'
  item.reason = request.body?.reason
  response.json({ data: item })
})
app.post('/api/trades/:id/evidence', (request, response) => {
  const trade = trades.find((item) => item.id === request.params.id)
  if (!trade) return response.status(404).json({ error: { message: 'Trade not found.' } })
  const item = { id: `EVD-${randomUUID().slice(0, 8).toUpperCase()}`, project: 'Sunrise Community Roof', source: request.body?.source ?? 'Simulated smart meter', quantity: Number(request.body?.quantity ?? trade.quantity), interval: request.body?.intervalStart ?? 'Demo interval', status: 'Pending', trade: trade.id, reference: request.body?.reference ?? 'sample://evidence' }
  evidence.unshift(item)
  trade.status = 'Under review'
  response.status(201).json({ data: item })
})
app.post('/api/trades/:id/evidence/ai-review', (_request, response) => response.status(503).json({ error: { message: 'AI evidence review requires the separate production API service; mock API does not upload evidence to third parties.', code: 'MOCK_AI_DISABLED' } }))
app.post('/api/trades/:id/confirm', (request, response) => {
  const trade = trades.find((item) => item.id === request.params.id)
  if (!trade) return response.status(404).json({ error: { message: 'Trade not found.' } })
  trade.status = 'Evidence needed'
  response.json({ data: trade })
})
app.post('/api/trades/:id/settle', (request, response) => {
  const trade = trades.find((item) => item.id === request.params.id)
  if (!trade) return response.status(404).json({ error: { message: 'Trade not found.' } })
  trade.status = 'Settled'
  response.json({ data: trade })
})
app.post('/api/trades/:id/commitment', (_request, response) => response.status(503).json({ error: { message: 'The SQLite prototype API does not submit or verify blockchain transactions. Use the persistent backend with a configured contract for chain-backed actions.', code: 'MOCK_CHAIN_DISABLED' } }))

app.use((error, _request, response, _next) => {
  console.error('Mock API request failed:', error)
  response.status(error.status ?? 500).json({ error: { message: error.status ? error.message : 'Mock API internal error.', code: error.code ?? 'MOCK_API_ERROR' } })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Bright Ledger SQLite mock API listening on :${port}`)
  console.log(`SQLite database: ${databasePath}`)
  console.log(`Loaded ${sites.length} rooftop sites and ${projects.length} solar projects; successful changes persist across restarts.`)
})
