import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMarketBenchmark } from '../src/market-benchmark.js'

const originalApiKey = process.env.EIA_API_KEY

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.EIA_API_KEY
  else process.env.EIA_API_KEY = originalApiKey
  vi.unstubAllGlobals()
})

describe('EIA monthly price benchmark', () => {
  it('converts the published cents-per-kWh value into USD per kWh', async () => {
    process.env.EIA_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: { data: [{ period: '2026-05', price: '30.71' }] },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const benchmark = await getMarketBenchmark('NY')

    expect(benchmark).toMatchObject({
      state: 'NY',
      stateName: 'New York',
      priceUsdPerKwh: 0.3071,
      period: '2026-05',
      frequency: 'monthly',
      currency: 'USD',
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('facets%5Bstateid%5D%5B%5D=NY')
  })

  it('fails explicitly when no EIA key is configured', async () => {
    delete process.env.EIA_API_KEY
    await expect(getMarketBenchmark('CO')).rejects.toThrow('Configure EIA_API_KEY')
  })

  it('rejects an EIA response without a positive reported price', async () => {
    process.env.EIA_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: { data: [{ period: '2026-05', price: null }] },
    }), { status: 200 })))

    await expect(getMarketBenchmark('WA')).rejects.toThrow('no electricity price record')
  })
})
