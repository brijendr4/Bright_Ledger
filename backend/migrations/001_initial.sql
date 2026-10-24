CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('prosumer', 'consumer', 'both', 'verifier', 'admin', 'funder', 'space_owner')),
  wallet_address TEXT UNIQUE,
  demo_key TEXT UNIQUE,
  demo_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_nonces (
  address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('offer', 'request')),
  owner_id UUID NOT NULL REFERENCES users(id),
  quantity_kwh NUMERIC(14, 3) NOT NULL CHECK (quantity_kwh > 0),
  available_kwh NUMERIC(14, 3) NOT NULL CHECK (available_kwh >= 0),
  price_per_kwh NUMERIC(14, 4) NOT NULL CHECK (price_per_kwh > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  service_area TEXT NOT NULL,
  renewable_source TEXT NOT NULL,
  delivery_start TIMESTAMPTZ NOT NULL,
  delivery_end TIMESTAMPTZ NOT NULL CHECK (delivery_end > delivery_start),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'paused', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listings_market_idx ON listings(type, status, service_area, price_per_kwh, delivery_start);
CREATE INDEX IF NOT EXISTS listings_owner_created_idx ON listings(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  listing_id UUID NOT NULL REFERENCES listings(id),
  counter_listing_id UUID REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  quantity_kwh NUMERIC(14, 3) NOT NULL CHECK (quantity_kwh > 0),
  price_per_kwh NUMERIC(14, 4) NOT NULL CHECK (price_per_kwh > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  matching_policy TEXT NOT NULL DEFAULT 'bilateral-price-overlap-v1',
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation' CHECK (status IN ('awaiting_confirmation', 'committed', 'evidence_needed', 'under_review', 'ready_to_settle', 'disputed', 'settled', 'cancelled')),
  chain_id BIGINT,
  contract_address TEXT,
  chain_tx_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trades_buyer_created_idx ON trades(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trades_seller_created_idx ON trades(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trades_status_created_idx ON trades(status, created_at DESC);

CREATE TABLE IF NOT EXISTS trade_confirmations (
  trade_id UUID NOT NULL REFERENCES trades(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(trade_id, user_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  trade_id UUID NOT NULL REFERENCES trades(id),
  submitter_id UUID NOT NULL REFERENCES users(id),
  reviewer_id UUID REFERENCES users(id),
  quantity_kwh NUMERIC(14, 3) NOT NULL CHECK (quantity_kwh > 0),
  source TEXT NOT NULL,
  interval_start TIMESTAMPTZ NOT NULL,
  interval_end TIMESTAMPTZ NOT NULL CHECK (interval_end > interval_start),
  evidence_hash TEXT NOT NULL,
  chain_tx_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disputed')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS evidence_review_queue_idx ON evidence(status, created_at DESC);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  site_type TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  usable_area_m2 NUMERIC(14, 2) NOT NULL CHECK (usable_area_m2 >= 10),
  capacity_kw NUMERIC(14, 3) NOT NULL CHECK (capacity_kw > 0),
  funding_target NUMERIC(18, 2) NOT NULL CHECK (funding_target > 0),
  permission_status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'funding', 'operational', 'rejected', 'paused')),
  agreement_version INTEGER NOT NULL DEFAULT 1,
  energy_share_json JSONB NOT NULL DEFAULT '{"owner":20,"funder":60,"community":20}'::jsonb,
  revenue_share_json JSONB NOT NULL DEFAULT '{"owner":20,"funder":60,"community":20}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_status_location_idx ON projects(status, location);

CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id),
  contributor_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  status TEXT NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated', 'confirmed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contributions_project_idx ON contributions(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS generation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  submitter_id UUID NOT NULL REFERENCES users(id),
  generation_kwh NUMERIC(14, 3) NOT NULL CHECK (generation_kwh > 0),
  source TEXT NOT NULL,
  interval_start TIMESTAMPTZ NOT NULL,
  interval_end TIMESTAMPTZ NOT NULL CHECK (interval_end > interval_start),
  evidence_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disputed')),
  reviewer_id UUID REFERENCES users(id),
  agreement_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  version INTEGER NOT NULL,
  energy_share_json JSONB NOT NULL,
  revenue_share_json JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'application',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id),
  user_id UUID NOT NULL REFERENCES users(id),
  points INTEGER NOT NULL CHECK (points > 0),
  policy_version TEXT NOT NULL DEFAULT 'demo-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trade_id, user_id)
);
