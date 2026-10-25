import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/password-credentials.js'

describe('password credential hashing', () => {
  it('verifies the original password without storing it in the encoded hash', async () => {
    const password = 'correct horse battery staple'
    const encoded = await hashPassword(password)
    expect(encoded).not.toContain(password)
    expect(await verifyPassword(password, encoded)).toBe(true)
    expect(await verifyPassword('incorrect password', encoded)).toBe(false)
  })

  it('rejects malformed password hashes', async () => {
    expect(await verifyPassword('any password', 'plaintext')).toBe(false)
  })
})
