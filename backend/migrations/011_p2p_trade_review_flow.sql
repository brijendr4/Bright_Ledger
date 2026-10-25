ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_status_check;
ALTER TABLE trades
  ADD CONSTRAINT trades_status_check
  CHECK (status IN (
    'awaiting_confirmation',
    'awaiting_buyer_escrow',
    'committed',
    'evidence_needed',
    'under_review',
    'ready_to_settle',
    'disputed',
    'settled',
    'refunded',
    'cancelled'
  ));
