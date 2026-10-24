ALTER TABLE users ALTER COLUMN demo_balance SET DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('prosumer', 'consumer', 'both', 'verifier', 'admin', 'funder', 'space_owner'));

UPDATE listings
SET price_per_kwh = CASE public_id
  WHEN 'OFF-2481' THEN 0.18
  WHEN 'OFF-2480' THEN 0.16
  WHEN 'OFF-2479' THEN 0.20
  WHEN 'REQ-1067' THEN 0.25
  WHEN 'REQ-1066' THEN 0.22
  ELSE price_per_kwh
END
WHERE public_id IN ('OFF-2481', 'OFF-2480', 'OFF-2479', 'REQ-1067', 'REQ-1066');

UPDATE trades
SET price_per_kwh = CASE public_id
  WHEN 'TRD-00842' THEN 0.17
  WHEN 'TRD-00841' THEN 0.16
  WHEN 'TRD-00839' THEN 0.18
  WHEN 'TRD-00835' THEN 0.17
  ELSE price_per_kwh
END
WHERE public_id IN ('TRD-00842', 'TRD-00841', 'TRD-00839', 'TRD-00835');

UPDATE projects
SET funding_target = CASE public_id
  WHEN 'PRJ-014' THEN 85000
  WHEN 'PRJ-012' THEN 62000
  WHEN 'PRJ-009' THEN 120000
  ELSE funding_target
END
WHERE public_id IN ('PRJ-014', 'PRJ-012', 'PRJ-009');

UPDATE contributions
SET amount = CASE public_id
  WHEN 'CON-0192' THEN 61200
  WHEN 'CON-0186' THEN 43400
  WHEN 'CON-0171' THEN 120000
  ELSE amount
END
WHERE public_id IN ('CON-0192', 'CON-0186', 'CON-0171');

UPDATE users SET demo_balance = 1000 WHERE demo_key = 'bright-ledger:demo-funder';
