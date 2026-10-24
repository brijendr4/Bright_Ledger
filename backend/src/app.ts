import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { keccak256, toUtf8Bytes, JsonRpcProvider, Interface, getAddress } from 'ethers'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import { z } from 'zod'
import { requireAuth, allowRoles, createWalletNonce, verifyWalletSignature, createAccountRemovalChallenge, removeWalletAccount, revokeCurrentSession } from './auth.js'
import { query, transaction } from './db.js'
import { asyncRoute, errorHandler, HttpError } from './errors.js'
import { findCompatibleMatch, type MatchListing } from './market-policy.js'
import { getMarketBenchmark } from './market-benchmark.js'
import { inspectEvidenceFile, reviewEvidenceFile } from './evidence-ai.js'
import { calculateSolarFunding, reviewSolarFundingPlan, solarFundingInputSchema } from './solar-funding-ai.js'

const api = express()
function routeId(request: express.Request): string {
  const id = request.params.id
  if (typeof id !== 'string') throw new HttpError(400, 'A single resource ID is required.', 'INVALID_RESOURCE_ID')
  return id
}

api.disable('x-powered-by')
api.use(helmet())
api.use(cors({ origin: process.env.API_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? ['http://localhost:5173'], credentials: false }))
api.use(express.json({ limit: '256kb' }))
api.use((request, response, next) => {
  request.requestId = request.header('x-request-id')?.slice(0, 100) || randomUUID()
  response.setHeader('x-request-id', request.requestId)
  next()
})
api.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }))
api.use('/api/market', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }))
const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 12 } }).single('file')
function receiveEvidenceUpload(request: express.Request, response: express.Response, next: express.NextFunction) {
  evidenceUpload(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE'
      next(new HttpError(tooLarge ? 413 : 400, tooLarge ? 'Evidence files must be 8 MB or smaller.' : 'Upload one evidence file at a time.', tooLarge ? 'EVIDENCE_FILE_TOO_LARGE' : 'INVALID_EVIDENCE_UPLOAD'))
      return
    }
    next(error)
  })
}

const rpcUrl = process.env.CHAIN_RPC_URL
const chainId = Number(process.env.CHAIN_ID ?? 31337)
const contractAddress = process.env.CONTRACT_ADDRESS ?? ''
const provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null
const tradingInterface = new Interface([
  'event TradeCommitted(bytes32 indexed tradeId,address indexed buyer,address indexed seller,uint64 energyWh,uint128 pricePerKWhScaled)',
  'event EvidenceSubmitted(bytes32 indexed tradeId,bytes32 evidenceHash)',
  'event EvidenceReviewed(bytes32 indexed tradeId,bool approved,bytes32 reasonHash)',
  'event TradeSettled(bytes32 indexed tradeId,address indexed buyer,address indexed seller,uint64 energyWh,uint256 buyerPoints,uint256 sellerPoints)',
])

api.get('/api/health', asyncRoute(async (_request, response) => {
  await query('SELECT 1')
  let chainConnected = false
  let chainError: string | undefined
  if (provider) {
    try {
      chainConnected = Number(await provider.send('eth_chainId', [])) === chainId
      if (!chainConnected) chainError = `RPC is connected to a different chain than configured chain ID ${chainId}.`
    } catch {
      chainError = 'Configured EVM RPC is not reachable.'
    }
  }
  response.json({
    status: 'ok',
    database: 'connected',
    blockchain: { enabled: Boolean(contractAddress), connected: chainConnected, chainId, contractAddress: contractAddress || null, ...(chainError ? { message: chainError } : {}) },
    time: new Date().toISOString(),
  })
}))

api.get('/api/market/benchmark', asyncRoute(async (request, response) => {
  const state = z.enum(['CA', 'CO', 'NY', 'TX', 'WA']).default('CA').parse(request.query.state)
  try {
    response.json(await getMarketBenchmark(state))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The EIA market benchmark is unavailable.'
    throw new HttpError(message.startsWith('Configure EIA_API_KEY') ? 503 : 502, message, 'MARKET_BENCHMARK_UNAVAILABLE')
  }
}))

api.post('/api/auth/nonce', createWalletNonce)
api.post('/api/auth/verify', verifyWalletSignature)
api.use('/api', requireAuth)

api.delete('/api/auth/session', revokeCurrentSession)
api.get('/api/me', (request, response) => {
  response.json({ id: request.user!.id, displayName: request.user!.displayName, role: request.user!.role, walletAddress: request.user!.walletAddress, demo: Boolean(request.user!.demoKey) })
})
api.post('/api/auth/account-removal-challenge', createAccountRemovalChallenge)
api.delete('/api/me', removeWalletAccount)

api.get('/api/config', (_request, response) => {
  response.json({ chain: { chainId, enabled: Boolean(provider && contractAddress), contractAddress: contractAddress || null } })
})

