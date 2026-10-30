import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { keccak256, toUtf8Bytes, JsonRpcProvider, Interface, getAddress } from 'ethers';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, allowRoles, createWalletNonce, verifyWalletSignature, createAccountRemovalChallenge, createWalletLinkNonce, loginPasswordAccount, registerPasswordAccount, removeWalletAccount, revokeCurrentSession, verifyWalletLink } from './auth.js';
import { query, transaction } from './db.js';
import { asyncRoute, errorHandler, HttpError } from './errors.js';
import { findCompatibleMatch } from './market-policy.js';
import { getMarketBenchmark } from './market-benchmark.js';
import { inspectEvidenceFile, reviewEvidenceFile } from './evidence-ai.js';
import { calculateSolarFunding, reviewSolarFundingPlan, solarFundingInputSchema } from './solar-funding-ai.js';
import { calculateSimulatedIncomeAllocations } from './project-income.js';
const api = express();
function routeId(request) {
    const id = request.params.id;
    if (typeof id !== 'string')
        throw new HttpError(400, 'A single resource ID is required.', 'INVALID_RESOURCE_ID');
    return id;
}
function requireLinkedWallet(request, _response, next) {
    if (!request.user?.walletAddress) {
        next(new HttpError(403, 'Link a compatible EVM wallet in Settings before creating listings or taking part in trades.', 'WALLET_LINK_REQUIRED'));
        return;
    }
    next();
}
api.disable('x-powered-by');
api.use(helmet());
api.use(cors({ origin: process.env.API_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? ['http://localhost:5173'], credentials: false }));
api.use(express.json({ limit: '256kb' }));
api.use((request, response, next) => {
    request.requestId = request.header('x-request-id')?.slice(0, 100) || randomUUID();
    response.setHeader('x-request-id', request.requestId);
    next();
});
api.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));
api.use('/api/market', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));
const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 12 } }).single('file');
function receiveEvidenceUpload(request, response, next) {
    evidenceUpload(request, response, (error) => {
        if (error instanceof multer.MulterError) {
            const tooLarge = error.code === 'LIMIT_FILE_SIZE';
            next(new HttpError(tooLarge ? 413 : 400, tooLarge ? 'Evidence files must be 8 MB or smaller.' : 'Upload one evidence file at a time.', tooLarge ? 'EVIDENCE_FILE_TOO_LARGE' : 'INVALID_EVIDENCE_UPLOAD'));
            return;
        }
        next(error);
    });
}
const chainId = Number(process.env.CHAIN_ID ?? 31337);
const rpcUrl = process.env.CHAIN_RPC_URL?.trim() || (chainId === 84532 && process.env.BASE_SEPOLIA_ALCHEMY_API_KEY
    ? `https://base-sepolia.g.alchemy.com/v2/${process.env.BASE_SEPOLIA_ALCHEMY_API_KEY}`
    : undefined);
