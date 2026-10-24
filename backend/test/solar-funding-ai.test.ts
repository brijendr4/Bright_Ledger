import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../src/errors.js'
import { calculateSolarFunding, reviewSolarFundingPlan, solarFundingInputSchema } from '../src/solar-funding-ai.js'

const input = solarFundingInputSchema.parse({
  location: 'Sample City, Sample Country',
  siteType: 'Shared rooftop',
  usableAreaM2: 75,
  costs: {
    equipmentUsd: 10_000.99,
    installationUsd: 2_000,
    permittingUsd: 500,
    interconnectionUsd: 750,
    otherUsd: 250,
  },
  contingencyPercent: 10,
  revenueShares: { owner: 20, funder: 60, community: 20 },
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('solar funding plan', () => {
  it('calculates the requirement from user-entered costs and applies contingency in cents', () => {
    const estimate = calculateSolarFunding(input)

    expect(estimate.capacityKwp).toBe(10)
    expect(estimate.subtotalMinor).toBe(1_350_099)
    expect(estimate.contingencyMinor).toBe(135_010)
    expect(estimate.requiredFundingMinor).toBe(1_485_109)
    expect(estimate.requiredFundingUsd).toBe(14_851.09)
  })

  it('rejects revenue shares that do not add up to one hundred percent', () => {
    expect(() => solarFundingInputSchema.parse({
      ...input,
      revenueShares: { owner: 20, funder: 60, community: 10 },
    })).toThrow()
  })

  it('requires a configured provider key before making an AI request', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '')

    await expect(reviewSolarFundingPlan(input, calculateSolarFunding(input))).rejects.toMatchObject({
      status: 503,
      code: 'AI_REVIEW_UNAVAILABLE',
    } satisfies Partial<HttpError>)
  })

  it('accepts a bounded advisory response with an exact 100 percent split', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{
        message: {
          content: {
            summary: 'Check the interconnection quote before approving this budget.',
            confidence: 'medium',
            flags: ['Equipment cost needs a supplier quote.'],
            suggestedChecks: ['Confirm taxes and local permitting costs.'],
            suggestedRevenueShares: { owner: 20, funder: 60, community: 20 },
          },
        },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await reviewSolarFundingPlan(input, calculateSolarFunding(input))

    expect(result.analysis.suggestedRevenueShares).toEqual({ owner: 20, funder: 60, community: 20 })
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { messages: { content: string }[] }
    expect(requestBody.messages[1].content).toContain('calculatedFundingRequirementUsd')
    expect(requestBody.messages[1].content).not.toContain('private')
  })

  it('rejects model-generated allocations that do not total 100 percent', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'Advisory.',
            confidence: 'low',
            flags: [],
            suggestedChecks: [],
            suggestedRevenueShares: { owner: 10, funder: 20, community: 30 },
          }),
        },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    await expect(reviewSolarFundingPlan(input, calculateSolarFunding(input))).rejects.toMatchObject({
      status: 502,
      code: 'AI_RESPONSE_INVALID',
    })
  })
})