api.get('/api/bootstrap', asyncRoute(async (request, response) => {
  const userId = request.user!.id
  const [listings, trades, evidence, projects, points, contributions, activity, balance] = await Promise.all([
    query(
      `SELECT l.public_id AS id,l.type,u.display_name AS owner,l.owner_id=$1 AS "isMine",
        l.available_kwh AS quantity,l.price_per_kwh AS price,l.service_area AS area,l.renewable_source AS source,
        l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd",l.status,l.note
       FROM listings l JOIN users u ON u.id=l.owner_id
       WHERE l.status IN ('open','matched') OR (l.owner_id=$1 AND l.status='paused')
       ORDER BY l.created_at DESC LIMIT 100`,
      [userId],
    ),
    query(
      `SELECT t.public_id AS id,b.display_name AS buyer,s.display_name AS seller,
        b.wallet_address AS "buyerWalletAddress",s.wallet_address AS "sellerWalletAddress",t.quantity_kwh AS quantity,
        t.price_per_kwh AS price,t.status,t.created_at AS "createdAt",t.chain_tx_hash AS "chainTxHash",
        coalesce((SELECT count(*) FROM trade_confirmations c WHERE c.trade_id=t.id),0)::int AS confirmations
       FROM trades t JOIN users b ON b.id=t.buyer_id JOIN users s ON s.id=t.seller_id
       WHERE t.buyer_id=$1 OR t.seller_id=$1 OR $2
       ORDER BY t.created_at DESC LIMIT 100`,
      [userId, Boolean(request.user!.demoKey)],
    ),
    query(
      `SELECT e.public_id AS id,'Energy evidence · ' || s.display_name AS project,e.source,e.quantity_kwh AS quantity,
        e.interval_start AS "intervalStart",e.interval_end AS "intervalEnd",e.status,t.public_id AS trade,
        e.rejection_reason AS reason,e.evidence_hash AS "evidenceHash",e.chain_tx_hash AS "chainTxHash",
        e.evidence_reference AS reference,e.evidence_file_sha256 AS "evidenceFileSha256",
        EXISTS(SELECT 1 FROM evidence_files ef WHERE ef.evidence_id=e.id) AS "evidenceFileAvailable",
        air.id AS "aiReviewId",air.model AS "aiModel",air.analysis AS "aiReview"
       FROM evidence e JOIN trades t ON t.id=e.trade_id JOIN users s ON s.id=e.submitter_id
       LEFT JOIN ai_evidence_reviews air ON air.id=e.ai_review_id
       WHERE t.buyer_id=$1 OR t.seller_id=$1 OR $2 OR $3
       ORDER BY e.created_at DESC LIMIT 100`,
      [userId, Boolean(request.user!.demoKey), ['verifier', 'admin'].includes(request.user!.role)],
    ),
    query(
      `SELECT p.public_id AS id,p.name,p.location,p.site_type AS "siteType",u.display_name AS owner,
        p.usable_area_m2 AS area,p.capacity_kw AS capacity,p.funding_target AS target,
        coalesce(sum(c.amount) FILTER (WHERE c.status IN ('simulated','confirmed')),0) AS raised,
        p.permission_status AS permission,p.notes,p.status,
        fe.ai_model AS "fundingAiModel",fe.ai_analysis->>'summary' AS "fundingAiSummary",
        fe.ai_analysis->>'confidence' AS "fundingAiConfidence",
        count(c.id) FILTER (WHERE c.status IN ('simulated','confirmed'))::int AS "contributionCount"
       FROM projects p JOIN users u ON u.id=p.owner_id
       JOIN solar_funding_estimates fe ON fe.project_id=p.id
       LEFT JOIN contributions c ON c.project_id=p.id
       GROUP BY p.id,u.display_name,fe.id ORDER BY p.created_at DESC LIMIT 100`,
    ),
    query<{ points: string }>('SELECT coalesce(sum(points),0)::text AS points FROM rewards WHERE user_id=$1', [userId]),
    query(
      `SELECT c.public_id AS id,p.public_id AS "projectId",u.display_name AS contributor,c.amount,c.created_at AS "createdAt",c.status
       FROM contributions c JOIN projects p ON p.id=c.project_id JOIN users u ON u.id=c.contributor_id
       WHERE c.contributor_id=$1 OR $2 ORDER BY c.created_at DESC LIMIT 100`,
      [userId, Boolean(request.user!.demoKey)],
    ),
    query(
      `SELECT e.event_type AS title,e.entity_type AS "entityType",e.entity_id AS detail,e.created_at AS "createdAt",e.source
       FROM audit_events e WHERE e.actor_id=$1 OR $2 ORDER BY e.created_at DESC LIMIT 100`,
      [userId, Boolean(request.user!.demoKey)],
    ),
    query<{ demoBalance: string }>('SELECT demo_balance AS "demoBalance" FROM users WHERE id=$1', [userId]),
  ])
  response.json({
    listings: listings.rows.map((row) => ({ ...row, quantity: Number(row.quantity), price: Number(row.price), window: `${new Date(row.deliveryStart).toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}–${new Date(row.deliveryEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` })),
    trades: trades.rows.map((row) => ({ ...row, quantity: Number(row.quantity), price: Number(row.price), status: uiTradeStatus(row.status), time: new Date(row.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }), hash: row.chainTxHash ?? 'Not submitted' })),
    evidence: evidence.rows.map((row) => ({ ...row, quantity: Number(row.quantity), interval: `${new Date(row.intervalStart).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} – ${new Date(row.intervalEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` })),
    projects: projects.rows.map((row, index) => ({ ...row, area: Number(row.area), capacity: Number(row.capacity), target: Number(row.target), raised: Number(row.raised), image: ['sunrise', 'courtyard', 'hub'][index % 3] })),
    contributions: contributions.rows.map((row) => ({ ...row, amount: Number(row.amount), time: new Date(row.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) })),
    points: Number(points.rows[0]?.points ?? 0),
    demoBalance: Number(balance.rows[0]?.demoBalance ?? 0),
    activity: activity.rows.map((row) => ({ title: row.title.replaceAll('.', ' '), detail: row.detail, time: new Date(row.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }), source: row.source })),
  })
}))

api.get('/api/listings', asyncRoute(async (request, response) => {
  const type = z.enum(['offer', 'request']).optional().parse(request.query.type)
  const area = z.string().max(120).optional().parse(request.query.area)
  const limit = z.coerce.number().int().min(1).max(100).default(30).parse(request.query.limit)
  const result = await query(
    `SELECT l.public_id AS id,l.type,u.display_name AS owner,l.quantity_kwh AS quantity,l.available_kwh AS available,
      l.price_per_kwh AS price,l.service_area AS area,l.renewable_source AS source,l.status,
      l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd"
     FROM listings l JOIN users u ON u.id=l.owner_id
     WHERE l.status='open' AND ($1::text IS NULL OR l.type=$1) AND ($2::text IS NULL OR l.service_area ILIKE '%' || $2 || '%')
     ORDER BY CASE WHEN l.type='offer' THEN l.price_per_kwh END ASC, l.created_at DESC LIMIT $3`,
    [type ?? null, area ?? null, limit],
  )
  response.json({ data: result.rows.map((row) => ({ ...row, quantity: Number(row.available), price: Number(row.price) })), limit })
}))

const listingInput = z.object({
  type: z.enum(['offer', 'request']),
  quantity: z.number().positive().max(100_000),
  price: z.number().positive().max(1_000_000),
  area: z.string().trim().min(2).max(120),
  source: z.string().trim().min(2).max(100),
  deliveryStart: z.string().datetime(),
  deliveryEnd: z.string().datetime(),
  note: z.string().max(500).optional().default(''),
}).refine((value) => new Date(value.deliveryEnd) > new Date(value.deliveryStart), { message: 'Delivery end must be after the start.' })

