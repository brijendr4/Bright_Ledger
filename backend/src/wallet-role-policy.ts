export const walletRoles = ['prosumer', 'consumer', 'both', 'funder'] as const
export type WalletRole = (typeof walletRoles)[number]
export type UserRole = WalletRole | 'verifier' | 'admin' | 'space_owner'

type RoleEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'ADMIN_WALLET_ADDRESSES' | 'VERIFIER_WALLET_ADDRESSES' | 'SPACE_OWNER_WALLET_ADDRESSES'>>

function configuredWallets(value: string | undefined) {
  return new Set((value ?? '').split(',').map((address) => address.trim().toLowerCase()).filter(Boolean))
}

export function trustedRoleForWallet(address: string, requestedRole: WalletRole, environment: RoleEnvironment = process.env): UserRole {
  const normalizedAddress = address.toLowerCase()
  if (configuredWallets(environment.ADMIN_WALLET_ADDRESSES).has(normalizedAddress)) return 'admin'
  if (configuredWallets(environment.VERIFIER_WALLET_ADDRESSES).has(normalizedAddress)) return 'verifier'
  if (configuredWallets(environment.SPACE_OWNER_WALLET_ADDRESSES).has(normalizedAddress)) return 'space_owner'
  return requestedRole
}
