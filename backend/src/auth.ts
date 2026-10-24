import { createHash, randomBytes } from 'node:crypto'
import { getAddress, verifyMessage } from 'ethers'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { query, transaction } from './db.js'
import { asyncRoute, HttpError } from './errors.js'

export type UserRole = 'prosumer' | 'consumer' | 'both' | 'verifier' | 'admin' | 'funder' | 'space_owner'
export interface AuthUser { id: string; role: UserRole; displayName: string; walletAddress: string | null; demoKey: string | null; sessionId: string }
declare global {
  namespace Express {
    interface Request { user?: AuthUser; requestId?: string }
  }
}

const walletRoles = ['prosumer', 'consumer', 'both'] as const
const sessionMaximumAgeMs = 8 * 60 * 60 * 1000
const sessionIdleTimeout = '30 minutes'

async function issueSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    await client.query(
      "DELETE FROM auth_sessions WHERE expires_at <= now() OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')",
    )
    await client.query(
      `UPDATE auth_sessions SET revoked_at=now()
       WHERE id IN (
         SELECT id FROM auth_sessions
         WHERE user_id=$1 AND revoked_at IS NULL
         ORDER BY created_at DESC OFFSET 4
       )`,
      [userId],
    )
    await client.query(
      'INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)',
      [userId, tokenHash, new Date(Date.now() + sessionMaximumAgeMs)],
    )
  })
  return token
}

export const createWalletNonce = asyncRoute(async (request, response) => {
  const input = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    displayName: z.string().trim().min(2).max(80),
    role: z.enum(walletRoles),
  }).parse(request.body)
  const address = getAddress(input.address)
  const nonce = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60_000)
  const issuedAt = new Date(expiresAt.getTime() - 5 * 60_000)
  const uri = process.env.AUTH_URI ?? 'http://localhost:5173'
  const chainId = Number(process.env.CHAIN_ID ?? 31337)
  await query(
    `INSERT INTO auth_nonces(address, nonce, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT(address) DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at`,
    [address.toLowerCase(), nonce, expiresAt],
  )
  const domain = process.env.AUTH_DOMAIN ?? 'Bright Ledger'
  response.json({
    nonce,
    expiresAt: expiresAt.toISOString(),
    message: `${domain} account sign-in\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nAddress: ${address}\nName: ${input.displayName}\nRole: ${input.role}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`,
  })
})

export const verifyWalletSignature = asyncRoute(async (request, response) => {
  const input = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    nonce: z.string().min(32).max(128),
    signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
    displayName: z.string().trim().min(2).max(80),
    role: z.enum(walletRoles),
  }).parse(request.body)
  const address = getAddress(input.address)
  const nonceRow = await query<{ nonce: string; expiresAt: Date }>(
    'SELECT nonce, expires_at AS "expiresAt" FROM auth_nonces WHERE address = $1',
    [address.toLowerCase()],
  )
  const challenge = nonceRow.rows[0]
  if (!challenge || challenge.nonce !== input.nonce || challenge.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'The wallet sign-in challenge is missing, expired, or already used.', 'INVALID_NONCE')
  }
  const issuedAt = new Date(challenge.expiresAt.getTime() - 5 * 60_000)
  const uri = process.env.AUTH_URI ?? 'http://localhost:5173'
  const chainId = Number(process.env.CHAIN_ID ?? 31337)
  const message = `${process.env.AUTH_DOMAIN ?? 'Bright Ledger'} account sign-in\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nAddress: ${address}\nName: ${input.displayName}\nRole: ${input.role}\nNonce: ${challenge.nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${challenge.expiresAt.toISOString()}`
  let recoveredAddress: string
  try {
    recoveredAddress = getAddress(verifyMessage(message, input.signature))
  } catch {
    throw new HttpError(401, 'Wallet signature is invalid.', 'INVALID_SIGNATURE')
  }
  if (recoveredAddress !== address) {
    throw new HttpError(401, 'Wallet signature does not match the requested address.', 'INVALID_SIGNATURE')
  }
  const consumed = await query('DELETE FROM auth_nonces WHERE address = $1 AND nonce = $2 RETURNING address', [address.toLowerCase(), challenge.nonce])
  if (!consumed.rowCount) throw new HttpError(401, 'The wallet sign-in challenge has already been used.', 'INVALID_NONCE')
  const account = await query<AuthUser>(
    `INSERT INTO users(display_name, role, wallet_address)
     VALUES ($1, $2, $3)
     ON CONFLICT(wallet_address) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id, role, display_name AS "displayName", wallet_address AS "walletAddress", demo_key AS "demoKey"`,
    [input.displayName, input.role, address],
  )
  const user = account.rows[0]
  response.json({ accessToken: await issueSession(user.id), user: { id: user.id, role: user.role, displayName: user.displayName, walletAddress: user.walletAddress, demo: false } })
})

