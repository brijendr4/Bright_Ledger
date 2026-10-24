import { describe, expect, it } from 'vitest'
import { trustedRoleForWallet, walletRoles } from '../src/wallet-role-policy.js'

const address = '0x1234567890abcdef1234567890abcdef12345678'

describe('wallet role policy', () => {
  it('does not expose privileged roles as self-service sign-in choices', () => {
    expect(walletRoles).toEqual(['prosumer', 'consumer', 'both', 'funder'])
  })

  it('grants energy-host access only to operator allowlisted wallets', () => {
    expect(trustedRoleForWallet(address, 'funder', {
      ADMIN_WALLET_ADDRESSES: '',
      VERIFIER_WALLET_ADDRESSES: '',
      SPACE_OWNER_WALLET_ADDRESSES: ` ${address.toUpperCase()}, 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
    })).toBe('space_owner')
    expect(trustedRoleForWallet(address, 'funder', {
      ADMIN_WALLET_ADDRESSES: '',
      VERIFIER_WALLET_ADDRESSES: '',
      SPACE_OWNER_WALLET_ADDRESSES: '',
    })).toBe('funder')
  })

  it('keeps admin and verifier assignment operator-controlled with admin precedence', () => {
    const environment = {
      ADMIN_WALLET_ADDRESSES: address,
      VERIFIER_WALLET_ADDRESSES: address,
      SPACE_OWNER_WALLET_ADDRESSES: address,
    }
    expect(trustedRoleForWallet(address, 'consumer', environment)).toBe('admin')
    expect(trustedRoleForWallet('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'consumer', environment)).toBe('consumer')
  })
})
