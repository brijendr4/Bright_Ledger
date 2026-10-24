CREATE TABLE IF NOT EXISTS solar_funding_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  input JSONB NOT NULL,
  estimate JSONB NOT NULL,
  ai_model TEXT NOT NULL,
  ai_analysis JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solar_funding_estimates_owner_created_idx
  ON solar_funding_estimates(created_by, created_at DESC);