export const createAccountRemovalChallenge = asyncRoute(async (request, response) => {
  const user = request.user!
  if (!user.walletAddress || user.demoKey) {
    throw new HttpError(400, 'Only a wallet-backed account can be removed here.', 'WALLET_ACCOUNT_REQUIRED')
  }
  const nonce = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60_000)
  await query(
    `INSERT INTO auth_nonces(address, nonce, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT(address) DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at`,
    [user.walletAddress.toLowerCase(), nonce, expiresAt],
  )
  const domain = process.env.AUTH_DOMAIN ?? 'Bright Ledger'
  response.json({
    nonce,
    expiresAt: expiresAt.toISOString(),
    message: `${domain} account removal\nAddress: ${getAddress(user.walletAddress)}\nAccount: ${user.id}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}\nThis anonymizes your profile and retains marketplace audit records.`,
  })
})

export const removeWalletAccount = asyncRoute(async (request, response) => {
  const user = request.user!
  if (!user.walletAddress || user.demoKey) {
    throw new HttpError(400, 'Only a wallet-backed account can be removed here.', 'WALLET_ACCOUNT_REQUIRED')
  }
  const input = z.object({
    nonce: z.string().min(32).max(128),
    signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  }).parse(request.body)
  const address = getAddress(user.walletAddress)
  const nonceRow = await query<{ nonce: string; expiresAt: Date }>(
    'SELECT nonce, expires_at AS "expiresAt" FROM auth_nonces WHERE address = $1',
    [address.toLowerCase()],
  )
  const challenge = nonceRow.rows[0]
  if (!challenge || challenge.nonce !== input.nonce || challenge.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'The account removal challenge is missing, expired, or already used.', 'INVALID_NONCE')
  }
  const domain = process.env.AUTH_DOMAIN ?? 'Bright Ledger'
  const message = `${domain} account removal\nAddress: ${address}\nAccount: ${user.id}\nNonce: ${challenge.nonce}\nExpires: ${challenge.expiresAt.toISOString()}\nThis anonymizes your profile and retains marketplace audit records.`
  let recoveredAddress: string
  try {
    recoveredAddress = getAddress(verifyMessage(message, input.signature))
  } catch {
    throw new HttpError(401, 'Wallet account-removal signature is invalid.', 'INVALID_SIGNATURE')
  }
  if (recoveredAddress !== address) {
    throw new HttpError(401, 'Wallet account-removal signature does not match this account.', 'INVALID_SIGNATURE')
  }
  await transaction(async (client) => {
    const consumed = await client.query(
      'DELETE FROM auth_nonces WHERE address = $1 AND nonce = $2 RETURNING address',
      [address.toLowerCase(), challenge.nonce],
    )
    if (!consumed.rowCount) throw new HttpError(401, 'The account removal challenge has already been used.', 'INVALID_NONCE')
    await client.query(
      `UPDATE users SET display_name = 'Removed account', wallet_address = NULL, demo_key = NULL, demo_balance = 0
       WHERE id = $1`,
      [user.id],
    )
    await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [user.id])
    await client.query(
      `INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id,metadata)
       VALUES ($1,'account.removed','account',$2,$3)`,
      [user.id, user.id, JSON.stringify({ recordsRetained: true })],
    )
  })
  response.json({ message: 'Account profile removed. Existing marketplace records remain attributed to Removed account.' })
})

export const revokeCurrentSession = asyncRoute(async (request, response) => {
  await query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [request.user!.sessionId, request.user!.id])
  response.status(204).end()
})

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  try {
    const authorization = request.header('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(401, 'Connect and sign in with an EVM wallet to continue.', 'UNAUTHENTICATED')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const result = await query<AuthUser>(
      `UPDATE auth_sessions s SET last_seen_at=now()
       FROM users u
       WHERE s.user_id=u.id AND s.token_hash=$1 AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND s.last_seen_at > now() - interval '${sessionIdleTimeout}'
       RETURNING u.id,u.role,u.display_name AS "displayName",u.wallet_address AS "walletAddress",
         u.demo_key AS "demoKey",s.id AS "sessionId"`,
      [tokenHash],
    )
    if (!result.rowCount) throw new HttpError(401, 'Your wallet session expired or was signed out. Reconnect your wallet to continue.', 'SESSION_EXPIRED')
    request.user = result.rows[0]
    next()
  } catch (error) {
    next(error)
  }
}

export function allowRoles(...allowed: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const hasPermission = request.user && (
      allowed.includes(request.user.role) ||
      (request.user.role === 'both' && allowed.some((role) => role === 'consumer' || role === 'prosumer'))
    )
    if (!hasPermission) {
      next(new HttpError(403, `This action requires one of these roles: ${allowed.join(', ')}.`, 'FORBIDDEN'))
      return
    }
    next()
  }
}
