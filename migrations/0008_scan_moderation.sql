-- Les réponses existantes et futures restent privées jusqu'à une validation explicite.
ALTER TABLE scan_responses ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE scan_responses ADD COLUMN moderated_at TEXT;
CREATE INDEX idx_scan_responses_moderation ON scan_responses(moderation_status, created_at DESC);
