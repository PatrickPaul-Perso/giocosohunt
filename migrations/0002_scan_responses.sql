-- Réponse facultative à un scan. Les contacts sont enregistrés seulement avec des consentements distincts.
CREATE TABLE scan_responses (
  scan_event_id TEXT PRIMARY KEY REFERENCES scan_events(id),
  disposition TEXT NOT NULL CHECK (disposition IN ('keep', 'rehide')),
  social_platform TEXT CHECK (social_platform IN ('tiktok', 'facebook', 'instagram')),
  social_handle TEXT,
  social_consent_at TEXT,
  email TEXT,
  email_consent_at TEXT,
  clue_text TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (social_platform IS NULL AND social_handle IS NULL AND social_consent_at IS NULL)
    OR (social_platform IS NOT NULL AND social_handle IS NOT NULL AND social_consent_at IS NOT NULL)
  ),
  CHECK (
    (email IS NULL AND email_consent_at IS NULL)
    OR (email IS NOT NULL AND email_consent_at IS NOT NULL)
  ),
  CHECK (disposition = 'rehide' OR clue_text IS NULL)
);

ALTER TABLE votes ADD COLUMN scan_event_id TEXT REFERENCES scan_events(id);
CREATE UNIQUE INDEX idx_votes_scan_event ON votes(scan_event_id) WHERE scan_event_id IS NOT NULL;

ALTER TABLE model_proposals ADD COLUMN scan_event_id TEXT REFERENCES scan_events(id);
CREATE UNIQUE INDEX idx_model_proposals_scan_event ON model_proposals(scan_event_id) WHERE scan_event_id IS NOT NULL;
