CREATE TABLE IF NOT EXISTS evidence_files (
  evidence_id UUID PRIMARY KEY REFERENCES evidence(id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL CHECK (file_kind IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv')),
  file_extension TEXT NOT NULL CHECK (file_extension IN ('.jpg', '.jpeg', '.png', '.webp', '.pdf', '.csv')),
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  content BYTEA NOT NULL CHECK (octet_length(content) <= 8388608),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
