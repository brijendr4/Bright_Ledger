ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_status_check;
ALTER TABLE contributions
  ADD CONSTRAINT contributions_status_check
  CHECK (status IN ('simulated', 'confirmed', 'cancelled', 'pledged'));

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  page TEXT NOT NULL CHECK (page IN ('Trades', 'Evidence', 'Solar projects', 'Activity')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS notifications_inbox_idx
  ON notifications(user_id, created_at DESC);
