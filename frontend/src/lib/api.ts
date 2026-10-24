const tokenKey = 'bright-ledger-access-token'
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>
      on?(event: 'chainChanged', listener: (chainId: unknown) => void): void
      removeListener?(event: 'chainChanged', listener: (chainId: unknown) => void): void
      on?(event: 'accountsChanged', listener: (accounts: unknown) => void): void
      removeListener?(event: 'accountsChanged', listener: (accounts: unknown) => void): void
    }
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function clearAccessToken() {
  sessionStorage.removeItem(tokenKey)
  localStorage.removeItem(tokenKey)
}

export function clearLegacyAccessToken() {
  localStorage.removeItem(tokenKey)
}

export function hasAccessToken() {
  return Boolean(sessionStorage.getItem(tokenKey))
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(tokenKey)
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('Bright Ledger API is unreachable. Start the API service and try again.', 0, 'API_UNAVAILABLE')
  }
  const body = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null
  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken()
      window.dispatchEvent(new Event('bright-ledger:unauthorized'))
    }
    throw new ApiError(body?.error?.message ?? `Request failed (${response.status}).`, response.status, body?.error?.code)
  }
  return body as T
}

export async function signInWallet(displayName: string, role: 'prosumer' | 'consumer' | 'both' | 'funder') {
  if (!window.ethereum) throw new ApiError('No injected EVM wallet was found. Install a compatible EVM wallet to continue.', 0, 'WALLET_NOT_FOUND')
  const { BrowserProvider, getAddress } = await import('ethers')
  const provider = new BrowserProvider(window.ethereum)
  const accounts = await provider.send('eth_requestAccounts', []) as string[]
  const address = getAddress(accounts[0] ?? '')
  const challenge = await request<{ nonce: string; message: string }>('/api/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ address, displayName, role }),
  })
  const signer = await provider.getSigner(address)
  const signature = await signer.signMessage(challenge.message)
  const result = await request<{ accessToken: string; user: { id: string; role: string; displayName: string; walletAddress: string | null } }>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address, nonce: challenge.nonce, signature, displayName, role }),
  })
  sessionStorage.setItem(tokenKey, result.accessToken)
  return result.user
}

export function revokeWalletSession() {
  return apiDelete<void>('/api/auth/session')
}

export async function removeWalletAccountWithSignature(expectedAddress: string) {
  if (!window.ethereum) throw new ApiError('Reconnect the wallet that owns this account to remove it.', 0, 'WALLET_NOT_FOUND')
  const { BrowserProvider, getAddress } = await import('ethers')
  const provider = new BrowserProvider(window.ethereum)
  const accounts = await provider.send('eth_accounts', []) as string[]
  const address = getAddress(accounts[0] ?? '')
  if (address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new ApiError('The connected wallet does not match this account. Switch back to the account wallet and retry.', 0, 'WALLET_ACCOUNT_MISMATCH')
  }
  const challenge = await request<{ nonce: string; message: string }>('/api/auth/account-removal-challenge', { method: 'POST' })
  const signer = await provider.getSigner(address)
  const signature = await signer.signMessage(challenge.message)
  return apiDelete<{ message: string }>('/api/me', { nonce: challenge.nonce, signature })
}

export function getCurrentUser() {
  return request<{ id: string; role: string; displayName: string; walletAddress: string }>('/api/me')
}

export function apiGet<T>(path: string) {
  return request<T>(path)
}

export function apiPost<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function apiUpload<T>(path: string, body: FormData) {
  return request<T>(path, { method: 'POST', body })
}

export async function apiGetBlob(path: string) {
  const token = sessionStorage.getItem(tokenKey)
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new ApiError('Bright Ledger API is unreachable. Start the API service and try again.', 0, 'API_UNAVAILABLE')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null
    if (response.status === 401) {
      clearAccessToken()
      window.dispatchEvent(new Event('bright-ledger:unauthorized'))
    }
    throw new ApiError(body?.error?.message ?? `Request failed (${response.status}).`, response.status, body?.error?.code)
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const fileName = disposition.match(/filename="([a-zA-Z0-9._-]{1,120})"/)?.[1] ?? 'evidence-file'
  return { blob: await response.blob(), fileName }
}

export function apiPatch<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function apiDelete<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'DELETE',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