const contractAddress = process.env.CONTRACT_ADDRESS ?? '';
const boaContractAddress = process.env.BOA_CONTRACT_ADDRESS ?? '';
const provider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
const tradingInterface = new Interface([
    'event TradeCommitted(bytes32 indexed tradeId,address indexed buyer,address indexed seller,uint64 energyWh,uint128 pricePerKWhScaled,uint256 paymentWei)',
    'event EvidenceSubmitted(bytes32 indexed tradeId,bytes32 evidenceHash)',
    'event EvidenceReviewed(bytes32 indexed tradeId,bool approved,bytes32 reasonHash)',
    'event TradeSettled(bytes32 indexed tradeId,address indexed buyer,address indexed seller,uint64 energyWh,uint256 buyerPoints,uint256 sellerPoints)',
    'event TradePaymentReleased(bytes32 indexed tradeId,address indexed seller,uint256 amountWei)',
    'event TradePaymentRefunded(bytes32 indexed tradeId,address indexed buyer,uint256 amountWei)',
]);
const boaInterface = new Interface([
    'event BondPosted(bytes32 indexed projectId,address indexed operator,uint256 amount,uint64 unlockAt)',
    'event MilestoneSubmitted(bytes32 indexed projectId,bytes32 indexed milestoneId,bytes32 evidenceHash)',
    'event MilestoneReviewed(bytes32 indexed projectId,bytes32 indexed milestoneId,bool approved,bytes32 reasonHash)',
]);
function findTradeEvent(receipt, name, tradeId) {
    return receipt?.logs
        .filter((log) => log.address.toLowerCase() === contractAddress.toLowerCase())
        .map((log) => { try {
        return tradingInterface.parseLog(log);
    }
    catch {
        return null;
    } })
        .find((event) => event?.name === name && event.args.tradeId === tradeId);
}
function findBoaEvent(receipt, name, projectId, milestoneId) {
    return receipt?.logs
        .filter((log) => log.address.toLowerCase() === boaContractAddress.toLowerCase())
        .map((log) => { try {
        return boaInterface.parseLog(log);
    }
    catch {
        return null;
    } })
        .find((event) => event?.name === name &&
        event.args.projectId === keccak256(toUtf8Bytes(projectId)) &&
        (milestoneId === undefined || event.args.milestoneId === keccak256(toUtf8Bytes(milestoneId))));
}
api.get('/api/health', asyncRoute(async (_request, response) => {
    await query('SELECT 1');
    let chainConnected = false;
    let chainError;
    if (provider) {
        try {
            chainConnected = Number(await provider.send('eth_chainId', [])) === chainId;
            if (!chainConnected)
                chainError = `RPC is connected to a different chain than configured chain ID ${chainId}.`;
        }
        catch {
            chainError = 'Configured EVM RPC is not reachable.';
        }
    }
    response.json({
        status: 'ok',
        database: 'connected',
        blockchain: { enabled: Boolean(contractAddress), connected: chainConnected, chainId, contractAddress: contractAddress || null, ...(chainError ? { message: chainError } : {}) },
        time: new Date().toISOString(),
    });
}));
api.get('/api/market/benchmark', asyncRoute(async (request, response) => {
    const state = z.enum(['CA', 'CO', 'NY', 'TX', 'WA']).default('CA').parse(request.query.state);
    try {
        response.json(await getMarketBenchmark(state));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'The EIA market benchmark is unavailable.';
        throw new HttpError(message.startsWith('Configure EIA_API_KEY') ? 503 : 502, message, 'MARKET_BENCHMARK_UNAVAILABLE');
    }
}));
api.post('/api/auth/nonce', createWalletNonce);
api.post('/api/auth/verify', verifyWalletSignature);
api.post('/api/auth/register', registerPasswordAccount);
api.post('/api/auth/login', loginPasswordAccount);
api.use('/api', requireAuth);
api.get('/api/me', (request, response) => {
    response.json({ id: request.user.id, username: request.user.username, displayName: request.user.displayName, role: request.user.role, walletAddress: request.user.walletAddress, authMethod: request.user.authMethod ?? 'wallet' });
});
api.patch('/api/me/role', asyncRoute(async (request, response) => {
    const { role } = z.object({ role: z.enum(['prosumer', 'consumer', 'both', 'funder']) }).parse(request.body);
    if (!['prosumer', 'consumer', 'both', 'funder'].includes(request.user.role)) {
        throw new HttpError(403, 'Verifier, administrator, and energy-host roles are managed by the platform operator.', 'ROLE_CHANGE_NOT_ALLOWED');
    }
    await query('UPDATE users SET role=$2 WHERE id=$1', [request.user.id, role]);
    request.user.role = role;
    response.json({ role });
}));
api.delete('/api/auth/session', revokeCurrentSession);
api.post('/api/auth/account-removal-challenge', createAccountRemovalChallenge);
api.post('/api/auth/wallet-link/nonce', createWalletLinkNonce);
api.post('/api/auth/wallet-link/verify', verifyWalletLink);
api.delete('/api/me', removeWalletAccount);
api.get('/api/config', (_request, response) => {
    response.json({
        chain: {
            chainId,
            enabled: Boolean(provider && contractAddress),
            paymentsEnabled: chainId === 11155111 && Boolean(provider && contractAddress),
            contractAddress: contractAddress || null,
            boaEnabled: Boolean(provider && boaContractAddress),
            boaContractAddress: boaContractAddress || null,
        },
    });
});
api.get('/api/bootstrap', asyncRoute(async (request, response) => {
    const userId = request.user.id;
    const [listings, trades, evidence, projects, points, contributions, activity, notifications] = await Promise.all([
        query(`SELECT l.public_id AS id,l.type,u.display_name AS owner,l.owner_id=$1 AS "isMine",
        l.available_kwh AS quantity,l.price_per_kwh AS price,l.service_area AS area,l.renewable_source AS source,
        l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd",l.status,l.note
       FROM listings l JOIN users u ON u.id=l.owner_id
       WHERE u.wallet_address IS NOT NULL AND u.demo_key IS NULL
         AND (l.status IN ('open','matched') OR (l.owner_id=$1 AND l.status='paused'))
       ORDER BY l.created_at DESC LIMIT 100`, [userId]),
        query(`SELECT t.public_id AS id,b.display_name AS buyer,s.display_name AS seller,
        b.wallet_address AS "buyerWalletAddress",s.wallet_address AS "sellerWalletAddress",t.quantity_kwh AS quantity,
        t.price_per_kwh AS price,t.status,t.created_at AS "createdAt",t.chain_tx_hash AS "chainTxHash",
        coalesce((SELECT count(*) FROM trade_confirmations c WHERE c.trade_id=t.id),0)::int AS confirmations,
        EXISTS(SELECT 1 FROM trade_confirmations c WHERE c.trade_id=t.id AND c.user_id=$1) AS "hasConfirmed",
        EXISTS(SELECT 1 FROM evidence e WHERE e.trade_id=t.id) AS "hasEvidence"
       FROM trades t JOIN users b ON b.id=t.buyer_id JOIN users s ON s.id=t.seller_id
       WHERE t.buyer_id=$1 OR t.seller_id=$1
       ORDER BY t.created_at DESC LIMIT 100`, [userId]),
        query(`SELECT e.public_id AS id,'Energy evidence · ' || s.display_name AS project,e.source,e.quantity_kwh AS quantity,
        e.interval_start AS "intervalStart",e.interval_end AS "intervalEnd",e.status,t.public_id AS trade,
        e.rejection_reason AS reason,e.evidence_hash AS "evidenceHash",e.chain_tx_hash AS "chainTxHash",
        e.evidence_reference AS reference,e.evidence_file_sha256 AS "evidenceFileSha256",
        t.buyer_id=$1 AS "buyerCanReview",t.status AS "tradeStatus",
        EXISTS(SELECT 1 FROM evidence_files ef WHERE ef.evidence_id=e.id) AS "evidenceFileAvailable",
        air.id AS "aiReviewId",air.model AS "aiModel",air.analysis AS "aiReview"
       FROM evidence e JOIN trades t ON t.id=e.trade_id JOIN users s ON s.id=e.submitter_id
       LEFT JOIN ai_evidence_reviews air ON air.id=e.ai_review_id
       WHERE s.wallet_address IS NOT NULL AND s.demo_key IS NULL
         AND (t.buyer_id=$1 OR t.seller_id=$1 OR $2)
       ORDER BY e.created_at DESC LIMIT 100`, [userId, ['verifier', 'admin'].includes(request.user.role)]),
        query(`SELECT p.public_id AS id,p.name,p.location,p.site_type AS "siteType",u.display_name AS owner,
        p.usable_area_m2 AS area,p.capacity_kw AS capacity,p.funding_target AS target,
        estimate.ai_model AS "estimateModel",estimate.estimate->>'methodology' AS "fundingMethodology",
        estimate.ai_analysis->>'summary' AS "estimateReviewSummary",
        estimate.ai_analysis->>'confidence' AS "estimateReviewConfidence",
        estimate.estimate->>'limitation' AS "estimateLimitation",
        coalesce(sum(c.amount) FILTER (WHERE c.status IN ('simulated','confirmed','pledged')),0) AS raised,
        p.permission_status AS permission,p.notes,p.status,
        p.revenue_share_json AS "revenueShares",
        coalesce((
          SELECT json_agg(json_build_object(
            'id',d.public_id,'amountMinor',d.amount_minor,'source',d.source,
            'createdAt',d.created_at,'allocations',d.allocations
          ) ORDER BY d.created_at DESC)
          FROM project_income_distributions d WHERE d.project_id=p.id
        ),'[]'::json) AS "incomeDistributions",
        count(c.id) FILTER (WHERE c.status IN ('simulated','confirmed','pledged'))::int AS "contributionCount"
       FROM projects p
       JOIN solar_funding_estimates estimate ON estimate.project_id=p.id
         AND estimate.ai_analysis ? 'summary' AND estimate.estimate ? 'requiredFundingMinor'
       JOIN users u ON u.id=p.owner_id LEFT JOIN contributions c ON c.project_id=p.id
       GROUP BY p.id,u.display_name,estimate.id ORDER BY p.created_at DESC LIMIT 100`),
        query('SELECT coalesce(sum(points),0)::text AS points FROM rewards WHERE user_id=$1', [userId]),
        query(`SELECT c.public_id AS id,p.public_id AS "projectId",u.display_name AS contributor,c.amount,c.created_at AS "createdAt",c.status
       FROM contributions c JOIN projects p ON p.id=c.project_id JOIN users u ON u.id=c.contributor_id
       WHERE c.contributor_id=$1 ORDER BY c.created_at DESC LIMIT 100`, [userId]),
        query(`SELECT e.event_type AS title,e.entity_type AS "entityType",e.entity_id AS detail,e.created_at AS "createdAt",e.source
       FROM audit_events e WHERE e.actor_id=$1 ORDER BY e.created_at DESC LIMIT 100`, [userId]),
        query(`SELECT id,title,detail,page,read_at AS "readAt",created_at AS "createdAt"
       FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId]),
    ]);
    response.json({
        listings: listings.rows.map((row) => ({ ...row, quantity: Number(row.quantity), price: Number(row.price), window: `${new Date(row.deliveryStart).toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}–${new Date(row.deliveryEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` })),
        trades: trades.rows.map((row) => ({
            ...row,
            quantity: Number(row.quantity),
            price: Number(row.price),
            status: uiTradeStatus(row.status === 'evidence_needed' && provider && contractAddress && !row.chainTxHash && !row.hasEvidence ? 'awaiting_buyer_escrow' : row.status),
            time: new Date(row.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
            hash: row.chainTxHash ?? 'Not submitted',
        })),
        evidence: evidence.rows.map((row) => ({ ...row, quantity: Number(row.quantity), interval: `${new Date(row.intervalStart).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} – ${new Date(row.intervalEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` })),
        projects: projects.rows.map((row, index) => ({ ...row, area: Number(row.area), capacity: Number(row.capacity), target: Number(row.target), raised: Number(row.raised), image: ['sunrise', 'courtyard', 'hub'][index % 3] })),
        contributions: contributions.rows.map((row) => ({ ...row, amount: Number(row.amount), time: new Date(row.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) })),
        points: Number(points.rows[0]?.points ?? 0),
        activity: activity.rows.map((row) => ({ title: row.title.replaceAll('.', ' '), detail: row.detail, time: new Date(row.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }), source: row.source })),
        notifications: notifications.rows,
    });
}));
api.patch('/api/notifications/:id/read', asyncRoute(async (request, response) => {
    const result = await query('UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at AS "readAt"', [routeId(request), request.user.id]);
    if (!result.rowCount)
        throw new HttpError(404, 'Notification not found.', 'NOTIFICATION_NOT_FOUND');
    response.json({ data: result.rows[0] });
}));
api.post('/api/notifications/read-all', asyncRoute(async (request, response) => {
    const result = await query('UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE user_id=$1 AND read_at IS NULL', [request.user.id]);
    response.json({ data: { updated: result.rowCount ?? 0 } });
}));
api.get('/api/listings', asyncRoute(async (request, response) => {
    const type = z.enum(['offer', 'request']).optional().parse(request.query.type);
    const area = z.string().max(120).optional().parse(request.query.area);
    const limit = z.coerce.number().int().min(1).max(100).default(30).parse(request.query.limit);
    const result = await query(`SELECT l.public_id AS id,l.type,u.display_name AS owner,l.quantity_kwh AS quantity,l.available_kwh AS available,
      l.price_per_kwh AS price,l.service_area AS area,l.renewable_source AS source,l.status,
      l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd"
     FROM listings l JOIN users u ON u.id=l.owner_id
     WHERE l.status='open' AND u.wallet_address IS NOT NULL AND u.demo_key IS NULL
       AND ($1::text IS NULL OR l.type=$1) AND ($2::text IS NULL OR l.service_area ILIKE '%' || $2 || '%')
     ORDER BY CASE WHEN l.type='offer' THEN l.price_per_kwh END ASC, l.created_at DESC LIMIT $3`, [type ?? null, area ?? null, limit]);
    response.json({ data: result.rows.map((row) => ({ ...row, quantity: Number(row.available), price: Number(row.price) })), limit });
}));
const listingInput = z.object({
    type: z.enum(['offer', 'request']),
    quantity: z.number().positive().max(100_000),
    price: z.number().positive().max(1_000_000),
    area: z.string().trim().min(2).max(120),
    source: z.string().trim().min(2).max(100),
    deliveryStart: z.string().datetime(),
    deliveryEnd: z.string().datetime(),
    note: z.string().max(500).optional().default(''),
}).refine((value) => new Date(value.deliveryEnd) > new Date(value.deliveryStart), { message: 'Delivery end must be after the start.' });
api.post('/api/listings', requireLinkedWallet, asyncRoute(async (request, response) => {
    const input = listingInput.parse(request.body);
    const role = request.user.role;
    if (input.type === 'offer' && !['prosumer', 'both', 'admin'].includes(role)) {
        throw new HttpError(403, 'Choose a prosumer account to publish an energy offer.', 'ROLE_NOT_ALLOWED');
    }
    if (input.type === 'request' && !['consumer', 'both', 'admin'].includes(role)) {
        throw new HttpError(403, 'Choose a consumer account to publish an energy request.', 'ROLE_NOT_ALLOWED');
    }
    const publicId = `${input.type === 'offer' ? 'OFF' : 'REQ'}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await transaction(async (client) => {
        const inserted = await client.query(`INSERT INTO listings(public_id,type,owner_id,quantity_kwh,available_kwh,price_per_kwh,service_area,renewable_source,delivery_start,delivery_end,note)
       VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10)
       RETURNING public_id AS id,type,quantity_kwh AS quantity,price_per_kwh AS price,service_area AS area,renewable_source AS source,status,delivery_start AS "deliveryStart",delivery_end AS "deliveryEnd"`, [publicId, input.type, request.user.id, input.quantity, input.price, input.area, input.source, input.deliveryStart, input.deliveryEnd, input.note]);
        await writeAudit(client, request.user.id, 'listing.created', 'listing', publicId, { type: input.type, quantityKwh: input.quantity });
        return inserted.rows[0];
    });
    response.status(201).json({ data: { ...result, owner: request.user.displayName, quantity: Number(result.quantity), price: Number(result.price) } });
}));
api.patch('/api/listings/:id', asyncRoute(async (request, response) => {
    const input = z.object({ action: z.enum(['pause', 'resume', 'cancel']) }).parse(request.body);
    const status = { pause: 'paused', resume: 'open', cancel: 'cancelled' }[input.action];
    const result = await query(`UPDATE listings SET status=$3 WHERE public_id=$1 AND owner_id=$2 AND status IN ('open','paused')
     RETURNING public_id AS id,status`, [request.params.id, request.user.id, status]);
    if (!result.rowCount)
        throw new HttpError(404, 'Listing not found or no longer editable.', 'LISTING_NOT_FOUND');
    const eventName = { pause: 'paused', resume: 'resumed', cancel: 'cancelled' }[input.action];
    await query('INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id) VALUES($1,$2,$3,$4)', [request.user.id, `listing.${eventName}`, 'listing', request.params.id]);
    response.json({ data: result.rows[0] });
}));
api.post('/api/trades', requireLinkedWallet, asyncRoute(async (request, response) => {
    const input = z.object({ listingId: z.string().min(5).max(80), quantity: z.number().positive().max(100_000) }).parse(request.body);
    const result = await transaction(async (client) => {
        const listingResult = await client.query(`SELECT l.id,l.public_id AS "publicId",l.type,l.owner_id AS "ownerId",l.available_kwh AS available,
        l.price_per_kwh AS price,l.service_area AS area,l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd"
       FROM listings l JOIN users owner ON owner.id=l.owner_id
       WHERE l.public_id=$1 AND l.status='open' AND owner.wallet_address IS NOT NULL AND owner.demo_key IS NULL
       FOR UPDATE OF l`, [input.listingId]);
        const listing = listingResult.rows[0];
        if (!listing)
            throw new HttpError(404, 'Listing is no longer available.', 'LISTING_NOT_FOUND');
        if (listing.ownerId === request.user.id)
            throw new HttpError(409, 'You cannot match against your own listing.', 'SELF_MATCH');
        if (input.quantity > Number(listing.available))
            throw new HttpError(409, 'Requested energy is no longer available.', 'INSUFFICIENT_QUANTITY');
        let sellerListing;
        if (listing.type === 'request') {
            const sellerListingResult = await client.query(`SELECT id,available_kwh AS available,price_per_kwh AS price FROM listings
         WHERE owner_id=$1 AND type='offer' AND status='open' AND available_kwh >= $2
           AND lower(service_area)=lower($3) AND price_per_kwh <= $4
           AND delivery_start < $5 AND $6 < delivery_end
         ORDER BY price_per_kwh ASC,created_at ASC LIMIT 1 FOR UPDATE`, [request.user.id, input.quantity, listing.area, listing.price, listing.deliveryEnd, listing.deliveryStart]);
            sellerListing = sellerListingResult.rows[0];
            if (!sellerListing)
                throw new HttpError(409, 'To fulfill this request, first publish a compatible offer with enough energy, an overlapping delivery window, and an acceptable price.', 'COMPATIBLE_OFFER_REQUIRED');
        }
        const buyerId = listing.type === 'offer' ? request.user.id : listing.ownerId;
        const sellerId = listing.type === 'offer' ? listing.ownerId : request.user.id;
        const tradeId = `TRD-${randomUUID().slice(0, 8).toUpperCase()}`;
        const price = sellerListing
            ? Math.round((Number(listing.price) + Number(sellerListing.price)) * 50) / 100
            : Number(listing.price);
        const trade = await client.query(`INSERT INTO trades(public_id,listing_id,counter_listing_id,buyer_id,seller_id,quantity_kwh,price_per_kwh)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING public_id AS id,quantity_kwh AS quantity,price_per_kwh AS price,status`, [tradeId, listing.id, sellerListing?.id ?? null, buyerId, sellerId, input.quantity, price]);
        const remaining = Number(listing.available) - input.quantity;
        await client.query('UPDATE listings SET available_kwh=$2::numeric,status=CASE WHEN $2::numeric=0 THEN $3 ELSE status END WHERE id=$1', [listing.id, remaining, 'matched']);
        if (sellerListing) {
            const sellerRemaining = Number(sellerListing.available) - input.quantity;
            await client.query('UPDATE listings SET available_kwh=$2::numeric,status=CASE WHEN $2::numeric=0 THEN $3 ELSE status END WHERE id=$1', [sellerListing.id, sellerRemaining, 'matched']);
        }
        await writeAudit(client, request.user.id, 'trade.match_proposed', 'trade', tradeId, { quantityKwh: input.quantity, indicativeTotal: Math.round(input.quantity * price * 100) / 100 });
        await writeNotification(client, listing.ownerId, `trade:${tradeId}:proposed`, 'New trade proposal', `${tradeId} · ${input.quantity} kWh awaits your response.`, 'Trades');
        return trade.rows[0];
    });
    response.status(201).json({ data: { ...result, buyer: listingParticipantName('buyer', request.user, listingType(request.body)), seller: listingParticipantName('seller', request.user, listingType(request.body)), quantity: Number(result.quantity), price: Number(result.price) } });
}));
api.post('/api/trades/:id/confirm', requireLinkedWallet, asyncRoute(async (request, response) => {
    const result = await transaction(async (client) => {
        const trade = await client.query('SELECT id,buyer_id AS "buyerId",seller_id AS "sellerId",status FROM trades WHERE public_id=$1 FOR UPDATE', [request.params.id]);
        const row = trade.rows[0];
        if (!row)
            throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND');
        if (row.buyerId !== request.user.id && row.sellerId !== request.user.id)
            throw new HttpError(403, 'Only a trade participant can confirm.', 'FORBIDDEN');
        if (!['awaiting_confirmation', 'committed', 'evidence_needed'].includes(row.status))
            throw new HttpError(409, 'This trade cannot be confirmed in its current state.', 'INVALID_TRADE_STATE');
        await client.query('INSERT INTO trade_confirmations(trade_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [row.id, request.user.id]);
        const confirmations = await client.query('SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1', [row.id]);
        const status = row.status === 'committed'
            ? 'committed'
            : confirmations.rows[0].count >= 2
                ? provider && contractAddress ? 'awaiting_buyer_escrow' : 'evidence_needed'
                : 'awaiting_confirmation';
        await client.query('UPDATE trades SET status=$2,updated_at=now() WHERE id=$1', [row.id, status]);
        await writeAudit(client, request.user.id, 'trade.participant_confirmed', 'trade', routeId(request), { confirmations: confirmations.rows[0].count });
        const otherPartyId = row.buyerId === request.user.id ? row.sellerId : row.buyerId;
        await writeNotification(client, otherPartyId, `trade:${routeId(request)}:confirmed:${request.user.id}`, 'Trade terms confirmed', `${routeId(request)} · ${confirmations.rows[0].count}/2 participants confirmed.`, 'Trades');
        return { status, confirmations: confirmations.rows[0].count };
    });
    response.json({ data: result });
}));
api.post('/api/trades/:id/commitment', requireLinkedWallet, asyncRoute(async (request, response) => {
    const input = z.object({ transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(request.body);
    if (!provider || !contractAddress)
        throw new HttpError(503, 'A blockchain RPC and deployed contract are not configured.', 'CHAIN_NOT_CONFIGURED');
    const result = await query(`SELECT t.id,t.public_id AS "publicId",t.quantity_kwh AS quantity,t.price_per_kwh AS price,
      buyer.wallet_address AS buyer,seller.wallet_address AS seller,t.status,t.chain_tx_hash AS "chainTxHash"
     FROM trades t JOIN users buyer ON buyer.id=t.buyer_id JOIN users seller ON seller.id=t.seller_id
     WHERE t.public_id=$1`, [request.params.id]);
    const trade = result.rows[0];
    if (!trade)
        throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND');
    if (!['awaiting_buyer_escrow', 'evidence_needed'].includes(trade.status) || trade.chainTxHash)
        throw new HttpError(409, 'This trade is not awaiting a first on-chain commitment.', 'INVALID_TRADE_STATE');
    if (!trade.buyer || !trade.seller)
        throw new HttpError(409, 'Both trade participants need a registered wallet address.', 'PARTICIPANT_WALLETS_REQUIRED');
    if (trade.buyer?.toLowerCase() !== request.user.walletAddress?.toLowerCase()) {
        throw new HttpError(403, 'Only the buyer can authorize and fund the on-chain trade commitment.', 'FORBIDDEN');
    }
    const confirmations = await query('SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1', [trade.id]);
    if (confirmations.rows[0].count < 2)
        throw new HttpError(409, 'Both trade participants must confirm before an on-chain commitment.', 'TRADE_CONFIRMATIONS_REQUIRED');
    const receipt = await provider.getTransactionReceipt(input.transactionHash);
    const transaction = await provider.getTransaction(input.transactionHash);
    if (!receipt || !transaction || receipt.status !== 1 || receipt.to?.toLowerCase() !== contractAddress.toLowerCase() ||
        receipt.from.toLowerCase() !== trade.buyer?.toLowerCase() ||
        transaction.from.toLowerCase() !== trade.buyer?.toLowerCase()) {
        throw new HttpError(422, 'Transaction receipt is missing, failed, sent by a different wallet, or sent to a different contract.', 'INVALID_CHAIN_RECEIPT');
    }
    const expectedTradeId = keccak256(toUtf8Bytes(trade.publicId));
    const match = receipt.logs.filter((log) => log.address.toLowerCase() === contractAddress.toLowerCase()).map((log) => {
        try {
            return tradingInterface.parseLog(log);
        }
        catch {
            return null;
        }
    }).find((event) => event?.name === 'TradeCommitted');
    if (!match || match.args.tradeId !== expectedTradeId || getAddress(match.args.buyer) !== getAddress(trade.buyer) || getAddress(match.args.seller) !== getAddress(trade.seller) ||
        BigInt(match.args.energyWh) !== BigInt(Math.round(Number(trade.quantity) * 1000)) ||
        BigInt(match.args.pricePerKWhScaled) !== BigInt(Math.round(Number(trade.price) * 10000)) ||
        BigInt(match.args.paymentWei) !== transaction.value ||
        (chainId === 11155111 && BigInt(match.args.paymentWei) <= 0n)) {
        throw new HttpError(422, 'Confirmed transaction does not commit the agreed trade terms.', 'CHAIN_TERMS_MISMATCH');
    }
    const updated = await query(`UPDATE trades SET chain_id=$2,contract_address=$3,chain_tx_hash=$4,status='committed',updated_at=now()
     WHERE id=$1 AND status IN ('awaiting_buyer_escrow','evidence_needed') AND chain_tx_hash IS NULL`, [trade.id, chainId, contractAddress, input.transactionHash]);
    if (!updated.rowCount)
        throw new HttpError(409, 'Trade state changed before the commitment was recorded.', 'INVALID_TRADE_STATE');
    await query('INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id,source,metadata) VALUES($1,$2,$3,$4,$5,$6)', [request.user.id, 'trade.chain_committed', 'trade', trade.publicId, 'blockchain', JSON.stringify({ chainId, transactionHash: input.transactionHash })]);
    response.json({ data: { tradeId: trade.publicId, status: 'committed', transactionHash: input.transactionHash, chainId } });
}));
api.post('/api/trades/:id/evidence', requireLinkedWallet, receiveEvidenceUpload, asyncRoute(async (request, response) => {
    const input = z.object({
        quantity: z.coerce.number().positive().max(100_000),
        source: z.string().trim().min(3).max(120),
        intervalStart: z.string().datetime(),
        intervalEnd: z.string().datetime(),
        evidenceReference: z.string().max(500).optional().default(''),
        evidenceFileSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
        aiReviewId: z.string().uuid().optional(),
    }).parse(request.body);
    const uploadedFile = request.file;
    const inspectedFile = uploadedFile ? inspectEvidenceFile(uploadedFile) : null;
    if (uploadedFile && input.evidenceFileSha256 && input.evidenceFileSha256 !== inspectedFile?.sha256) {
        throw new HttpError(409, 'The uploaded file does not match its submitted SHA-256 digest.', 'EVIDENCE_FILE_HASH_MISMATCH');
    }
    const evidenceFileSha256 = inspectedFile?.sha256 ?? input.evidenceFileSha256;
    if (input.aiReviewId && !uploadedFile) {
        throw new HttpError(400, 'Attach the same file that received the AI review.', 'EVIDENCE_FILE_REQUIRED');
    }
    if (new Date(input.intervalEnd) <= new Date(input.intervalStart))
        throw new HttpError(400, 'Evidence interval end must follow its start.', 'INVALID_INTERVAL');
    const evidence = await transaction(async (client) => {
        const tradeResult = await client.query('SELECT id,public_id AS "publicId",buyer_id AS "buyerId",seller_id AS "sellerId",quantity_kwh AS quantity,status FROM trades WHERE public_id=$1 FOR UPDATE', [request.params.id]);
        const trade = tradeResult.rows[0];
        if (!trade)
            throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND');
        if (trade.sellerId !== request.user.id)
            throw new HttpError(403, 'Only the energy seller can submit delivery evidence.', 'FORBIDDEN');
        const maySubmitEvidence = trade.status === 'committed' ||
            (!contractAddress && ['evidence_needed', 'awaiting_buyer_escrow'].includes(trade.status));
        if (!maySubmitEvidence)
            throw new HttpError(409, 'The buyer must fund the escrow before the seller can submit delivery evidence.', 'BUYER_ESCROW_REQUIRED');
        if (input.quantity > Number(trade.quantity))
            throw new HttpError(400, 'Evidence quantity cannot exceed the committed trade quantity.', 'EVIDENCE_EXCEEDS_TRADE');
        if (input.aiReviewId) {
            const review = await client.query('SELECT file_sha256 AS "fileSha256" FROM ai_evidence_reviews WHERE id=$1 AND trade_id=$2 AND submitter_id=$3', [input.aiReviewId, trade.id, request.user.id]);
            if (!review.rowCount)
                throw new HttpError(404, 'AI review not found for this trade and account.', 'AI_REVIEW_NOT_FOUND');
            if (!evidenceFileSha256 || review.rows[0].fileSha256 !== evidenceFileSha256) {
                throw new HttpError(409, 'The submitted file does not match the AI-reviewed evidence.', 'AI_REVIEW_FILE_MISMATCH');
            }
        }
        const publicId = `EVD-${randomUUID().slice(0, 8).toUpperCase()}`;
        const evidenceHash = keccak256(toUtf8Bytes(JSON.stringify({
            tradeId: trade.publicId,
            quantity: input.quantity,
            source: input.source,
            intervalStart: input.intervalStart,
            intervalEnd: input.intervalEnd,
            reference: input.evidenceReference,
            ...(evidenceFileSha256 ? { evidenceFileSha256 } : {}),
        })));
        const inserted = await client.query(`INSERT INTO evidence(public_id,trade_id,submitter_id,quantity_kwh,source,interval_start,interval_end,evidence_hash,chain_tx_hash,evidence_reference,evidence_file_sha256,ai_review_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11)
       RETURNING public_id AS id,quantity_kwh AS quantity,source,status,evidence_hash AS "evidenceHash",evidence_reference AS reference,evidence_file_sha256 AS "evidenceFileSha256",ai_review_id AS "aiReviewId"`, [publicId, trade.id, request.user.id, input.quantity, input.source, input.intervalStart, input.intervalEnd, evidenceHash, input.evidenceReference, evidenceFileSha256 ?? null, input.aiReviewId ?? null]);
        if (uploadedFile && inspectedFile) {
            const extension = uploadedFile.originalname.split(/[\\/]/).pop()?.match(/\.[a-zA-Z0-9]+$/)?.[0].toLowerCase();
            if (!extension || !['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.csv'].includes(extension)) {
                throw new HttpError(415, 'Evidence file extension is not supported.', 'UNSUPPORTED_EVIDENCE_FILE');
            }
            await client.query(`INSERT INTO evidence_files(evidence_id,file_kind,file_extension,sha256,content)
         SELECT id,$2,$3,$4,$5 FROM evidence WHERE public_id=$1`, [publicId, inspectedFile.kind, extension, inspectedFile.sha256, uploadedFile.buffer]);
        }
        await client.query("UPDATE trades SET status='under_review',updated_at=now() WHERE id=$1", [trade.id]);
        await writeNotification(client, trade.buyerId, `evidence:${publicId}:submitted`, 'Delivery evidence needs your review', `${trade.publicId} · ${input.quantity} kWh`, 'Evidence');
        await writeAudit(client, request.user.id, 'evidence.submitted', 'trade', trade.publicId, { evidenceId: publicId, quantityKwh: input.quantity, source: input.source, evidenceHash, fileAttached: Boolean(uploadedFile), evidenceFileSha256: evidenceFileSha256 ?? null });
        return inserted.rows[0];
    });
    response.status(201).json({ data: { ...evidence, quantity: Number(evidence.quantity) } });
}));
api.get('/api/evidence/:id/file', asyncRoute(async (request, response) => {
    const result = await query(`SELECT e.public_id AS id,t.buyer_id AS "buyerId",t.seller_id AS "sellerId",
      f.file_kind AS "fileKind",f.file_extension AS "fileExtension",f.content
     FROM evidence e JOIN trades t ON t.id=e.trade_id
     JOIN evidence_files f ON f.evidence_id=e.id
     WHERE e.public_id=$1`, [routeId(request)]);
    const file = result.rows[0];
    if (!file)
        throw new HttpError(404, 'Evidence file not found.', 'EVIDENCE_FILE_NOT_FOUND');
    if (file.buyerId !== request.user.id &&
        file.sellerId !== request.user.id &&
        !['verifier', 'admin'].includes(request.user.role)) {
        throw new HttpError(403, 'Only a trade participant or authorized verifier can download this evidence file.', 'FORBIDDEN');
    }
    response.setHeader('Content-Type', file.fileKind);
    response.setHeader('Content-Disposition', `attachment; filename="${file.id.toLowerCase()}${file.fileExtension}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.content);
}));
api.post('/api/trades/:id/evidence/ai-review', requireLinkedWallet, rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }), receiveEvidenceUpload, asyncRoute(async (request, response) => {
    if (request.body.consent !== 'true')
        throw new HttpError(400, 'Explicit consent is required before sending a file to the AI provider.', 'AI_REVIEW_CONSENT_REQUIRED');
    const file = request.file;
    if (!file)
        throw new HttpError(400, 'Choose an evidence file before requesting an AI review.', 'EVIDENCE_FILE_REQUIRED');
    const inspected = inspectEvidenceFile(file);
    const tradeResult = await query('SELECT id,public_id AS "publicId",seller_id AS "sellerId",quantity_kwh AS quantity,status FROM trades WHERE public_id=$1', [routeId(request)]);
    const trade = tradeResult.rows[0];
    if (!trade)
        throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND');
    if (trade.sellerId !== request.user.id)
        throw new HttpError(403, 'Only the energy seller can submit delivery evidence.', 'FORBIDDEN');
    const mayReviewEvidence = trade.status === 'committed' ||
        (!contractAddress && ['evidence_needed', 'awaiting_buyer_escrow'].includes(trade.status));
    if (!mayReviewEvidence)
        throw new HttpError(409, 'The buyer must fund the escrow before the seller can submit delivery evidence.', 'BUYER_ESCROW_REQUIRED');
    const result = await reviewEvidenceFile(file, inspected.kind, { tradeId: trade.publicId, quantityKwh: Number(trade.quantity) });
    const saved = await transaction(async (client) => {
        const inserted = await client.query(`INSERT INTO ai_evidence_reviews(trade_id,submitter_id,file_sha256,file_kind,model,analysis)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [trade.id, request.user.id, inspected.sha256, inspected.kind, result.model, JSON.stringify(result.analysis)]);
        await writeAudit(client, request.user.id, 'evidence.ai_reviewed', 'trade', trade.publicId, { aiReviewId: inserted.rows[0].id, model: result.model, fileKind: inspected.kind, fileSha256: inspected.sha256 });
        return inserted.rows[0];
    });
    response.json({ data: { id: saved.id, fileSha256: inspected.sha256, model: result.model, analysis: result.analysis } });
}));
api.post('/api/evidence/:id/review', requireLinkedWallet, asyncRoute(async (request, response) => {
    const input = z.object({
        decision: z.enum(['approve', 'reject']),
        reason: z.string().trim().max(500).optional(),
        chainTransactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
    }).parse(request.body);
    if (input.decision === 'reject' && !input.reason)
        throw new HttpError(400, 'A reason is required when opening or resolving a dispute.', 'REJECTION_REASON_REQUIRED');
    const result = await transaction(async (client) => {
        const current = await client.query(`SELECT e.id,e.trade_id AS "tradeId",t.public_id AS "tradePublicId",t.buyer_id AS "buyerId",t.seller_id AS "sellerId",
        t.chain_tx_hash AS "commitTxHash",
        e.submitter_id AS "submitterId",e.status AS "evidenceStatus",t.status AS "tradeStatus",
        e.quantity_kwh AS quantity,e.evidence_hash AS "evidenceHash"
       FROM evidence e JOIN trades t ON t.id=e.trade_id
       WHERE e.public_id=$1 FOR UPDATE OF e,t`, [routeId(request)]);
        const evidence = current.rows[0];
        if (!evidence)
            throw new HttpError(404, 'Evidence record not found.', 'EVIDENCE_NOT_FOUND');
        const isBuyer = evidence.buyerId === request.user.id;
        const isReviewer = ['verifier', 'admin'].includes(request.user.role);
        const resolvingDispute = isReviewer && evidence.evidenceStatus === 'disputed' && evidence.tradeStatus === 'disputed';
        if (isBuyer && (evidence.evidenceStatus !== 'pending' || evidence.tradeStatus !== 'under_review')) {
            throw new HttpError(409, 'Only evidence awaiting buyer review can be accepted or disputed.', 'INVALID_EVIDENCE_STATE');
        }
        if (!isBuyer && !resolvingDispute) {
            throw new HttpError(403, 'The buyer reviews delivery evidence. Verifiers may only resolve an open dispute.', 'FORBIDDEN');
        }
        if (evidence.submitterId === request.user.id)
            throw new HttpError(403, 'The evidence submitter cannot review their own evidence.', 'SELF_REVIEW');
        const confirmations = await client.query('SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1', [evidence.tradeId]);
        if (confirmations.rows[0].count < 2)
            throw new HttpError(409, 'Both trade participants must confirm before evidence can be reviewed.', 'TRADE_CONFIRMATIONS_REQUIRED');
        const hasContract = Boolean(contractAddress && !request.user.demoKey);
        if (hasContract && !input.chainTransactionHash) {
            throw new HttpError(409, 'Confirm this decision in your wallet before updating the trade.', 'CHAIN_REVIEW_REQUIRED');
        }
        if (hasContract) {
            if (!provider)
                throw new HttpError(503, 'The configured blockchain RPC is unavailable.', 'CHAIN_NOT_CONFIGURED');
            const receipt = await provider.getTransactionReceipt(input.chainTransactionHash);
            const chainTransaction = await provider.getTransaction(input.chainTransactionHash);
            const tradeHash = keccak256(toUtf8Bytes(evidence.tradePublicId));
            const reasonHash = keccak256(toUtf8Bytes(input.reason ?? ''));
            const submitted = findTradeEvent(receipt, 'EvidenceSubmitted', tradeHash);
            const reviewed = findTradeEvent(receipt, 'EvidenceReviewed', tradeHash);
            const settled = findTradeEvent(receipt, 'TradeSettled', tradeHash);
            const released = findTradeEvent(receipt, 'TradePaymentReleased', tradeHash);
            const refunded = findTradeEvent(receipt, 'TradePaymentRefunded', tradeHash);
            if (!evidence.commitTxHash) {
                throw new HttpError(409, 'The trade commitment transaction is missing. Contact support before approving this trade.', 'CHAIN_COMMITMENT_REQUIRED');
            }
            const commitmentReceipt = await provider.getTransactionReceipt(evidence.commitTxHash);
            const commitment = findTradeEvent(commitmentReceipt, 'TradeCommitted', tradeHash);
            const committedBuyer = commitment?.args.buyer;
            const committedSeller = commitment?.args.seller;
            if (!commitment || typeof committedBuyer !== 'string' || typeof committedSeller !== 'string') {
                throw new HttpError(409, 'The original trade participants could not be verified from the commitment transaction.', 'INVALID_CHAIN_COMMITMENT');
            }
            const expectedSender = isBuyer ? committedBuyer : request.user.walletAddress;
            const expectedReasonHash = isBuyer && input.decision === 'approve' ? `0x${'0'.repeat(64)}` : reasonHash;
            if (!receipt || !chainTransaction || receipt.status !== 1 ||
                receipt.to?.toLowerCase() !== contractAddress.toLowerCase() ||
                receipt.from.toLowerCase() !== request.user.walletAddress?.toLowerCase() ||
                chainTransaction.from.toLowerCase() !== expectedSender?.toLowerCase() ||
                !reviewed || reviewed.args.approved !== (input.decision === 'approve') ||
                reviewed.args.reasonHash !== expectedReasonHash) {
                throw new HttpError(422, 'Confirmed contract decision does not match this evidence review.', 'INVALID_CHAIN_REVIEW');
            }
            if (isBuyer && (!submitted || submitted.args.evidenceHash !== evidence.evidenceHash)) {
                throw new HttpError(422, 'The buyer decision is not bound to the submitted evidence record.', 'INVALID_CHAIN_EVIDENCE');
            }
            if (input.decision === 'approve' && (!settled ||
                getAddress(settled.args.buyer) !== getAddress(committedBuyer) ||
                getAddress(settled.args.seller) !== getAddress(committedSeller))) {
                throw new HttpError(422, 'The approved evidence transaction did not settle this trade.', 'INVALID_CHAIN_SETTLEMENT');
            }
            if (chainId === 11155111 && input.decision === 'approve') {
                if (!commitment || !released ||
                    getAddress(released.args.seller) !== getAddress(committedSeller) ||
                    BigInt(released.args.amountWei) !== BigInt(commitment.args.paymentWei)) {
                    throw new HttpError(422, 'The transaction did not release the full escrow to the seller.', 'INVALID_CHAIN_PAYMENT');
                }
            }
            if (resolvingDispute && input.decision === 'reject' && chainId === 11155111) {
                if (!commitment || !refunded ||
                    getAddress(refunded.args.buyer) !== getAddress(committedBuyer) ||
                    BigInt(refunded.args.amountWei) !== BigInt(commitment.args.paymentWei)) {
                    throw new HttpError(422, 'The dispute resolution did not refund the full escrow to the buyer.', 'INVALID_CHAIN_REFUND');
                }
            }
        }
        const buyerDispute = isBuyer && input.decision === 'reject';
        const evidenceStatus = buyerDispute ? 'disputed' : input.decision === 'approve' ? 'approved' : 'rejected';
        const tradeStatus = buyerDispute
            ? 'disputed'
            : hasContract
                ? input.decision === 'approve' ? 'settled' : 'refunded'
                : input.decision === 'approve' ? 'settled' : 'cancelled';
        await client.query('UPDATE evidence SET status=$2,reviewer_id=$3,rejection_reason=$4,reviewed_at=now(),chain_tx_hash=$5 WHERE id=$1', [evidence.id, evidenceStatus, isBuyer ? null : request.user.id, input.reason ?? null, input.chainTransactionHash ?? null]);
        await client.query('UPDATE trades SET status=$2,updated_at=now() WHERE id=$1', [evidence.tradeId, tradeStatus]);
        if (buyerDispute) {
            const reviewers = await client.query(`SELECT id FROM users WHERE role IN ('verifier','admin') AND wallet_address IS NOT NULL AND demo_key IS NULL`);
            for (const reviewer of reviewers.rows) {
                await writeNotification(client, reviewer.id, `evidence:${routeId(request)}:dispute`, 'Trade dispute needs review', `${evidence.tradePublicId} · ${input.reason}`, 'Evidence');
            }
        }
        for (const userId of new Set([evidence.buyerId, evidence.sellerId])) {
            if (userId !== request.user.id) {
                await writeNotification(client, userId, `evidence:${routeId(request)}:reviewed`, buyerDispute ? 'Trade dispute opened' : `Evidence ${evidenceStatus}`, buyerDispute
                    ? `${evidence.tradePublicId} · escrow remains locked pending dispute resolution.`
                    : `${evidence.tradePublicId} · ${input.decision === 'approve' ? 'approved' : 'rejected'} by ${isBuyer ? 'the buyer' : 'an authorized verifier'}.`, 'Evidence');
            }
        }
        if (tradeStatus === 'settled') {
            const points = Math.max(1, Math.floor(Number(evidence.quantity) * 10));
            await client.query('INSERT INTO rewards(trade_id,user_id,points) VALUES($1,$2,$3),($1,$4,$3) ON CONFLICT(trade_id,user_id) DO NOTHING', [evidence.tradeId, evidence.sellerId, points, evidence.buyerId]);
        }
        await writeAudit(client, request.user.id, `evidence.${evidenceStatus}`, 'trade', evidence.tradePublicId, {
            evidenceId: routeId(request),
            reason: input.reason,
            transactionHash: input.chainTransactionHash ?? null,
        });
        return { evidenceId: routeId(request), tradeId: evidence.tradePublicId, evidenceStatus, tradeStatus };
    });
    response.json({ data: result });
}));
api.post('/api/trades/:id/settle', requireLinkedWallet, asyncRoute(async (request, response) => {
    if (request.user.demoKey && request.body?.chainTransactionHash) {
        throw new HttpError(400, 'Demo profiles cannot attach unverified wallet transaction receipts.', 'DEMO_CHAIN_ACTION_UNAVAILABLE');
    }
    const chainBacked = Boolean(contractAddress && !request.user.demoKey);
    const settlement = await transaction(async (client) => {
        const tradeResult = await client.query(`SELECT t.id,t.public_id AS "publicId",t.buyer_id AS "buyerId",t.seller_id AS "sellerId",
        buyer.wallet_address AS "buyerWallet",seller.wallet_address AS "sellerWallet",
        t.chain_tx_hash AS "commitTxHash",t.quantity_kwh AS quantity,t.status
       FROM trades t JOIN users buyer ON buyer.id=t.buyer_id JOIN users seller ON seller.id=t.seller_id
       WHERE t.public_id=$1 FOR UPDATE OF t`, [request.params.id]);
        const trade = tradeResult.rows[0];
        if (!trade)
            throw new HttpError(404, 'Trade not found.', 'TRADE_NOT_FOUND');
        if (trade.buyerId !== request.user.id && trade.sellerId !== request.user.id)
            throw new HttpError(403, 'Only a trade participant may settle this trade.', 'FORBIDDEN');
        if (trade.status !== 'ready_to_settle')
            throw new HttpError(409, 'Settlement requires approved evidence and both participants to confirm the trade.', 'SETTLEMENT_NOT_READY');
        const confirmations = await client.query('SELECT count(*)::int AS count FROM trade_confirmations WHERE trade_id=$1', [trade.id]);
        if (confirmations.rows[0].count < 2)
            throw new HttpError(409, 'Both trade participants must confirm before settlement.', 'TRADE_CONFIRMATIONS_REQUIRED');
        if (chainBacked && !request.body?.chainTransactionHash)
            throw new HttpError(409, 'Record the confirmed smart-contract settlement transaction before finalizing.', 'CHAIN_SETTLEMENT_REQUIRED');
        const evidenceResult = await client.query('SELECT id FROM evidence WHERE trade_id=$1 AND status=$2 ORDER BY reviewed_at DESC LIMIT 1', [trade.id, 'approved']);
        if (!evidenceResult.rowCount)
            throw new HttpError(409, 'Settlement is gated on approved renewable evidence.', 'APPROVED_EVIDENCE_REQUIRED');
        if (chainBacked && request.body.chainTransactionHash) {
            const receipt = await provider.getTransactionReceipt(request.body.chainTransactionHash);
            const expectedTradeId = keccak256(toUtf8Bytes(trade.publicId));
            const settledEvent = receipt?.logs.filter((log) => log.address.toLowerCase() === contractAddress.toLowerCase()).map((log) => { try {
                return tradingInterface.parseLog(log);
            }
            catch {
                return null;
            } }).find((event) => event?.name === 'TradeSettled' && event.args.tradeId === expectedTradeId);
            if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== contractAddress.toLowerCase() ||
                receipt.from.toLowerCase() !== request.user.walletAddress?.toLowerCase() || !settledEvent ||
                getAddress(settledEvent.args.buyer) !== getAddress(trade.buyerWallet) ||
                getAddress(settledEvent.args.seller) !== getAddress(trade.sellerWallet)) {
                throw new HttpError(422, 'Confirmed contract settlement event was not found or was sent by a different wallet.', 'INVALID_CHAIN_SETTLEMENT');
            }
            if (chainId === 11155111) {
                if (!trade.commitTxHash)
                    throw new HttpError(409, 'The escrow commitment transaction is missing.', 'CHAIN_COMMITMENT_REQUIRED');
                const commitmentReceipt = await provider.getTransactionReceipt(trade.commitTxHash);
                const commitment = commitmentReceipt?.logs.filter((log) => log.address.toLowerCase() === contractAddress.toLowerCase())
                    .map((log) => { try {
                    return tradingInterface.parseLog(log);
                }
                catch {
                    return null;
                } })
                    .find((event) => event?.name === 'TradeCommitted' && event.args.tradeId === expectedTradeId);
                const payment = receipt.logs.filter((log) => log.address.toLowerCase() === contractAddress.toLowerCase()).map((log) => { try {
                    return tradingInterface.parseLog(log);
                }
                catch {
                    return null;
                } })
                    .find((event) => event?.name === 'TradePaymentReleased' && event.args.tradeId === expectedTradeId);
                if (!commitment || !payment || getAddress(payment.args.seller) !== getAddress(trade.sellerWallet) ||
                    BigInt(payment.args.amountWei) !== BigInt(commitment.args.paymentWei)) {
                    throw new HttpError(422, 'Confirmed settlement transaction did not release escrowed ETH to the seller.', 'INVALID_CHAIN_PAYMENT');
                }
            }
        }
        const points = Math.max(1, Math.floor(Number(trade.quantity) * 10));
        await client.query("UPDATE trades SET status='settled',updated_at=now() WHERE id=$1", [trade.id]);
        await client.query('INSERT INTO rewards(trade_id,user_id,points) VALUES($1,$2,$3),($1,$4,$3) ON CONFLICT(trade_id,user_id) DO NOTHING', [trade.id, trade.sellerId, points, trade.buyerId]);
        await writeAudit(client, request.user.id, 'trade.settled', 'trade', trade.publicId, { quantityKwh: Number(trade.quantity), pointsPerParticipant: points, simulated: !chainBacked });
        return { tradeId: trade.publicId, status: 'settled', pointsPerParticipant: points, settlementMode: chainBacked ? 'blockchain' : 'database' };
    });
    response.json({ data: settlement });
}));
api.get('/api/projects', asyncRoute(async (_request, response) => {
    const result = await query(`SELECT p.public_id AS id,p.name,p.location,p.site_type AS "siteType",u.display_name AS owner,
      p.usable_area_m2 AS area,p.capacity_kw AS capacity,p.funding_target AS target,
      estimate.ai_model AS "estimateModel",estimate.estimate->>'methodology' AS "fundingMethodology",
      estimate.ai_analysis->>'summary' AS "estimateReviewSummary",
      estimate.ai_analysis->>'confidence' AS "estimateReviewConfidence",
      estimate.estimate->>'limitation' AS "estimateLimitation",
      coalesce(sum(c.amount) FILTER (WHERE c.status IN ('simulated','confirmed','pledged')),0) AS raised,
      p.permission_status AS permission,p.notes,p.status,p.agreement_version AS "agreementVersion",
      p.energy_share_json AS "energyShares",p.revenue_share_json AS "revenueShares",
      coalesce((
        SELECT json_agg(json_build_object(
          'id',d.public_id,'amountMinor',d.amount_minor,'source',d.source,
          'createdAt',d.created_at,'allocations',d.allocations
        ) ORDER BY d.created_at DESC)
        FROM project_income_distributions d WHERE d.project_id=p.id
      ),'[]'::json) AS "incomeDistributions"
     FROM projects p
     JOIN solar_funding_estimates estimate ON estimate.project_id=p.id
       AND estimate.ai_analysis ? 'summary' AND estimate.estimate ? 'requiredFundingMinor'
     JOIN users u ON u.id=p.owner_id LEFT JOIN contributions c ON c.project_id=p.id
     GROUP BY p.id,u.display_name,estimate.id ORDER BY p.created_at DESC`);
    response.json({ data: result.rows });
}));
api.get('/api/projects/:id/boa', asyncRoute(async (request, response) => {
    const project = await query('SELECT id,owner_id AS "ownerId" FROM projects WHERE public_id=$1', [routeId(request)]);
    if (!project.rowCount)
        throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND');
    const [bond, milestones] = await Promise.all([
        query(`SELECT b.amount_minor AS "amountWei",b.unlock_at AS "unlockAt",b.status,b.post_tx_hash AS "postTxHash",
        b.release_tx_hash AS "releaseTxHash",b.slashed_minor AS "slashedWei",u.display_name AS operator
       FROM operator_bonds b JOIN users u ON u.id=b.operator_id WHERE b.project_id=$1`, [project.rows[0].id]),
        query(`SELECT public_id AS id,title,amount_minor AS "amountWei",sequence_no AS sequence,status,
        evidence_hash AS "evidenceHash",evidence_reference AS "evidenceReference",
        reviewed_at AS "reviewedAt" FROM project_milestones WHERE project_id=$1 ORDER BY sequence_no`, [project.rows[0].id]),
    ]);
    response.json({ data: { enabled: Boolean(provider && boaContractAddress), bond: bond.rows[0] ?? null, milestones: milestones.rows } });
}));
api.post('/api/projects/:id/boa/bond', requireLinkedWallet, asyncRoute(async (request, response) => {
    const input = z.object({
        amountWei: z.string().regex(/^[1-9][0-9]{0,30}$/),
        unlockAt: z.string().datetime(),
        transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    }).parse(request.body);
    if (!boaContractAddress || !provider)
        throw new HttpError(503, 'The BOA contract and RPC must be configured before posting a bond.', 'BOA_NOT_CONFIGURED');
    const receipt = await provider.getTransactionReceipt(input.transactionHash);
    const chainTransaction = await provider.getTransaction(input.transactionHash);
    const posted = findBoaEvent(receipt, 'BondPosted', routeId(request));
    if (!receipt || receipt.status !== 1 || chainTransaction?.from.toLowerCase() !== request.user.walletAddress?.toLowerCase() ||
        receipt.to?.toLowerCase() !== boaContractAddress.toLowerCase() || !posted ||
        posted.args.operator.toLowerCase() !== request.user.walletAddress?.toLowerCase() ||
        BigInt(posted.args.amount) !== BigInt(input.amountWei) ||
        Number(posted.args.unlockAt) !== Math.floor(new Date(input.unlockAt).getTime() / 1000)) {
        throw new HttpError(422, 'The confirmed BOA bond event does not match this project, operator, amount, or unlock time.', 'INVALID_BOND_TRANSACTION');
    }
    const result = await transaction(async (client) => {
        const project = await client.query('SELECT id,owner_id AS "ownerId",public_id AS "publicId" FROM projects WHERE public_id=$1 FOR UPDATE', [routeId(request)]);
        const row = project.rows[0];
        if (!row)
            throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND');
        if (row.ownerId !== request.user.id)
            throw new HttpError(403, 'Only the project owner can post its operator bond.', 'FORBIDDEN');
        if (new Date(input.unlockAt) <= new Date())
            throw new HttpError(400, 'The bond unlock time must be in the future.', 'INVALID_UNLOCK_TIME');
        const existing = await client.query('SELECT 1 FROM operator_bonds WHERE project_id=$1', [row.id]);
        if (existing.rowCount)
            throw new HttpError(409, 'This project already has an operator bond.', 'BOND_ALREADY_EXISTS');
        const bond = await client.query(`INSERT INTO operator_bonds(project_id,operator_id,amount_minor,unlock_at,status,chain_id,contract_address,post_tx_hash)
       VALUES($1,$2,$3,$4,'locked',$5,$6,$7)
       RETURNING amount_minor AS "amountWei",unlock_at AS "unlockAt",status,post_tx_hash AS "postTxHash"`, [row.id, request.user.id, input.amountWei, input.unlockAt, chainId, boaContractAddress || null, input.transactionHash]);
        await client.query(`INSERT INTO project_milestones(public_id,project_id,title,amount_minor,sequence_no)
       VALUES ($1,$2,'Site due diligence',0,1),($3,$2,'Equipment and installation evidence',0,2),
              ($4,$2,'Commissioning and meter validation',0,3)
       ON CONFLICT(project_id,sequence_no) DO NOTHING`, [`MS-${randomUUID().slice(0, 8).toUpperCase()}`, row.id, `MS-${randomUUID().slice(0, 8).toUpperCase()}`, `MS-${randomUUID().slice(0, 8).toUpperCase()}`]);
        await writeAudit(client, request.user.id, 'project.bond_posted', 'project', row.publicId, { amountWei: input.amountWei, unlockAt: input.unlockAt, transactionHash: input.transactionHash });
        return bond.rows[0];
    });
    response.status(201).json({ data: result });
}));
api.post('/api/projects/:id/boa/milestones/:milestoneId/submit', requireLinkedWallet, asyncRoute(async (request, response) => {
    const input = z.object({ evidenceHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/), evidenceReference: z.string().trim().max(500).optional(), transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(request.body);
    const milestoneId = z.string().min(1).parse(request.params.milestoneId);
    if (!boaContractAddress || !provider)
        throw new HttpError(503, 'The BOA contract and RPC must be configured before submitting evidence.', 'BOA_NOT_CONFIGURED');
    const receipt = await provider.getTransactionReceipt(input.transactionHash);
    const event = findBoaEvent(receipt, 'MilestoneSubmitted', routeId(request), milestoneId);
    if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== boaContractAddress.toLowerCase() || !event || event.args.evidenceHash !== input.evidenceHash) {
        throw new HttpError(422, 'The confirmed milestone submission event could not be verified.', 'INVALID_MILESTONE_TRANSACTION');
    }
    const result = await query(`UPDATE project_milestones m SET status='submitted',evidence_hash=$1,evidence_reference=$2
     FROM projects p JOIN operator_bonds b ON b.project_id=p.id
     WHERE p.public_id=$3 AND m.public_id=$4 AND m.project_id=p.id AND b.operator_id=$5 AND m.status IN ('pending','rejected')
     RETURNING m.public_id AS id,m.status,m.evidence_hash AS "evidenceHash",m.evidence_reference AS "evidenceReference"`, [input.evidenceHash, input.evidenceReference ?? null, routeId(request), milestoneId, request.user.id]);
    if (!result.rowCount)
        throw new HttpError(404, 'Milestone is not available for submission.', 'MILESTONE_NOT_FOUND');
    response.json({ data: result.rows[0] });
}));
api.post('/api/projects/:id/boa/milestones/:milestoneId/review', requireLinkedWallet, asyncRoute(async (request, response) => {
    if (!['verifier', 'admin'].includes(request.user.role))
        throw new HttpError(403, 'Only an independent verifier can review operator milestones.', 'FORBIDDEN');
    const input = z.object({ decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(500).optional(), transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(request.body);
    const milestoneId = z.string().min(1).parse(request.params.milestoneId);
    if (input.decision === 'reject' && !input.reason)
        throw new HttpError(400, 'A reason is required when rejecting evidence.', 'REASON_REQUIRED');
    if (!boaContractAddress || !provider)
        throw new HttpError(503, 'The BOA contract and RPC must be configured before reviewing evidence.', 'BOA_NOT_CONFIGURED');
    const receipt = await provider.getTransactionReceipt(input.transactionHash);
    const event = findBoaEvent(receipt, 'MilestoneReviewed', routeId(request), milestoneId);
    if (!receipt || receipt.status !== 1 || receipt.to?.toLowerCase() !== boaContractAddress.toLowerCase() || !event || Boolean(event.args.approved) !== (input.decision === 'approve')) {
        throw new HttpError(422, 'The confirmed milestone review event could not be verified.', 'INVALID_MILESTONE_TRANSACTION');
    }
    const result = await query(`UPDATE project_milestones m SET status=$1,reviewer_id=$2,reviewed_at=now()
     FROM projects p WHERE p.public_id=$3 AND m.public_id=$4 AND m.project_id=p.id AND m.status='submitted'
     RETURNING m.public_id AS id,m.status,m.reviewed_at AS "reviewedAt"`, [input.decision === 'approve' ? 'approved' : 'rejected', request.user.id, routeId(request), milestoneId]);
    if (!result.rowCount)
        throw new HttpError(404, 'Submitted milestone not found.', 'MILESTONE_NOT_FOUND');
    response.json({ data: result.rows[0] });
}));
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
    }).parse(request.body);
    const sharesTotal = (shares) => Object.values(shares).reduce((sum, value) => sum + value, 0);
    if (sharesTotal(input.energyShares) !== 100 || sharesTotal(input.revenueShares) !== 100)
        throw new HttpError(400, 'Energy and revenue share percentages must each total 100%.', 'INVALID_AGREEMENT_SHARES');
    const publicId = `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await transaction(async (client) => {
        {
            const estimate = await client.query(`SELECT (estimate->>'requiredFundingMinor')::bigint AS "requiredFundingMinor",
          (estimate->>'usableAreaM2')::numeric AS "usableAreaM2",ai_model AS "aiModel",
          input->>'location' AS "estimatedLocation",input->>'siteType' AS "estimatedSiteType",
          input->'revenueShares' AS "estimatedShares"
         FROM solar_funding_estimates
         WHERE id=$1 AND created_by=$2 AND project_id IS NULL
           AND ai_analysis ? 'summary' AND estimate ? 'requiredFundingMinor'
         FOR UPDATE`, [input.fundingEstimateId, request.user.id]);
            const savedEstimate = estimate.rows[0];
            if (!savedEstimate)
                throw new HttpError(404, 'Funding estimate not found or already used.', 'FUNDING_ESTIMATE_NOT_FOUND');
            const estimatedShares = savedEstimate.estimatedShares;
            if (Number(savedEstimate.usableAreaM2) !== input.area ||
                Number(savedEstimate.requiredFundingMinor) !== Math.round(input.target * 100) ||
                savedEstimate.estimatedLocation.trim().toLowerCase() !== input.location.trim().toLowerCase() ||
                savedEstimate.estimatedSiteType.trim().toLowerCase() !== input.siteType.trim().toLowerCase() ||
                estimatedShares?.owner !== input.revenueShares.owner ||
                estimatedShares?.funder !== input.revenueShares.funder ||
                estimatedShares?.community !== input.revenueShares.community) {
                throw new HttpError(409, 'Project location, site type, area, funding target, and revenue shares must match the AI-reviewed estimate.', 'FUNDING_ESTIMATE_MISMATCH');
            }
        }
        const project = await client.query(`INSERT INTO projects(public_id,name,location,site_type,owner_id,usable_area_m2,capacity_kw,funding_target,permission_status,notes,status,energy_share_json,revenue_share_json)
       VALUES($1,$2,$3,$4,$5,$6,round(($6::numeric / 7.5),3),$7,$8,$9,'review',$10,$11)
       RETURNING public_id AS id,name,location,site_type AS "siteType",usable_area_m2 AS area,capacity_kw AS capacity,funding_target AS target,permission_status AS permission,notes,status,agreement_version AS "agreementVersion"`, [publicId, input.name, input.location, input.siteType, request.user.id, input.area, input.target, input.permission, input.notes, JSON.stringify(input.energyShares), JSON.stringify(input.revenueShares)]);
        await client.query('INSERT INTO agreements(project_id,version,energy_share_json,revenue_share_json,created_by) SELECT id,1,$2,$3,$4 FROM projects WHERE public_id=$1', [publicId, JSON.stringify(input.energyShares), JSON.stringify(input.revenueShares), request.user.id]);
        await client.query('UPDATE solar_funding_estimates SET project_id=(SELECT id FROM projects WHERE public_id=$2) WHERE id=$1', [input.fundingEstimateId, publicId]);
        await writeAudit(client, request.user.id, 'project.created', 'project', publicId, { permission: input.permission, fundingEstimateId: input.fundingEstimateId ?? null });
        await writeNotification(client, request.user.id, `project:${publicId}:submitted`, 'Solar project submitted', `${publicId} · awaiting independent site review.`, 'Solar projects');
        const reviewers = await client.query(`SELECT id FROM users WHERE role IN ('verifier','admin') AND wallet_address IS NOT NULL AND demo_key IS NULL`);
        for (const reviewer of reviewers.rows) {
            await writeNotification(client, reviewer.id, `project:${publicId}:review-required`, 'Solar site awaiting review', `${publicId} · ${input.name}`, 'Solar projects');
        }
        return project.rows[0];
    });
    response.status(201).json({ data: { ...result, owner: request.user.displayName, raised: 0 } });
}));
api.post('/api/projects/:id/review', allowRoles('verifier', 'admin'), asyncRoute(async (request, response) => {
    const input = z.object({
        decision: z.enum(['approve', 'reject']),
        reason: z.string().trim().min(4).max(500).optional(),
    }).parse(request.body);
    if (input.decision === 'reject' && !input.reason) {
        throw new HttpError(400, 'A reason is required when rejecting a solar site.', 'REJECTION_REASON_REQUIRED');
    }
    const result = await transaction(async (client) => {
        const project = await client.query('SELECT id,public_id AS "publicId",owner_id AS "ownerId",name,status FROM projects WHERE public_id=$1 FOR UPDATE', [routeId(request)]);
        const row = project.rows[0];
        if (!row)
            throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND');
        if (row.ownerId === request.user.id)
            throw new HttpError(403, 'A project owner cannot review their own site.', 'SELF_REVIEW');
        if (row.status !== 'review')
            throw new HttpError(409, 'Only a project awaiting review can be approved or rejected.', 'INVALID_PROJECT_STATE');
        const status = input.decision === 'approve' ? 'funding' : 'rejected';
        await client.query('UPDATE projects SET status=$2 WHERE id=$1', [row.id, status]);
        await writeAudit(client, request.user.id, input.decision === 'approve' ? 'project.approved' : 'project.rejected', 'project', row.publicId, { reason: input.reason ?? null });
        await writeNotification(client, row.ownerId, `project:${row.publicId}:reviewed`, `Solar site ${status}`, `${row.publicId} · ${input.reason ?? 'Independent review completed.'}`, 'Solar projects');
        return { projectId: row.publicId, status };
    });
    response.json({ data: result });
}));
api.post('/api/projects/funding-estimates', asyncRoute(async (request, response) => {
    const consentToAi = request.body?.consentToAi === true;
    const input = solarFundingInputSchema.parse(request.body);
    const estimate = calculateSolarFunding(input);
    const review = consentToAi
        ? await reviewSolarFundingPlan(input, estimate)
        : {
            model: 'Not requested',
            analysis: {
                summary: 'AI review was not requested. Project assumptions are submitted for human review.',
                confidence: 'low',
                flags: [],
                suggestedChecks: ['Review site permission and user-entered cost assumptions.'],
                suggestedRevenueShares: input.revenueShares,
            },
        };
    const saved = await transaction(async (client) => {
        const inserted = await client.query(`INSERT INTO solar_funding_estimates(created_by,input,estimate,ai_model,ai_analysis)
       VALUES($1,$2,$3,$4,$5) RETURNING id`, [request.user.id, JSON.stringify(input), JSON.stringify(estimate), review.model, JSON.stringify(review.analysis)]);
        await writeAudit(client, request.user.id, 'project.funding_plan_reviewed', 'funding_estimate', inserted.rows[0].id, {
            aiModel: review.model,
            requiredFundingMinor: estimate.requiredFundingMinor,
        });
        return inserted.rows[0];
    });
    response.status(201).json({
        data: {
            id: saved.id,
            ...estimate,
            aiReview: { model: review.model, ...review.analysis },
        },
    });
}));
api.post('/api/projects/:id/contributions', asyncRoute(async (request, response) => {
    const input = z.object({ amount: z.number().positive().max(100_000_000), idempotencyKey: z.string().uuid() }).parse(request.body);
    const result = await transaction(async (client) => {
        const existing = await client.query('SELECT public_id AS id,amount,project_id AS "projectId",contributor_id AS "contributorId" FROM contributions WHERE idempotency_key=$1', [input.idempotencyKey]);
        if (existing.rows[0]) {
            if (existing.rows[0].contributorId !== request.user.id)
                throw new HttpError(409, 'This pledge request key has already been used.', 'IDEMPOTENCY_KEY_REUSED');
            return { id: existing.rows[0].id, amount: existing.rows[0].amount, projectId: existing.rows[0].projectId, duplicate: true };
        }
        const project = await client.query('SELECT id,owner_id AS "ownerId",funding_target AS target,status FROM projects WHERE public_id=$1 FOR UPDATE', [request.params.id]);
        const row = project.rows[0];
        if (!row)
            throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND');
        if (!['review', 'funding'].includes(row.status)) {
            throw new HttpError(409, 'This project is not accepting simulated interest in its current status.', 'PROJECT_NOT_ACCEPTING_INTEREST');
        }
        const raisedResult = await client.query("SELECT coalesce(sum(amount),0) AS raised FROM contributions WHERE project_id=$1 AND status IN ('simulated','confirmed','pledged')", [row.id]);
        const remaining = Number(row.target) - Number(raisedResult.rows[0].raised);
        if (input.amount > remaining)
            throw new HttpError(409, `Contribution exceeds the remaining target of ${remaining}.`, 'CONTRIBUTION_EXCEEDS_TARGET');
        const publicId = `CON-${randomUUID().slice(0, 8).toUpperCase()}`;
        const inserted = await client.query(`INSERT INTO contributions(public_id,project_id,contributor_id,amount,idempotency_key,status)
       VALUES($1,$2,$3,$4,$5,'pledged') RETURNING public_id AS id,amount,status`, [publicId, row.id, request.user.id, input.amount, input.idempotencyKey]);
        if (row.ownerId !== request.user.id) {
            await writeNotification(client, row.ownerId, `project:${publicId}:pledge`, 'New non-cash pledge', `${publicId} · ${input.amount.toFixed(2)} USD recorded without payment.`, 'Solar projects');
        }
        await writeAudit(client, request.user.id, 'project.pledge_recorded', 'project', routeId(request), { amount: input.amount, contributionId: publicId, noPayment: true });
        return { ...inserted.rows[0], duplicate: false };
    });
    response.status(result.duplicate ? 200 : 201).json({ data: { ...result, amount: Number(result.amount) } });
}));
api.post('/api/projects/:id/income-distributions', asyncRoute(async (request, response) => {
    const input = z.object({
        amountUsd: z.number().positive().max(100_000_000),
        source: z.string().trim().min(3).max(200),
        idempotencyKey: z.string().uuid(),
    }).parse(request.body);
    const amountMinor = Math.round(input.amountUsd * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        throw new HttpError(400, 'Enter a valid simulated income amount in USD.', 'INVALID_INCOME_AMOUNT');
    }
    const result = await transaction(async (client) => {
        const projectResult = await client.query(`SELECT p.id,p.name,u.display_name AS owner,p.status,p.revenue_share_json AS "revenueShares"
       FROM projects p JOIN users u ON u.id=p.owner_id
       WHERE p.public_id=$1 FOR UPDATE OF p`, [routeId(request)]);
        const project = projectResult.rows[0];
        if (!project)
            throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND');
        if (!['funding', 'operational'].includes(project.status)) {
            throw new HttpError(409, 'Simulated income can only be recorded for an approved, active project.', 'PROJECT_NOT_ACTIVE');
        }
        const prior = await client.query(`SELECT d.public_id AS id,d.project_id AS "projectId",d.amount_minor AS "amountMinor",d.source
       FROM project_income_distributions d WHERE d.idempotency_key=$1`, [input.idempotencyKey]);
        if (prior.rows[0]) {
            const priorRecord = prior.rows[0];
            if (priorRecord.projectId !== project.id || Number(priorRecord.amountMinor) !== amountMinor || priorRecord.source !== input.source) {
                throw new HttpError(409, 'This request key was already used for a different income record.', 'IDEMPOTENCY_KEY_REUSED');
            }
            return { id: priorRecord.id, duplicate: true };
        }
        const contributorResult = await client.query(`SELECT u.id,u.display_name AS name,round(sum(c.amount) * 100)::bigint AS "amountMinor"
       FROM contributions c JOIN users u ON u.id=c.contributor_id
       WHERE c.project_id=$1 AND c.status IN ('simulated','confirmed','pledged')
       GROUP BY u.id,u.display_name ORDER BY u.id`, [project.id]);
        const allocations = calculateSimulatedIncomeAllocations(amountMinor, project.revenueShares, project.owner, contributorResult.rows.map((investor) => ({
            id: investor.id,
            name: investor.name,
            amountMinor: Number(investor.amountMinor),
        })));
        const publicId = `INC-${randomUUID().slice(0, 8).toUpperCase()}`;
        await client.query(`INSERT INTO project_income_distributions(
        public_id,project_id,recorded_by,amount_minor,source,revenue_shares,allocations,idempotency_key
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [
            publicId, project.id, request.user.id, amountMinor, input.source,
            JSON.stringify(project.revenueShares), JSON.stringify(allocations), input.idempotencyKey,
        ]);
        await writeAudit(client, request.user.id, 'project.simulated_income_distributed', 'project', routeId(request), {
            distributionId: publicId,
            amountMinor,
            source: input.source,
            allocations,
            noPayment: true,
        });
        return { id: publicId, duplicate: false };
    });
    response.status(result.duplicate ? 200 : 201).json({ data: result });
}));
api.get('/api/projects/:id/settlement-preview', asyncRoute(async (request, response) => {
    const result = await query(`SELECT p.public_id AS id,p.agreement_version AS "agreementVersion",p.energy_share_json AS "energyShares",
      p.revenue_share_json AS "revenueShares",p.usable_area_m2 AS area,p.capacity_kw AS capacity
     FROM projects p WHERE p.public_id=$1`, [request.params.id]);
    if (!result.rowCount)
        throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND');
    const batches = await query(`SELECT coalesce(sum(generation_kwh) FILTER(WHERE status='approved'),0) AS "generationKwh"
     FROM generation_batches WHERE project_id=(SELECT id FROM projects WHERE public_id=$1)`, [request.params.id]);
    const project = result.rows[0];
    const eligibleKwh = Number(batches.rows[0]?.generationKwh ?? 0);
    const shares = project.energyShares;
    response.json({
        data: {
            projectId: project.id,
            agreementVersion: project.agreementVersion,
            eligibleGenerationKwh: eligibleKwh,
            energyShares: Object.fromEntries(Object.entries(shares).map(([name, percent]) => [name, { percent, kwh: Math.round(eligibleKwh * percent) / 100 }])),
            formula: 'eligible_generation_kwh × energy_share_percent ÷ 100',
            emissions: { status: 'demo_assumption', factorKgCo2ePerKwh: 0.68, source: 'Bright Ledger demo assumption; not a verified emissions factor', kgCo2e: Math.round(eligibleKwh * 0.68 * 100) / 100 },
        },
    });
}));
api.get('/api/rewards', asyncRoute(async (request, response) => {
    const result = await query(`SELECT r.points,r.policy_version AS "policyVersion",t.public_id AS "tradeId",t.quantity_kwh AS "eligibleKwh",r.created_at AS "createdAt"
     FROM rewards r JOIN trades t ON t.id=r.trade_id WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 100`, [request.user.id]);
    response.json({ data: result.rows });
}));
api.get('/api/audit', asyncRoute(async (request, response) => {
    const page = z.coerce.number().int().min(1).default(1).parse(request.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(30).parse(request.query.limit);
    const result = await query(`SELECT e.event_type AS "eventType",e.entity_type AS "entityType",e.entity_id AS "entityId",
      e.source,e.metadata,e.created_at AS "createdAt",u.display_name AS actor
     FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id
     WHERE e.actor_id=$3 OR $4
     ORDER BY e.created_at DESC LIMIT $1 OFFSET $2`, [limit, (page - 1) * limit, request.user.id, ['verifier', 'admin'].includes(request.user.role)]);
    response.json({ data: result.rows, page, limit });
}));
api.get('/api/matches', asyncRoute(async (request, response) => {
    const listingId = z.string().min(5).max(80).parse(request.query.listingId);
    const result = await query(`SELECT l.id,l.public_id AS "publicId",l.type,l.owner_id AS "ownerId",l.available_kwh AS available,
      l.price_per_kwh AS price,l.service_area AS area,l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd"
     FROM listings l JOIN users owner ON owner.id=l.owner_id
     WHERE l.public_id=$1 AND l.status='open' AND owner.wallet_address IS NOT NULL AND owner.demo_key IS NULL`, [listingId]);
    const selected = result.rows[0];
    if (!selected)
        throw new HttpError(404, 'Listing not found.', 'LISTING_NOT_FOUND');
    const counterparts = await query(`SELECT l.id,l.public_id AS "publicId",l.type,l.owner_id AS "ownerId",l.available_kwh AS available,
      l.price_per_kwh AS price,l.service_area AS area,l.delivery_start AS "deliveryStart",l.delivery_end AS "deliveryEnd",
      u.display_name AS owner
     FROM listings l JOIN users u ON u.id=l.owner_id
     WHERE l.status='open' AND u.wallet_address IS NOT NULL AND u.demo_key IS NULL
       AND l.type<>$1 AND l.id<>$2 AND l.owner_id<>$3
       AND lower(l.service_area)=lower($4)
       AND (($1='offer' AND l.price_per_kwh >= $5) OR ($1='request' AND l.price_per_kwh <= $5))
       AND l.delivery_start < $6 AND $7 < l.delivery_end
     ORDER BY l.price_per_kwh ASC LIMIT 100`, [selected.type, selected.id, request.user.id, selected.area, selected.price, selected.deliveryEnd, selected.deliveryStart]);
    const selectedListing = { id: selected.id, type: selected.type, quantityKwh: Number(selected.available), availableKwh: Number(selected.available), pricePerKwh: Number(selected.price), serviceArea: selected.area, deliveryStart: new Date(selected.deliveryStart), deliveryEnd: new Date(selected.deliveryEnd) };
    const matches = counterparts.rows.flatMap((item) => {
        const counterpart = { id: item.id, type: item.type, quantityKwh: Number(item.available), availableKwh: Number(item.available), pricePerKwh: Number(item.price), serviceArea: item.area, deliveryStart: new Date(item.deliveryStart), deliveryEnd: new Date(item.deliveryEnd) };
        const offer = selected.type === 'offer' ? selectedListing : counterpart;
        const buyRequest = selected.type === 'request' ? selectedListing : counterpart;
        const result = findCompatibleMatch(offer, buyRequest);
        return result ? [{ listingId: item.publicId, owner: item.owner, ...result }] : [];
    });
    response.json({ data: matches, policy: { id: 'bilateral-price-overlap-v1', description: 'A bilateral match requires the same service area, overlapping delivery windows, a compatible limit price, and available quantity. Indicative price is the midpoint.' } });
}));
api.use((_request, _response, next) => next(new HttpError(404, 'API endpoint not found.', 'NOT_FOUND')));
api.use(errorHandler);
export async function startServer() {
    const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
    return api.listen(port, '0.0.0.0', () => console.log(`Bright Ledger API listening on :${port}`));
}
async function writeAudit(client, actorId, eventType, entityType, entityId, metadata = {}) {
    await client.query('INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [actorId, eventType, entityType, entityId, JSON.stringify(metadata)]);
}
async function writeNotification(client, userId, eventKey, title, detail, page) {
    await client.query(`INSERT INTO notifications(user_id,event_key,title,detail,page)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,event_key) DO NOTHING`, [userId, eventKey, title, detail, page]);
}
function uiTradeStatus(status) {
    const labels = {
        awaiting_confirmation: 'Awaiting confirmation',
        awaiting_buyer_escrow: 'Awaiting buyer escrow',
        committed: 'Evidence needed',
        evidence_needed: 'Evidence needed',
        under_review: 'Under review',
        ready_to_settle: 'Ready to settle',
        disputed: 'Disputed',
        settled: 'Settled',
        refunded: 'Refunded',
        cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
}
function listingType(body) {
    const result = z.object({ listingId: z.string() }).parse(body);
    return result.listingId.startsWith('OFF-') ? 'offer' : 'request';
}
function listingParticipantName(party, user, type) {
    if (party === 'buyer')
        return type === 'offer' ? user.displayName : 'Listing owner';
    return type === 'offer' ? 'Listing owner' : user.displayName;
}
export { api };