api.post('/api/listings', asyncRoute(async (request, response) => {
  const input = listingInput.parse(request.body)
  const role = request.user!.role
  if (input.type === 'offer' && !['prosumer', 'both', 'admin'].includes(role)) {
    throw new HttpError(403, 'Choose a prosumer account to publish an energy offer.', 'ROLE_NOT_ALLOWED')
  }
  if (input.type === 'request' && !['consumer', 'both', 'admin'].includes(role)) {
    throw new HttpError(403, 'Choose a consumer account to publish an energy request.', 'ROLE_NOT_ALLOWED')
  }
  const publicId = `${input.type === 'offer' ? 'OFF' : 'REQ'}-${randomUUID().slice(0, 8).toUpperCase()}`
  const result = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO listings(public_id,type,owner_id,quantity_kwh,available_kwh,price_per_kwh,service_area,renewable_source,delivery_start,delivery_end,note)
       VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10)
       RETURNING public_id AS id,type,quantity_kwh AS quantity,price_per_kwh AS price,service_area AS area,renewable_source AS source,status,delivery_start AS "deliveryStart",delivery_end AS "deliveryEnd"`,
      [publicId, input.type, request.user!.id, input.quantity, input.price, input.area, input.source, input.deliveryStart, input.deliveryEnd, input.note],
    )
    await writeAudit(client, request.user!.id, 'listing.created', 'listing', publicId, { type: input.type, quantityKwh: input.quantity })
    return inserted.rows[0]
  })
  response.status(201).json({ data: { ...result, owner: request.user!.displayName, quantity: Number(result.quantity), price: Number(result.price) } })
}))

api.patch('/api/listings/:id', asyncRoute(async (request, response) => {
  const input = z.object({ action: z.enum(['pause', 'resume', 'cancel']) }).parse(request.body)
  const status = { pause: 'paused', resume: 'open', cancel: 'cancelled' }[input.action]
  const result = await query(
    `UPDATE listings SET status=$3 WHERE public_id=$1 AND owner_id=$2 AND status IN ('open','paused')
     RETURNING public_id AS id,status`,
    [request.params.id, request.user!.id, status],
  )
  if (!result.rowCount) throw new HttpError(404, 'Listing not found or no longer editable.', 'LISTING_NOT_FOUND')
  const eventName = { pause: 'paused', resume: 'resumed', cancel: 'cancelled' }[input.action]
  await query('INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id) VALUES($1,$2,$3,$4)', [request.user!.id, `listing.${eventName}`, 'listing', request.params.id])
  response.json({ data: result.rows[0] })
}))

api.post('/api/trades', asyncRoute(async (request, response) => {
  const input = z.object({ listingId: z.string().min(5).max(80), quantity: z.number().positive().max(100_000) }).parse(request.body)
  const result = await transaction(async (client) => {
    const listingResult = await client.query(
      `SELECT l.id,l.public_id AS "publicId",l.type,l.owner_id AS "ownerId",l.available_kwh AS available,
        l.price_per_kwh AS price,l.service_area AS area,l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd"
       FROM listings l WHERE public_id=$1 AND status='open' FOR UPDATE`,
      [input.listingId],
    )
    const listing = listingResult.rows[0]
    if (!listing) throw new HttpError(404, 'Listing is no longer available.', 'LISTING_NOT_FOUND')
    if (listing.ownerId === request.user!.id) throw new HttpError(409, 'You cannot match against your own listing.', 'SELF_MATCH')
    if (input.quantity > Number(listing.available)) throw new HttpError(409, 'Requested energy is no longer available.', 'INSUFFICIENT_QUANTITY')
    let sellerListing: { id: string; available: string; price: string } | undefined
    if (listing.type === 'request') {
      const sellerListingResult = await client.query<{ id: string; available: string; price: string }>(
        `SELECT id,available_kwh AS available,price_per_kwh AS price FROM listings
         WHERE owner_id=$1 AND type='offer' AND status='open' AND available_kwh >= $2
           AND lower(service_area)=lower($3) AND price_per_kwh <= $4
           AND delivery_start < $5 AND $6 < delivery_end
         ORDER BY price_per_kwh ASC,created_at ASC LIMIT 1 FOR UPDATE`,
        [request.user!.id, input.quantity, listing.area, listing.price, listing.deliveryEnd, listing.deliveryStart],
      )
      sellerListing = sellerListingResult.rows[0]
      if (!sellerListing) throw new HttpError(409, 'To fulfill this request, first publish a compatible offer with enough energy, an overlapping delivery window, and an acceptable price.', 'COMPATIBLE_OFFER_REQUIRED')
    }
    const buyerId = listing.type === 'offer' ? request.user!.id : listing.ownerId
    const sellerId = listing.type === 'offer' ? listing.ownerId : request.user!.id
    const tradeId = `TRD-${randomUUID().slice(0, 8).toUpperCase()}`
    const price = sellerListing
      ? Math.round((Number(listing.price) + Number(sellerListing.price)) * 50) / 100
      : Number(listing.price)
    const trade = await client.query(
      `INSERT INTO trades(public_id,listing_id,counter_listing_id,buyer_id,seller_id,quantity_kwh,price_per_kwh)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING public_id AS id,quantity_kwh AS quantity,price_per_kwh AS price,status`,
      [tradeId, listing.id, sellerListing?.id ?? null, buyerId, sellerId, input.quantity, price],
    )
    const remaining = Number(listing.available) - input.quantity
    await client.query('UPDATE listings SET available_kwh=$2::numeric,status=CASE WHEN $2::numeric=0 THEN $3 ELSE status END WHERE id=$1', [listing.id, remaining, 'matched'])
    if (sellerListing) {
      const sellerRemaining = Number(sellerListing.available) - input.quantity
      await client.query('UPDATE listings SET available_kwh=$2::numeric,status=CASE WHEN $2::numeric=0 THEN $3 ELSE status END WHERE id=$1', [sellerListing.id, sellerRemaining, 'matched'])
    }
    await writeAudit(client, request.user!.id, 'trade.match_proposed', 'trade', tradeId, { quantityKwh: input.quantity, indicativeTotal: Math.round(input.quantity * price * 100) / 100 })
    return trade.rows[0]
  })
  response.status(201).json({ data: { ...result, buyer: listingParticipantName('buyer', request.user!, listingType(request.body)), seller: listingParticipantName('seller', request.user!, listingType(request.body)), quantity: Number(result.quantity), price: Number(result.price) } })
}))

api.post('/api/trades/:id/confirm', asyncRoute(async (request, response) => {
  const result = await transaction(async (client) => {
    const trade = await client.query<{ id: string; buyerId: string; sellerId: string; status: string }>(
      'SELECT id,buyer_id AS "buyerId",seller_id AS "sellerId",status FROM trades WHERE public_id=$1 FOR UPDATE',
      [request.params.id],
    )
    const row = trade.rows[0]
    if (!row) throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND')
    if (row.buyerId !== request.user!.id && row.sellerId !== request.user!.id) throw new HttpError(403, 'Only a trade participant can confirm.', 'FORBIDDEN')
    if (!['awaiting_confirmation', 'committed', 'evidence_needed'].includes(row.status)) throw new HttpError(409, 'This trade cannot be confirmed in its current state.', 'INVALID_TRADE_STATE')
    await client.query('INSERT INTO trade_confirmations(trade_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [row.id, request.user!.id])
    const confirmations = await client.query<{ count: number }>('SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1', [row.id])
    const status = row.status === 'committed'
      ? 'committed'
      : confirmations.rows[0].count >= 2 ? 'evidence_needed' : 'awaiting_confirmation'
    await client.query('UPDATE trades SET status=$2,updated_at=now() WHERE id=$1', [row.id, status])
    await writeAudit(client, request.user!.id, 'trade.participant_confirmed', 'trade', routeId(request), { confirmations: confirmations.rows[0].count })
    return { status, confirmations: confirmations.rows[0].count }
  })
  response.json({ data: result })
}))

api.post('/api/trades/:id/commitment', asyncRoute(async (request, response) => {
  const input = z.object({ transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(request.body)
  if (!provider || !contractAddress) throw new HttpError(503, 'A blockchain RPC and deployed contract are not configured.', 'CHAIN_NOT_CONFIGURED')
  const result = await query(
    `SELECT t.id,t.public_id AS "publicId",t.quantity_kwh AS quantity,t.price_per_kwh AS price,
      buyer.wallet_address AS buyer,seller.wallet_address AS seller,t.status,t.chain_tx_hash AS "chainTxHash"
     FROM trades t JOIN users buyer ON buyer.id=t.buyer_id JOIN users seller ON seller.id=t.seller_id
     WHERE t.public_id=$1`,
    [request.params.id],
  )
  const trade = result.rows[0]
  if (!trade) throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND')
  if (trade.status !== 'evidence_needed' || trade.chainTxHash) throw new HttpError(409, 'This trade is not awaiting a first on-chain commitment.', 'INVALID_TRADE_STATE')
  if (!trade.buyer || !trade.seller) throw new HttpError(409, 'Both trade participants need a registered wallet address.', 'PARTICIPANT_WALLETS_REQUIRED')
  if (trade.buyer?.toLowerCase() !== request.user!.walletAddress?.toLowerCase() && trade.seller?.toLowerCase() !== request.user!.walletAddress?.toLowerCase()) {
    throw new HttpError(403, 'Only the wallet participating in this trade can submit its chain transaction.', 'FORBIDDEN')
  }
  const confirmations = await query<{ count: number }>(
    'SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1',
    [trade.id],
  )
  if (confirmations.rows[0].count < 2) throw new HttpError(409, 'Both trade participants must confirm before an on-chain commitment.', 'TRADE_CONFIRMATIONS_REQUIRED')
  const receipt = await provider.getTransactionReceipt(input.transactionHash)
  if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== contractAddress.toLowerCase() ||
    receipt.from.toLowerCase() !== request.user!.walletAddress?.toLowerCase()) {
    throw new HttpError(422, 'Transaction receipt is missing, failed, sent by a different wallet, or sent to a different contract.', 'INVALID_CHAIN_RECEIPT')
  }
  const expectedTradeId = keccak256(toUtf8Bytes(trade.publicId))
  const match = receipt.logs.map((log) => {
    try { return tradingInterface.parseLog(log) } catch { return null }
  }).find((event) => event?.name === 'TradeCommitted')
  if (!match || match.args.tradeId !== expectedTradeId || getAddress(match.args.buyer) !== getAddress(trade.buyer) || getAddress(match.args.seller) !== getAddress(trade.seller) ||
    BigInt(match.args.energyWh) !== BigInt(Math.round(Number(trade.quantity) * 1000)) ||
    BigInt(match.args.pricePerKWhScaled) !== BigInt(Math.round(Number(trade.price) * 10000))) {
    throw new HttpError(422, 'Confirmed transaction does not commit the agreed trade terms.', 'CHAIN_TERMS_MISMATCH')
  }
  const updated = await query(
    `UPDATE trades SET chain_id=$2,contract_address=$3,chain_tx_hash=$4,status='committed',updated_at=now()
     WHERE id=$1 AND status='evidence_needed' AND chain_tx_hash IS NULL`,
    [trade.id, chainId, contractAddress, input.transactionHash],
  )
  if (!updated.rowCount) throw new HttpError(409, 'Trade state changed before the commitment was recorded.', 'INVALID_TRADE_STATE')
  await query('INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id,source,metadata) VALUES($1,$2,$3,$4,$5,$6)', [request.user!.id, 'trade.chain_committed', 'trade', trade.publicId, 'blockchain', JSON.stringify({ chainId, transactionHash: input.transactionHash })])
  response.json({ data: { tradeId: trade.publicId, status: 'committed', transactionHash: input.transactionHash, chainId } })
}))

api.post('/api/trades/:id/evidence', receiveEvidenceUpload, asyncRoute(async (request, response) => {
  const input = z.object({
    quantity: z.coerce.number().positive().max(100_000),
    source: z.string().trim().min(3).max(120),
    intervalStart: z.string().datetime(),
    intervalEnd: z.string().datetime(),
    evidenceReference: z.string().max(500).optional().default(''),
    evidenceFileSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    aiReviewId: z.string().uuid().optional(),
    chainTransactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  }).parse(request.body)
  if (request.user!.demoKey && input.chainTransactionHash) {
    throw new HttpError(400, 'Demo profiles cannot attach unverified wallet transaction receipts.', 'DEMO_CHAIN_ACTION_UNAVAILABLE')
  }
  const uploadedFile = request.file
  const inspectedFile = uploadedFile ? inspectEvidenceFile(uploadedFile) : null
  if (uploadedFile && input.evidenceFileSha256 && input.evidenceFileSha256 !== inspectedFile?.sha256) {
    throw new HttpError(409, 'The uploaded file does not match its submitted SHA-256 digest.', 'EVIDENCE_FILE_HASH_MISMATCH')
  }
  const evidenceFileSha256 = inspectedFile?.sha256 ?? input.evidenceFileSha256
  if (input.aiReviewId && !uploadedFile) {
    throw new HttpError(400, 'Attach the same file that received the AI review.', 'EVIDENCE_FILE_REQUIRED')
  }
  if (new Date(input.intervalEnd) <= new Date(input.intervalStart)) throw new HttpError(400, 'Evidence interval end must follow its start.', 'INVALID_INTERVAL')
  const evidence = await transaction(async (client) => {
    const tradeResult = await client.query<{ id: string; publicId: string; sellerId: string; quantity: string; status: string }>(
      'SELECT id,public_id AS "publicId",seller_id AS "sellerId",quantity_kwh AS quantity,status FROM trades WHERE public_id=$1 FOR UPDATE',
      [request.params.id],
    )
    const trade = tradeResult.rows[0]
    if (!trade) throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND')
    if (trade.sellerId !== request.user!.id) throw new HttpError(403, 'Only the energy seller can submit delivery evidence.', 'FORBIDDEN')
    if (!['committed', 'evidence_needed', 'disputed'].includes(trade.status)) throw new HttpError(409, 'Trade is not ready to receive evidence.', 'INVALID_TRADE_STATE')
    if (input.quantity > Number(trade.quantity)) throw new HttpError(400, 'Evidence quantity cannot exceed the committed trade quantity.', 'EVIDENCE_EXCEEDS_TRADE')
    if (input.aiReviewId) {
      const review = await client.query<{ fileSha256: string }>(
        'SELECT file_sha256 AS "fileSha256" FROM ai_evidence_reviews WHERE id=$1 AND trade_id=$2 AND submitter_id=$3',
        [input.aiReviewId, trade.id, request.user!.id],
      )
      if (!review.rowCount) throw new HttpError(404, 'AI review not found for this trade and account.', 'AI_REVIEW_NOT_FOUND')
      if (!evidenceFileSha256 || review.rows[0].fileSha256 !== evidenceFileSha256) {
        throw new HttpError(409, 'The submitted file does not match the AI-reviewed evidence.', 'AI_REVIEW_FILE_MISMATCH')
      }
    }
    const publicId = `EVD-${randomUUID().slice(0, 8).toUpperCase()}`
    const evidenceHash = keccak256(toUtf8Bytes(JSON.stringify({
      tradeId: trade.publicId,
      quantity: input.quantity,
      source: input.source,
      intervalStart: input.intervalStart,
      intervalEnd: input.intervalEnd,
      reference: input.evidenceReference,
      ...(evidenceFileSha256 ? { evidenceFileSha256 } : {}),
    })))
    if (contractAddress && !request.user!.demoKey) {
      if (!input.chainTransactionHash) throw new HttpError(409, 'Submit the evidence hash to the configured contract before recording it.', 'CHAIN_EVIDENCE_REQUIRED')
      const receipt = await provider!.getTransactionReceipt(input.chainTransactionHash)
      const event = receipt?.logs.map((log) => { try { return tradingInterface.parseLog(log) } catch { return null } })
        .find((item) => item?.name === 'EvidenceSubmitted' && item.args.tradeId === keccak256(toUtf8Bytes(trade.publicId)) && item.args.evidenceHash === evidenceHash)
      if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== contractAddress.toLowerCase() ||
        receipt.from.toLowerCase() !== request.user!.walletAddress?.toLowerCase() || !event) {
        throw new HttpError(422, 'Confirmed contract evidence event does not match the submitted evidence.', 'INVALID_CHAIN_EVIDENCE')
      }
    }
    const inserted = await client.query(
      `INSERT INTO evidence(public_id,trade_id,submitter_id,quantity_kwh,source,interval_start,interval_end,evidence_hash,chain_tx_hash,evidence_reference,evidence_file_sha256,ai_review_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING public_id AS id,quantity_kwh AS quantity,source,status,evidence_hash AS "evidenceHash",evidence_reference AS reference,evidence_file_sha256 AS "evidenceFileSha256",ai_review_id AS "aiReviewId"`,
      [publicId, trade.id, request.user!.id, input.quantity, input.source, input.intervalStart, input.intervalEnd, evidenceHash, input.chainTransactionHash ?? null, input.evidenceReference, evidenceFileSha256 ?? null, input.aiReviewId ?? null],
    )
    if (uploadedFile && inspectedFile) {
      const extension = uploadedFile.originalname.split(/[\\/]/).pop()?.match(/\.[a-zA-Z0-9]+$/)?.[0].toLowerCase()
      if (!extension || !['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.csv'].includes(extension)) {
        throw new HttpError(415, 'Evidence file extension is not supported.', 'UNSUPPORTED_EVIDENCE_FILE')
      }
      await client.query(
        `INSERT INTO evidence_files(evidence_id,file_kind,file_extension,sha256,content)
         SELECT id,$2,$3,$4,$5 FROM evidence WHERE public_id=$1`,
        [publicId, inspectedFile.kind, extension, inspectedFile.sha256, uploadedFile.buffer],
      )
    }
    await client.query("UPDATE trades SET status='under_review',updated_at=now() WHERE id=$1", [trade.id])
    await writeAudit(client, request.user!.id, 'evidence.submitted', 'trade', trade.publicId, { evidenceId: publicId, quantityKwh: input.quantity, source: input.source, evidenceHash, fileAttached: Boolean(uploadedFile), evidenceFileSha256: evidenceFileSha256 ?? null })
    return inserted.rows[0]
  })
  response.status(201).json({ data: { ...evidence, quantity: Number(evidence.quantity) } })
}))

api.get('/api/evidence/:id/file', asyncRoute(async (request, response) => {
  const result = await query<{
    id: string
    buyerId: string
    sellerId: string
    fileKind: string
    fileExtension: string
    content: Buffer
  }>(
    `SELECT e.public_id AS id,t.buyer_id AS "buyerId",t.seller_id AS "sellerId",
      f.file_kind AS "fileKind",f.file_extension AS "fileExtension",f.content
     FROM evidence e JOIN trades t ON t.id=e.trade_id
     JOIN evidence_files f ON f.evidence_id=e.id
     WHERE e.public_id=$1`,
    [routeId(request)],
  )
  const file = result.rows[0]
  if (!file) throw new HttpError(404, 'Evidence file not found.', 'EVIDENCE_FILE_NOT_FOUND')
  if (
    file.buyerId !== request.user!.id &&
    file.sellerId !== request.user!.id &&
    !['verifier', 'admin'].includes(request.user!.role)
  ) {
    throw new HttpError(403, 'Only a trade participant or authorized verifier can download this evidence file.', 'FORBIDDEN')
  }
  response.setHeader('Content-Type', file.fileKind)
  response.setHeader('Content-Disposition', `attachment; filename="${file.id.toLowerCase()}${file.fileExtension}"`)
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.send(file.content)
}))

api.post('/api/trades/:id/evidence/ai-review', rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }), receiveEvidenceUpload, asyncRoute(async (request, response) => {
  if (request.body.consent !== 'true') throw new HttpError(400, 'Explicit consent is required before sending a file to the AI provider.', 'AI_REVIEW_CONSENT_REQUIRED')
  const file = request.file
  if (!file) throw new HttpError(400, 'Choose an evidence file before requesting an AI review.', 'EVIDENCE_FILE_REQUIRED')
  const inspected = inspectEvidenceFile(file)
  const tradeResult = await query<{ id: string; publicId: string; sellerId: string; quantity: string; status: string }>(
    'SELECT id,public_id AS "publicId",seller_id AS "sellerId",quantity_kwh AS quantity,status FROM trades WHERE public_id=$1',
    [routeId(request)],
  )
  const trade = tradeResult.rows[0]
  if (!trade) throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND')
  if (trade.sellerId !== request.user!.id) throw new HttpError(403, 'Only the energy seller can submit delivery evidence.', 'FORBIDDEN')
  if (!['committed', 'evidence_needed', 'disputed'].includes(trade.status)) throw new HttpError(409, 'Trade is not ready to receive evidence.', 'INVALID_TRADE_STATE')
  const result = await reviewEvidenceFile(file, inspected.kind, { tradeId: trade.publicId, quantityKwh: Number(trade.quantity) })
  const saved = await transaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO ai_evidence_reviews(trade_id,submitter_id,file_sha256,file_kind,model,analysis)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [trade.id, request.user!.id, inspected.sha256, inspected.kind, result.model, JSON.stringify(result.analysis)],
    )
    await writeAudit(client, request.user!.id, 'evidence.ai_reviewed', 'trade', trade.publicId, { aiReviewId: inserted.rows[0].id, model: result.model, fileKind: inspected.kind, fileSha256: inspected.sha256 })
    return inserted.rows[0]
  })
  response.json({ data: { id: saved.id, fileSha256: inspected.sha256, model: result.model, analysis: result.analysis } })
}))

api.post('/api/evidence/:id/review', allowRoles('verifier', 'admin'), asyncRoute(async (request, response) => {
  const input = z.object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional(),
    chainTransactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  }).parse(request.body)
  if (request.user!.demoKey && input.chainTransactionHash) {
    throw new HttpError(400, 'Demo profiles cannot attach unverified wallet transaction receipts.', 'DEMO_CHAIN_ACTION_UNAVAILABLE')
  }
  if (input.decision === 'reject' && !input.reason) throw new HttpError(400, 'A rejection reason is required.', 'REJECTION_REASON_REQUIRED')
  const result = await transaction(async (client) => {
    const current = await client.query<{ id: string; tradeId: string; tradePublicId: string; submitterId: string; status: string; quantity: string }>(
      `SELECT e.id,e.trade_id AS "tradeId",t.public_id AS "tradePublicId",e.submitter_id AS "submitterId",e.status,e.quantity_kwh AS quantity
       FROM evidence e JOIN trades t ON t.id=e.trade_id WHERE e.public_id=$1 FOR UPDATE OF e,t`,
      [request.params.id],
    )
    const evidence = current.rows[0]
    if (!evidence) throw new HttpError(404, 'Evidence record not found.', 'EVIDENCE_NOT_FOUND')
    if (evidence.submitterId === request.user!.id) throw new HttpError(403, 'A verifier cannot approve their own evidence submission.', 'SELF_REVIEW')
    if (evidence.status !== 'pending') throw new HttpError(409, 'Evidence has already been reviewed.', 'ALREADY_REVIEWED')
    const confirmations = await client.query<{ count: number }>('SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1', [evidence.tradeId])
    if (confirmations.rows[0].count < 2) throw new HttpError(409, 'Both trade participants must confirm before evidence can be reviewed.', 'TRADE_CONFIRMATIONS_REQUIRED')
    const status = input.decision === 'approve' ? 'approved' : 'rejected'
    if (contractAddress && !request.user!.demoKey) {
      if (!input.chainTransactionHash) throw new HttpError(409, 'Submit the evidence review to the configured contract first.', 'CHAIN_REVIEW_REQUIRED')
      const receipt = await provider!.getTransactionReceipt(input.chainTransactionHash)
      const reasonHash = keccak256(toUtf8Bytes(input.reason ?? ''))
      const event = receipt?.logs.map((log) => { try { return tradingInterface.parseLog(log) } catch { return null } })
        .find((item) => item?.name === 'EvidenceReviewed' && item.args.tradeId === keccak256(toUtf8Bytes(evidence.tradePublicId)) && item.args.approved === (input.decision === 'approve') && item.args.reasonHash === reasonHash)
      if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== contractAddress.toLowerCase() ||
        receipt.from.toLowerCase() !== request.user!.walletAddress?.toLowerCase() || !event) {
        throw new HttpError(422, 'Confirmed contract review event does not match the requested decision.', 'INVALID_CHAIN_REVIEW')
      }
    }
    await client.query('UPDATE evidence SET status=$2,reviewer_id=$3,rejection_reason=$4,reviewed_at=now(),chain_tx_hash=$5 WHERE id=$1', [evidence.id, status, request.user!.id, input.reason ?? null, input.chainTransactionHash ?? null])
    await client.query('UPDATE trades SET status=$2,updated_at=now() WHERE id=$1', [evidence.tradeId, input.decision === 'approve' ? 'ready_to_settle' : 'disputed'])
    await writeAudit(client, request.user!.id, input.decision === 'approve' ? 'evidence.approved' : 'evidence.rejected', 'trade', evidence.tradePublicId, { evidenceId: request.params.id, reason: input.reason })
    return { evidenceId: request.params.id, tradeId: evidence.tradePublicId, status }
  })
  response.json({ data: result })
}))

api.post('/api/trades/:id/settle', asyncRoute(async (request, response) => {
  if (request.user!.demoKey && request.body?.chainTransactionHash) {
    throw new HttpError(400, 'Demo profiles cannot attach unverified wallet transaction receipts.', 'DEMO_CHAIN_ACTION_UNAVAILABLE')
  }
  const chainBacked = Boolean(contractAddress && !request.user!.demoKey)
  const settlement = await transaction(async (client) => {
    const tradeResult = await client.query<{
      id: string; publicId: string; buyerId: string; sellerId: string; quantity: string; status: string
    }>('SELECT id,public_id AS "publicId",buyer_id AS "buyerId",seller_id AS "sellerId",quantity_kwh AS quantity,status FROM trades WHERE public_id=$1 FOR UPDATE', [request.params.id])
    const trade = tradeResult.rows[0]
    if (!trade) throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND')
    if (trade.buyerId !== request.user!.id && trade.sellerId !== request.user!.id) throw new HttpError(403, 'Only a trade participant may settle this trade.', 'FORBIDDEN')
    if (trade.status !== 'ready_to_settle') throw new HttpError(409, 'Settlement requires approved evidence and both participants to confirm the trade.', 'SETTLEMENT_NOT_READY')
    const confirmations = await client.query<{ count: number }>('SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1', [trade.id])
    if (confirmations.rows[0].count < 2) throw new HttpError(409, 'Both trade participants must confirm before settlement.', 'TRADE_CONFIRMATIONS_REQUIRED')
    if (chainBacked && !request.body?.chainTransactionHash) throw new HttpError(409, 'Record the confirmed smart-contract settlement transaction before finalizing.', 'CHAIN_SETTLEMENT_REQUIRED')
    const evidenceResult = await client.query('SELECT id FROM evidence WHERE trade_id=$1 AND status=$2 ORDER BY reviewed_at DESC LIMIT 1', [trade.id, 'approved'])
    if (!evidenceResult.rowCount) throw new HttpError(409, 'Settlement is gated on approved renewable evidence.', 'APPROVED_EVIDENCE_REQUIRED')
    if (chainBacked && request.body.chainTransactionHash) {
      const receipt = await provider!.getTransactionReceipt(request.body.chainTransactionHash)
      const expectedTradeId = keccak256(toUtf8Bytes(trade.publicId))
      const settledEvent = receipt?.logs.map((log) => { try { return tradingInterface.parseLog(log) } catch { return null } }).find((event) => event?.name === 'TradeSettled' && event.args.tradeId === expectedTradeId)
      if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== contractAddress.toLowerCase() ||
        receipt.from.toLowerCase() !== request.user!.walletAddress?.toLowerCase() || !settledEvent) {
        throw new HttpError(422, 'Confirmed contract settlement event was not found or was sent by a different wallet.', 'INVALID_CHAIN_SETTLEMENT')
      }
    }
    const points = Math.max(1, Math.floor(Number(trade.quantity) * 10))
    await client.query("UPDATE trades SET status='settled',updated_at=now() WHERE id=$1", [trade.id])
    await client.query('INSERT INTO rewards(trade_id,user_id,points) VALUES($1,$2,$3),($1,$4,$3) ON CONFLICT(trade_id,user_id) DO NOTHING', [trade.id, trade.sellerId, points, trade.buyerId])
    await writeAudit(client, request.user!.id, 'trade.settled', 'trade', trade.publicId, { quantityKwh: Number(trade.quantity), pointsPerParticipant: points, simulated: !chainBacked })
    return { tradeId: trade.publicId, status: 'settled', pointsPerParticipant: points, settlementMode: chainBacked ? 'blockchain' : 'database-demo' }
  })
  response.json({ data: settlement })
}))

api.get('/api/projects', asyncRoute(async (_request, response) => {
  const result = await query(
    `SELECT p.public_id AS id,p.name,p.location,p.site_type AS "siteType",u.display_name AS owner,
      p.usable_area_m2 AS area,p.capacity_kw AS capacity,p.funding_target AS target,
      coalesce(sum(c.amount) FILTER (WHERE c.status IN ('simulated','confirmed')),0) AS raised,
      p.permission_status AS permission,p.notes,p.status,p.agreement_version AS "agreementVersion",
      p.energy_share_json AS "energyShares",p.revenue_share_json AS "revenueShares",
      fe.id AS "fundingEstimateId",fe.ai_model AS "fundingAiModel",
      fe.ai_analysis->>'summary' AS "fundingAiSummary",
      fe.ai_analysis->>'confidence' AS "fundingAiConfidence"
     FROM projects p JOIN users u ON u.id=p.owner_id
     JOIN solar_funding_estimates fe ON fe.project_id=p.id
     LEFT JOIN contributions c ON c.project_id=p.id
     GROUP BY p.id,u.display_name,fe.id ORDER BY p.created_at DESC`,
  )
  response.json({ data: result.rows })
}))

api.post('/api/projects', asyncRoute(async (request, response) => {
  const input = z.object({
    name: z.string().trim().min(3).max(120),
    location: z.string().trim().min(2).max(160),
    siteType: z.string().trim().min(2).max(80),
    area: z.number().min(10).max(100_000),
    target: z.number().positive().max(100_000_000),
    permission: z.string().trim().min(3).max(100),
    notes: z.string().max(2000).optional().default(''),
    energyShares: z.record(z.string(), z.number().min(0).max(100)).optional().default({ owner: 20, funder: 60, community: 20 }),
    revenueShares: z.record(z.string(), z.number().min(0).max(100)).optional().default({ owner: 20, funder: 60, community: 20 }),
    fundingEstimateId: z.string().uuid(),
  }).parse(request.body)
  const sharesTotal = (shares: Record<string, number>) => Object.values(shares).reduce((sum, value) => sum + value, 0)
  if (sharesTotal(input.energyShares) !== 100 || sharesTotal(input.revenueShares) !== 100) throw new HttpError(400, 'Energy and revenue share percentages must each total 100%.', 'INVALID_AGREEMENT_SHARES')
  const publicId = `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`
  const result = await transaction(async (client) => {
    {
      const estimate = await client.query<{ requiredFundingMinor: string; usableAreaM2: number; location: string; siteType: string; revenueSharesMatch: boolean }>(
        `SELECT (estimate->>'requiredFundingMinor')::bigint AS "requiredFundingMinor",
          (estimate->>'usableAreaM2')::numeric AS "usableAreaM2",
          input->>'location' AS location,input->>'siteType' AS "siteType",
          input->'revenueShares' = $3::jsonb AS "revenueSharesMatch"
         FROM solar_funding_estimates
         WHERE id=$1 AND created_by=$2 AND project_id IS NULL
         FOR UPDATE`,
        [input.fundingEstimateId, request.user!.id, JSON.stringify(input.revenueShares)],
      )
      const savedEstimate = estimate.rows[0]
      if (!savedEstimate) throw new HttpError(404, 'Funding estimate not found or already used.', 'FUNDING_ESTIMATE_NOT_FOUND')
      if (Number(savedEstimate.usableAreaM2) !== input.area
        || Number(savedEstimate.requiredFundingMinor) !== Math.round(input.target * 100)
        || savedEstimate.location !== input.location
        || savedEstimate.siteType !== input.siteType
        || !savedEstimate.revenueSharesMatch) {
        throw new HttpError(409, 'Project location, site type, area, target, and revenue shares must match the saved AI-reviewed estimate.', 'FUNDING_ESTIMATE_MISMATCH')
      }
    }
    const project = await client.query(
      `INSERT INTO projects(public_id,name,location,site_type,owner_id,usable_area_m2,capacity_kw,funding_target,permission_status,notes,status,energy_share_json,revenue_share_json)
       VALUES($1,$2,$3,$4,$5,$6,round(($6::numeric / 7.5),3),$7,$8,$9,'review',$10,$11)
       RETURNING public_id AS id,name,location,site_type AS "siteType",usable_area_m2 AS area,capacity_kw AS capacity,funding_target AS target,permission_status AS permission,notes,status,agreement_version AS "agreementVersion"`,
      [publicId, input.name, input.location, input.siteType, request.user!.id, input.area, input.target, input.permission, input.notes, JSON.stringify(input.energyShares), JSON.stringify(input.revenueShares)],
    )
    await client.query('INSERT INTO agreements(project_id,version,energy_share_json,revenue_share_json,created_by) SELECT id,1,$2,$3,$4 FROM projects WHERE public_id=$1', [publicId, JSON.stringify(input.energyShares), JSON.stringify(input.revenueShares), request.user!.id])
    await client.query('UPDATE solar_funding_estimates SET project_id=(SELECT id FROM projects WHERE public_id=$2) WHERE id=$1', [input.fundingEstimateId, publicId])
    await writeAudit(client, request.user!.id, 'project.created', 'project', publicId, { permission: input.permission, fundingEstimateId: input.fundingEstimateId })
    return project.rows[0]
  })
  response.status(201).json({ data: { ...result, owner: request.user!.displayName, raised: 0 } })
}))

api.post('/api/projects/:id/decision', allowRoles('verifier', 'admin'), asyncRoute(async (request, response) => {
  const input = z.object({ decision: z.enum(['approve', 'reject']) }).parse(request.body)
  const result = await transaction(async (client) => {
    const project = await client.query<{ id: string; status: string }>(
      'SELECT id,status FROM projects WHERE public_id=$1 FOR UPDATE',
      [routeId(request)],
    )
    const row = project.rows[0]
    if (!row) throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND')
    if (row.status !== 'review') throw new HttpError(409, 'Only projects awaiting review can receive a decision.', 'PROJECT_NOT_AWAITING_REVIEW')
    const status = input.decision === 'approve' ? 'funding' : 'rejected'
    const eventType = input.decision === 'approve' ? 'project.approved' : 'project.rejected'
    await client.query('UPDATE projects SET status=$2 WHERE id=$1', [row.id, status])
    await writeAudit(client, request.user!.id, eventType, 'project', routeId(request))
    return { id: routeId(request), status }
  })
  response.json({ data: result })
}))

api.post('/api/projects/funding-estimates', allowRoles('prosumer', 'consumer', 'both', 'space_owner', 'admin'), asyncRoute(async (request, response) => {
  if (request.body?.consentToAi !== true) {
    throw new HttpError(400, 'Confirm that this project information may be sent to the configured AI provider.', 'AI_REVIEW_CONSENT_REQUIRED')
  }
  const input = solarFundingInputSchema.parse(request.body)
  const estimate = calculateSolarFunding(input)
  const review = await reviewSolarFundingPlan(input, estimate)
  const saved = await transaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO solar_funding_estimates(created_by,input,estimate,ai_model,ai_analysis)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [request.user!.id, JSON.stringify(input), JSON.stringify(estimate), review.model, JSON.stringify(review.analysis)],
    )
    await writeAudit(client, request.user!.id, 'project.funding_plan_reviewed', 'funding_estimate', inserted.rows[0].id, {
      aiModel: review.model,
      requiredFundingMinor: estimate.requiredFundingMinor,
    })
    return inserted.rows[0]
  })
  response.status(201).json({
    data: {
      id: saved.id,
      ...estimate,
      aiReview: { model: review.model, ...review.analysis },
    },
  })
}))

api.post('/api/projects/:id/contributions', asyncRoute(async (request, response) => {
  const input = z.object({ amount: z.number().positive().max(100_000_000), idempotencyKey: z.string().uuid() }).parse(request.body)
  const result = await transaction(async (client) => {
    const existing = await client.query('SELECT public_id AS id,amount,project_id FROM contributions WHERE idempotency_key=$1', [input.idempotencyKey])
    if (existing.rowCount) return { ...existing.rows[0], duplicate: true }
    const project = await client.query<{ id: string; target: string; status: string }>(
      'SELECT id,funding_target AS target,status FROM projects WHERE public_id=$1 FOR UPDATE',
      [request.params.id],
    )
    const row = project.rows[0]
    if (!row) throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND')
    if (row.status !== 'funding') throw new HttpError(409, 'This project is not accepting contributions.', 'PROJECT_NOT_FUNDING')
    const raisedResult = await client.query<{ raised: string }>(
      "SELECT coalesce(sum(amount),0) AS raised FROM contributions WHERE project_id=$1 AND status IN ('simulated','confirmed')",
      [row.id],
    )
    const remaining = Number(row.target) - Number(raisedResult.rows[0].raised)
    if (input.amount > remaining) throw new HttpError(409, `Contribution exceeds the remaining target of ${remaining}.`, 'CONTRIBUTION_EXCEEDS_TARGET')
    const publicId = `CON-${randomUUID().slice(0, 8).toUpperCase()}`
    const inserted = await client.query(
      `INSERT INTO contributions(public_id,project_id,contributor_id,amount,idempotency_key)
       VALUES($1,$2,$3,$4,$5) RETURNING public_id AS id,amount,status`,
      [publicId, row.id, request.user!.id, input.amount, input.idempotencyKey],
    )
    await writeAudit(client, request.user!.id, 'project.contribution_simulated', 'project', routeId(request), { amount: input.amount, contributionId: publicId })
    return { ...inserted.rows[0], duplicate: false }
  })
  response.status(result.duplicate ? 200 : 201).json({ data: { ...result, amount: Number(result.amount) } })
}))

api.get('/api/projects/:id/settlement-preview', asyncRoute(async (request, response) => {
  const result = await query(
    `SELECT p.public_id AS id,p.agreement_version AS "agreementVersion",p.energy_share_json AS "energyShares",
      p.revenue_share_json AS "revenueShares",p.usable_area_m2 AS area,p.capacity_kw AS capacity
     FROM projects p WHERE p.public_id=$1`,
    [request.params.id],
  )
  if (!result.rowCount) throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND')
  const batches = await query<{ generationKwh: string }>(
    `SELECT coalesce(sum(generation_kwh) FILTER(WHERE status='approved'),0) AS "generationKwh"
     FROM generation_batches WHERE project_id=(SELECT id FROM projects WHERE public_id=$1)`,
    [request.params.id],
  )
  const project = result.rows[0]
  const eligibleKwh = Number(batches.rows[0]?.generationKwh ?? 0)
  const shares = project.energyShares as Record<string, number>
  response.json({
    data: {
      projectId: project.id,
      agreementVersion: project.agreementVersion,
      eligibleGenerationKwh: eligibleKwh,
      energyShares: Object.fromEntries(Object.entries(shares).map(([name, percent]) => [name, { percent, kwh: Math.round(eligibleKwh * percent) / 100 }])),
      formula: 'eligible_generation_kwh × energy_share_percent ÷ 100',
      emissions: { status: 'demo_assumption', factorKgCo2ePerKwh: 0.68, source: 'Bright Ledger demo assumption; not a verified emissions factor', kgCo2e: Math.round(eligibleKwh * 0.68 * 100) / 100 },
    },
  })
}))

api.get('/api/rewards', asyncRoute(async (request, response) => {
  const result = await query(
    `SELECT r.points,r.policy_version AS "policyVersion",t.public_id AS "tradeId",t.quantity_kwh AS "eligibleKwh",r.created_at AS "createdAt"
     FROM rewards r JOIN trades t ON t.id=r.trade_id WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 100`,
    [request.user!.id],
  )
  response.json({ data: result.rows })
}))

api.get('/api/audit', asyncRoute(async (request, response) => {
  const page = z.coerce.number().int().min(1).default(1).parse(request.query.page)
  const limit = z.coerce.number().int().min(1).max(100).default(30).parse(request.query.limit)
  const result = await query(
    `SELECT e.event_type AS "eventType",e.entity_type AS "entityType",e.entity_id AS "entityId",
      e.source,e.metadata,e.created_at AS "createdAt",u.display_name AS actor
     FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id ORDER BY e.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit],
  )
  response.json({ data: result.rows, page, limit })
}))

