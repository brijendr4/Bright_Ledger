ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_unique_idx
  ON users (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'wallet'
  CHECK (auth_method IN ('wallet', 'password'));
