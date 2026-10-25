import { createHash, randomBytes } from 'node:crypto'
import { getAddress, verifyMessage } from 'ethers'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { trustedRoleForWallet, walletRoles, type UserRole } from './wallet-role-policy.js'
import { query, transaction } from './db.js'
import { asyncRoute, HttpError } from './errors.js'
import { hashPassword, verifyPassword } from './password-credentials.js'

export interface AuthUser { id: string; role: UserRole; username: string | null; displayName: string; walletAddress: string | null; demoKey: string | null; sessionId: string; authMethod?: 'wallet' | 'password' }
declare global {
  namespace Express {
    interface Request { user?: AuthUser; requestId?: string }
  }
}

const sessionMaximumAgeMs = 8 * 60 * 60 * 1000
const sessionIdleTimeoutMinutes = 30
const maximumActiveSessions = 5

function walletSignInMessage(input: { address: string; displayName: string; role: (typeof walletRoles)[number]; nonce: string; expiresAt: Date }) {
  const issuedAt = new Date(input.expiresAt.getTime() - 5 * 60_000)
  return `${process.env.AUTH_DOMAIN ?? 'Bright Ledger'} account sign-in\nURI: ${process.env.AUTH_URI ?? 'http://localhost:5173'}\nVersion: 1\nChain ID: ${Number(process.env.CHAIN_ID ?? 31337)}\nAddress: ${input.address}\nName: ${input.displayName}\nRole: ${input.role}\nNonce: ${input.nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${input.expiresAt.toISOString()}`
}

async function issueSession(client: import('pg').PoolClient, userId: string, authMethod: 'wallet' | 'password') {
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await client.query(
    'DELETE FROM auth_sessions WHERE expires_at <= now() OR (revoked_at IS NOT NULL AND revoked_at < now() - interval \'7 days\')',
  )
  await client.query(
    `UPDATE auth_sessions SET revoked_at=now()
     WHERE id IN (
       SELECT id FROM auth_sessions
       WHERE user_id=$1 AND revoked_at IS NULL
       ORDER BY created_at DESC OFFSET $2
     )`,
    [userId, maximumActiveSessions - 1],
  )
  await client.query(
    'INSERT INTO auth_sessions(user_id,token_hash,expires_at,auth_method) VALUES($1,$2,$3,$4)',
    [userId, tokenHash, new Date(Date.now() + sessionMaximumAgeMs), authMethod],
  )
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
  await query(
    `INSERT INTO auth_nonces(address, nonce, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT(address) DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at`,
    [address.toLowerCase(), nonce, expiresAt],
  )
  response.json({
    nonce,
    expiresAt: expiresAt.toISOString(),
    message: walletSignInMessage({ ...input, address, nonce, expiresAt }),
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
  const message = walletSignInMessage({ ...input, address, nonce: challenge.nonce, expiresAt: challenge.expiresAt })
  let recoveredAddress: string
  try {
    recoveredAddress = getAddress(verifyMessage(message, input.signature))
  } catch {
    throw new HttpError(401, 'Wallet signature is invalid.', 'INVALID_SIGNATURE')
  }
  if (recoveredAddress !== address) {
    throw new HttpError(401, 'Wallet signature does not match the requested address.', 'INVALID_SIGNATURE')
  }
  const role = trustedRoleForWallet(address, input.role)
  const session = await transaction(async (client) => {
    const consumed = await client.query('DELETE FROM auth_nonces WHERE address=$1 AND nonce=$2 RETURNING address', [address.toLowerCase(), challenge.nonce])
    if (!consumed.rowCount) throw new HttpError(401, 'The wallet sign-in challenge has already been used.', 'INVALID_NONCE')
    const account = await client.query<Omit<AuthUser, 'sessionId'>>(
      `INSERT INTO users(display_name,role,wallet_address,demo_key)
       VALUES($1,$2,$3,NULL)
       ON CONFLICT(wallet_address) DO UPDATE SET
         display_name=EXCLUDED.display_name,role=EXCLUDED.role
       RETURNING id,role,username,display_name AS "displayName",wallet_address AS "walletAddress",demo_key AS "demoKey"`,
      [input.displayName, role, address],
    )
    const user = account.rows[0]
    const accessToken = await issueSession(client, user.id, 'wallet')
    return { accessToken, user }
  })
  response.json({
    accessToken: session.accessToken,
    user: {
      id: session.user.id,
      role: session.user.role,
      username: session.user.username,
      displayName: session.user.displayName,
      walletAddress: session.user.walletAddress,
    },
  })
})

const accountInput = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(12).max(128),
})
const publicAccount = (user: { id: string; role: UserRole; username: string | null; displayName: string; walletAddress: string | null }) => ({
  id: user.id,
  role: user.role,
  username: user.username,
  displayName: user.displayName,
  walletAddress: user.walletAddress,
})