api.get('/api/matches', asyncRoute(async (request, response) => {
  const listingId = z.string().min(5).max(80).parse(request.query.listingId)
  const result = await query(
    `SELECT id,public_id AS "publicId",type,owner_id AS "ownerId",available_kwh AS available,
      price_per_kwh AS price,service_area AS area,delivery_start AS "deliveryStart",delivery_end AS "deliveryEnd"
     FROM listings WHERE public_id=$1 AND status='open'`,
    [listingId],
  )
  const selected = result.rows[0]
  if (!selected) throw new HttpError(404, 'Listing not found.', 'LISTING_NOT_FOUND')
  const counterparts = await query(
    `SELECT l.id,l.public_id AS "publicId",l.type,l.owner_id AS "ownerId",l.available_kwh AS available,
      l.price_per_kwh AS price,l.service_area AS area,l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd",
      u.display_name AS owner
     FROM listings l JOIN users u ON u.id=l.owner_id
     WHERE l.status='open' AND l.type<>$1 AND l.id<>$2 AND l.owner_id<>$3
       AND lower(l.service_area)=lower($4)
       AND (($1='offer' AND l.price_per_kwh >= $5) OR ($1='request' AND l.price_per_kwh <= $5))
       AND l.delivery_start < $6 AND $7 < l.delivery_end
     ORDER BY l.price_per_kwh ASC LIMIT 100`,
    [selected.type, selected.id, request.user!.id, selected.area, selected.price, selected.deliveryEnd, selected.deliveryStart],
  )
  const selectedListing: MatchListing = { id: selected.id, type: selected.type, quantityKwh: Number(selected.available), availableKwh: Number(selected.available), pricePerKwh: Number(selected.price), serviceArea: selected.area, deliveryStart: new Date(selected.deliveryStart), deliveryEnd: new Date(selected.deliveryEnd) }
  const matches = counterparts.rows.flatMap((item) => {
    const counterpart: MatchListing = { id: item.id, type: item.type, quantityKwh: Number(item.available), availableKwh: Number(item.available), pricePerKwh: Number(item.price), serviceArea: item.area, deliveryStart: new Date(item.deliveryStart), deliveryEnd: new Date(item.deliveryEnd) }
    const offer = selected.type === 'offer' ? selectedListing : counterpart
    const buyRequest = selected.type === 'request' ? selectedListing : counterpart
    const result = findCompatibleMatch(offer, buyRequest)
    return result ? [{ listingId: item.publicId, owner: item.owner, ...result }] : []
  })
  response.json({ data: matches, policy: { id: 'bilateral-price-overlap-v1', description: 'A bilateral match requires the same service area, overlapping delivery windows, a compatible limit price, and available quantity. Indicative price is the midpoint.' } })
}))

