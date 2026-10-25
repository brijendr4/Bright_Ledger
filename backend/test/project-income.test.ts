import { describe, expect, it } from 'vitest'
import { calculateSimulatedIncomeAllocations } from '../src/project-income.js'

describe('simulated project income allocations', () => {
  it('splits income by the project agreement and investor contribution weights', () => {
    const allocations = calculateSimulatedIncomeAllocations(
      10_001,
      { owner: 20, funder: 60, community: 20 },
      'Project Owner',
      [
        { id: 'investor-a', name: 'Investor A', amountMinor: 10_000 },
        { id: 'investor-b', name: 'Investor B', amountMinor: 5_000 },
      ],
    )

    expect(allocations).toEqual([
      { recipient: 'Project Owner', type: 'owner', amountMinor: 2_000 },
      { recipient: 'Investor A', type: 'investor', amountMinor: 4_001 },
      { recipient: 'Investor B', type: 'investor', amountMinor: 2_000 },
      { recipient: 'Community allocation', type: 'community', amountMinor: 2_000 },
    ])
    expect(allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0)).toBe(10_001)
  })

  it('keeps the investor allocation visible but unassigned when there are no investor records', () => {
    const allocations = calculateSimulatedIncomeAllocations(
      10_000,
      { owner: 20, funder: 60, community: 20 },
      'Project Owner',
      [],
    )

    expect(allocations).toContainEqual({
      recipient: 'Investor pool (unallocated)',
      type: 'investor',
      amountMinor: 6_000,
    })
  })

  it('rejects invalid revenue shares and non-positive income', () => {
    expect(() => calculateSimulatedIncomeAllocations(100, { owner: 20, funder: 60, community: 10 }, 'Owner', [])).toThrow()
    expect(() => calculateSimulatedIncomeAllocations(0, { owner: 20, funder: 60, community: 20 }, 'Owner', [])).toThrow()
  })
})
