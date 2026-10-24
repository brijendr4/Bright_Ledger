CREATE TABLE IF NOT EXISTS ai_evidence_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  submitter_id UUID NOT NULL REFERENCES users(id),
  file_sha256 CHAR(64) NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_kind TEXT NOT NULL CHECK (file_kind IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv')),
  model TEXT NOT NULL,
  analysis JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_evidence_reviews_trade_idx ON ai_evidence_reviews(trade_id, created_at DESC);

ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS evidence_reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_file_sha256 CHAR(64),
  ADD COLUMN IF NOT EXISTS ai_review_id UUID REFERENCES ai_evidence_reviews(id);

CREATE INDEX IF NOT EXISTS evidence_ai_review_idx ON evidence(ai_review_id) WHERE ai_review_id IS NOT NULL;