api.use((_request, _response, next) => next(new HttpError(404, 'API endpoint not found.', 'NOT_FOUND')))
api.use(errorHandler)

export async function startServer() {
  const port = Number(process.env.API_PORT ?? 4000)
  return api.listen(port, '0.0.0.0', () => console.log(`Bright Ledger API listening on :${port}`))
}

async function writeAudit(client: import('pg').PoolClient, actorId: string, eventType: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await client.query(
    'INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)',
    [actorId, eventType, entityType, entityId, JSON.stringify(metadata)],
  )
}

function uiTradeStatus(status: string) {
  const labels: Record<string, string> = {
    awaiting_confirmation: 'Awaiting confirmation',
    committed: 'Evidence needed',
    evidence_needed: 'Evidence needed',
    under_review: 'Under review',
    ready_to_settle: 'Ready to settle',
    disputed: 'Disputed',
    settled: 'Settled',
    cancelled: 'Cancelled',
  }
  return labels[status] ?? status
}

function listingType(body: unknown): 'offer' | 'request' {
  const result = z.object({ listingId: z.string() }).parse(body)
  return result.listingId.startsWith('OFF-') ? 'offer' : 'request'
}

function listingParticipantName(party: 'buyer' | 'seller', user: Express.Request['user'], type: 'offer' | 'request') {
  if (party === 'buyer') return type === 'offer' ? user!.displayName : 'Listing owner'
  return type === 'offer' ? 'Listing owner' : user!.displayName
}

export { api }
