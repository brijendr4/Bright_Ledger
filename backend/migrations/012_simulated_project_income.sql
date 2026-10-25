CREATE TABLE IF NOT EXISTS project_income_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id),
  recorded_by UUID NOT NULL REFERENCES users(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  source TEXT NOT NULL CHECK (char_length(source) BETWEEN 3 AND 200),
  revenue_shares JSONB NOT NULL,
  allocations JSONB NOT NULL,
  distribution_mode TEXT NOT NULL DEFAULT 'simulated' CHECK (distribution_mode = 'simulated'),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_income_distributions_project_idx
  ON project_income_distributions(project_id, created_at DESC);
