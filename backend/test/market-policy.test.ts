import { describe, expect, it } from 'vitest'
import { findCompatibleMatch, type MatchListing } from '../src/market-policy.js'

const offer: MatchListing = {
  id: 'offer',
  type: 'offer',
  quantityKwh: 12,
  availableKwh: 8,
  pricePerKwh: 5,
  serviceArea: ' Indiranagar ',
  deliveryStart: new Date('2026-01-01T10:00:00Z'),
  deliveryEnd: new Date('2026-01-01T12:00:00Z'),
}
const request: MatchListing = {
  id: 'request',
  type: 'request',
  quantityKwh: 10,
  availableKwh: 6,
  pricePerKwh: 7,
  serviceArea: 'indiranagar',
  deliveryStart: new Date('2026-01-01T11:00:00Z'),
  deliveryEnd: new Date('2026-01-01T13:00:00Z'),
}

describe('bilateral energy market policy', () => {
  it('matches available quantity at an indicative midpoint price', () => {
    expect(findCompatibleMatch(offer, request)).toEqual({
      matchedKwh: 6,
      indicativePricePerKwh: 6,
      serviceArea: ' Indiranagar ',
    })
  })

  it.each([
    ['different locations', { ...request, serviceArea: 'Whitefield' }],
    ['offer price over the request limit', { ...request, pricePerKwh: 4 }],
    ['non-overlapping delivery windows', { ...request, deliveryStart: new Date('2026-01-01T12:00:00Z') }],
    ['no available energy', { ...request, availableKwh: 0 }],
  ])('rejects a match with %s', (_reason, candidate) => {
    expect(findCompatibleMatch(offer, candidate as MatchListing)).toBeNull()
  })
})
