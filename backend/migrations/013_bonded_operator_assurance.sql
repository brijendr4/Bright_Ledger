CREATE TABLE IF NOT EXISTS operator_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id),
  operator_id UUID NOT NULL REFERENCES users(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'ETH' CHECK (currency = 'ETH'),
  unlock_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','locked','slashed','released')),
  chain_id BIGINT,
  contract_address TEXT,
  post_tx_hash TEXT UNIQUE,
  release_tx_hash TEXT UNIQUE,
  slashed_minor BIGINT NOT NULL DEFAULT 0 CHECK (slashed_minor >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (slashed_minor <= amount_minor)
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','rejected')),
  evidence_hash TEXT,
  evidence_reference TEXT,
  submit_tx_hash TEXT UNIQUE,
  review_tx_hash TEXT UNIQUE,
  reviewer_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS project_milestones_project_idx ON project_milestones(project_id, sequence_no);