export const registerPasswordAccount = asyncRoute(async (request, response) => {
  const input = accountInput.extend({
    displayName: z.string().trim().min(2).max(80),
    role: z.enum(walletRoles),
  }).parse(request.body)
  const username = input.username.toLowerCase()
  const passwordHash = await hashPassword(input.password)
  const result = await transaction(async (client) => {
    let account
    try {
      account = await client.query<Omit<AuthUser, 'sessionId'>>(
        `INSERT INTO users(username,password_hash,display_name,role,wallet_address,demo_key)
         VALUES($1,$2,$3,$4,NULL,NULL)
         RETURNING id,role,username,display_name AS "displayName",wallet_address AS "walletAddress",demo_key AS "demoKey"`,
        [username, passwordHash, input.displayName, input.role],
      )
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new HttpError(409, 'That username is already in use.', 'USERNAME_TAKEN')
      }
      throw error
    }
    const user = account.rows[0]
    const accessToken = await issueSession(client, user.id, 'password')
    return { user, accessToken }
  })
  response.status(201).json({ accessToken: result.accessToken, user: publicAccount(result.user) })
})

export const loginPasswordAccount = asyncRoute(async (request, response) => {
  const input = accountInput.parse(request.body)
  const result = await query<Omit<AuthUser, 'sessionId' | 'demoKey'> & { passwordHash: string | null }>(
    `SELECT id,role,username,display_name AS "displayName",wallet_address AS "walletAddress",password_hash AS "passwordHash"
     FROM users WHERE lower(username)=$1 AND demo_key IS NULL`,
    [input.username.toLowerCase()],
  )
  const user = result.rows[0]
  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new HttpError(401, 'Username or password is incorrect.', 'INVALID_CREDENTIALS')
  }
  const accessToken = await transaction((client) => issueSession(client, user.id, 'password'))
  response.json({ accessToken, user: publicAccount(user) })
})

export const createWalletLinkNonce = asyncRoute(async (request, response) => {
  const input = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).parse(request.body)
  const address = getAddress(input.address)
  const owner = await query<{ id: string }>('SELECT id FROM users WHERE wallet_address=$1', [address])
  if (owner.rows[0] && owner.rows[0].id !== request.user!.id) {
    throw new HttpError(409, 'This wallet is already linked to another account.', 'WALLET_ALREADY_LINKED')
  }
  const nonce = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60_000)
  await query(
    `INSERT INTO auth_nonces(address,nonce,expires_at) VALUES($1,$2,$3)
     ON CONFLICT(address) DO UPDATE SET nonce=EXCLUDED.nonce,expires_at=EXCLUDED.expires_at`,
    [address.toLowerCase(), nonce, expiresAt],
  )
  response.json({
    nonce,
    message: `${process.env.AUTH_DOMAIN ?? 'Bright Ledger'} wallet link\nURI: ${process.env.AUTH_URI ?? 'http://localhost:5173'}\nAddress: ${address}\nAccount: ${request.user!.id}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}\nPurpose: Link this EVM wallet to the signed-in Bright Ledger account.`,
  })
})

