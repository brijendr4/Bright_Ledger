const eiaEndpoint = 'https://api.eia.gov/v2/electricity/retail-sales/data/';
const stateNames = {
    CA: 'California',
    CO: 'Colorado',
    NY: 'New York',
    TX: 'Texas',
    WA: 'Washington',
};
const cache = new Map();
const cacheMilliseconds = 60 * 60 * 1000;
export async function getMarketBenchmark(state) {
    const stateCode = state.toUpperCase();
    if (!stateNames[stateCode])
        throw new Error('Unsupported EIA state region.');
    const cached = cache.get(stateCode);
    if (cached && cached.expiresAt > Date.now())
        return cached.value;
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey)
        throw new Error('Configure EIA_API_KEY to load the official U.S. electricity price benchmark.');
    const url = new URL(eiaEndpoint);
    url.searchParams.set('frequency', 'monthly');
    url.searchParams.set('data[0]', 'price');
    url.searchParams.set('facets[stateid][]', stateCode);
    url.searchParams.set('sort[0][column]', 'period');
    url.searchParams.set('sort[0][direction]', 'desc');
    url.searchParams.set('length', '1');
    url.searchParams.set('api_key', apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok)
        throw new Error(`EIA price data returned HTTP ${response.status}.`);
    const body = await response.json();
    const row = body.response?.data?.[0];
    const centsPerKwh = Number(row?.price);
    if (!row?.period || !Number.isFinite(centsPerKwh) || centsPerKwh <= 0) {
        throw new Error(body.error || `EIA returned no electricity price record for ${stateCode}.`);
    }
    const value = {
        state: stateCode,
        stateName: stateNames[stateCode],
        priceUsdPerKwh: Number((centsPerKwh / 100).toFixed(4)),
        period: row.period,
        frequency: 'monthly',
        currency: 'USD',
        source: 'U.S. Energy Information Administration',
        sourceUrl: `https://www.eia.gov/electricity/data/state/`,
        retrievedAt: new Date().toISOString(),
    };
    cache.set(stateCode, { expiresAt: Date.now() + cacheMilliseconds, value });
    return value;
}
