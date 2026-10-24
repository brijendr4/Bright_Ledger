import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../src/errors.js'
import { inspectEvidenceFile, parseEvidenceAiReview, reviewEvidenceFile } from '../src/evidence-ai.js'

describe('AI evidence review input validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('accepts valid UTF-8 CSV and returns a stable SHA-256 digest', () => {
    const file = { originalname: 'meter.csv', mimetype: 'text/csv', buffer: Buffer.from('timestamp,kwh\n2026-01-01T00:00:00Z,1.25\n') }

    const result = inspectEvidenceFile(file)

    expect(result.kind).toBe('text/csv')
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects content whose file extension and signature do not agree', () => {
    const file = { originalname: 'meter.png', mimetype: 'image/png', buffer: Buffer.from('not a PNG') }

    expect(() => inspectEvidenceFile(file)).toThrowError(HttpError)
  })

  it('rejects binary data disguised as CSV', () => {
    const file = { originalname: 'meter.csv', mimetype: 'text/csv', buffer: Buffer.from([0x61, 0, 0x62]) }

    expect(() => inspectEvidenceFile(file)).toThrowError(HttpError)
  })

  it('accepts a constrained advisory response and rejects malformed model output', () => {
    const review = parseEvidenceAiReview('Review: {"summary":"The reading is legible.","confidence":"medium","flags":[],"suggestedChecks":["Compare with inverter portal"]}')

    expect(review.confidence).toBe('medium')
    expect(review.suggestedChecks).toHaveLength(1)
    expect(() => parseEvidenceAiReview('{"summary":"pass","confidence":"verified","flags":[],"suggestedChecks":[]}')).toThrowError(HttpError)
  })

  it('accepts structured JSON objects returned directly in provider content', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: {
            summary: 'The sample reading is readable.',
            confidence: 'medium',
            flags: [],
            suggestedChecks: ['Compare against an independent meter record.'],
          },
        },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const result = await reviewEvidenceFile(
      { originalname: 'sample.csv', buffer: Buffer.from('timestamp,kwh\n2026-01-01T00:00:00Z,1.2\n') },
      'text/csv',
      { tradeId: 'TRD-SAMPLE', quantityKwh: 1.2 },
    )

    expect(result.analysis.summary).toBe('The sample reading is readable.')
  })
})