export const verifyWalletLink = asyncRoute(async (request, response) => {
  const input = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    nonce: z.string().min(32).max(128),
    signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  }).parse(request.body)
  const address = getAddress(input.address)
  const nonceResult = await query<{ nonce: string; expiresAt: Date }>(
    'SELECT nonce,expires_at AS "expiresAt" FROM auth_nonces WHERE address=$1',
    [address.toLowerCase()],
  )
  const challenge = nonceResult.rows[0]
  if (!challenge || challenge.nonce !== input.nonce || challenge.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'The wallet-link challenge is missing, expired, or already used.', 'INVALID_NONCE')
  }
  const message = `${process.env.AUTH_DOMAIN ?? 'Bright Ledger'} wallet link\nURI: ${process.env.AUTH_URI ?? 'http://localhost:5173'}\nAddress: ${address}\nAccount: ${request.user!.id}\nNonce: ${challenge.nonce}\nExpires: ${challenge.expiresAt.toISOString()}\nPurpose: Link this EVM wallet to the signed-in Bright Ledger account.`
  let recoveredAddress: string
  try {
    recoveredAddress = getAddress(verifyMessage(message, input.signature))
  } catch {
    throw new HttpError(401, 'Wallet-link signature is invalid.', 'INVALID_SIGNATURE')
  }
  if (recoveredAddress !== address) {
    throw new HttpError(401, 'Wallet-link signature does not match the requested wallet.', 'INVALID_SIGNATURE')
  }
  const result = await transaction(async (client) => {
    const consumed = await client.query(
      'DELETE FROM auth_nonces WHERE address=$1 AND nonce=$2 RETURNING address',
      [address.toLowerCase(), challenge.nonce],
    )
    if (!consumed.rowCount) throw new HttpError(401, 'The wallet-link challenge has already been used.', 'INVALID_NONCE')
    const account = await client.query<Omit<AuthUser, 'sessionId'>>(
      `UPDATE users SET wallet_address=$2
       WHERE id=$1 AND (wallet_address IS NULL OR wallet_address=$2)
       RETURNING id,role,username,display_name AS "displayName",wallet_address AS "walletAddress",demo_key AS "demoKey"`,
      [request.user!.id, address],
    )
    if (!account.rowCount) throw new HttpError(409, 'This account already has a different linked wallet.', 'ACCOUNT_WALLET_ALREADY_LINKED')
    return account.rows[0]
  }).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new HttpError(409, 'This wallet is already linked to another account.', 'WALLET_ALREADY_LINKED')
    }
    throw error
  })
  response.json({ user: publicAccount(result) })
})

export const revokeCurrentSession = asyncRoute(async (request, response) => {
  await query('UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [request.user!.sessionId, request.user!.id])
  response.status(204).end()
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

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  try {
    const authorization = request.header('authorization')
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,60})$/)?.[1]
    if (!token) throw new HttpError(401, 'Sign in to continue.', 'UNAUTHENTICATED')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const result = await query<AuthUser>(
      `UPDATE auth_sessions s SET last_seen_at=now()
       FROM users u
       WHERE s.user_id=u.id AND s.token_hash=$1 AND s.revoked_at IS NULL
         AND s.expires_at>now() AND s.last_seen_at>now()-($2::text || ' minutes')::interval
       RETURNING s.id AS "sessionId",u.id,u.role,u.username,s.auth_method AS "authMethod",u.display_name AS "displayName",
         u.wallet_address AS "walletAddress",u.demo_key AS "demoKey"`,
      [tokenHash, sessionIdleTimeoutMinutes],
    )
    if (!result.rowCount || result.rows[0].demoKey) {
      throw new HttpError(401, 'This account session has expired or been revoked. Sign in again.', 'INVALID_SESSION')
    }
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
