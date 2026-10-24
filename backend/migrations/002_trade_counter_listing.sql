ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS counter_listing_id UUID REFERENCES listings(id);
