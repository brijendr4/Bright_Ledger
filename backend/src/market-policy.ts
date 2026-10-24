export interface MatchListing {
  id: string
  type: 'offer' | 'request'
  quantityKwh: number
  availableKwh: number
  pricePerKwh: number
  serviceArea: string
  deliveryStart: Date
  deliveryEnd: Date
}

export interface MarketCandidate {
  matchedKwh: number
  indicativePricePerKwh: number
  serviceArea: string
}

export function findCompatibleMatch(offer: MatchListing, request: MatchListing): MarketCandidate | null {
  if (offer.type !== 'offer' || request.type !== 'request') return null
  const matchedKwh = Math.min(offer.availableKwh, request.availableKwh)
  if (matchedKwh <= 0 || offer.serviceArea.trim().toLowerCase() !== request.serviceArea.trim().toLowerCase()) return null
  if (offer.pricePerKwh > request.pricePerKwh) return null
  if (offer.deliveryStart >= request.deliveryEnd || request.deliveryStart >= offer.deliveryEnd) return null
  return {
    matchedKwh,
    indicativePricePerKwh: Math.round(((offer.pricePerKwh + request.pricePerKwh) / 2) * 100) / 100,
    serviceArea: offer.serviceArea,
  }
}
