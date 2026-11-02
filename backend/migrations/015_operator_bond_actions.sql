CREATE TABLE IF NOT EXISTS operator_bond_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bond_id UUID NOT NULL REFERENCES operator_bonds(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('slash','release')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  reason TEXT,
  transaction_hash TEXT NOT NULL UNIQUE,
  actor_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_bond_actions_bond_idx
  ON operator_bond_actions(bond_id, created_at DESC);
