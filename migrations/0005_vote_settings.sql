-- Les votes historiques restent dans votes et model_proposals.
-- Les candidats existants sont consultés comme catalogue global; leur campaign_id
-- conserve la provenance de leur création.
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES
  ('active_campaign_id', '00000000-0000-4000-8000-000000000000'),
  ('contest_open', 'false'),
  ('theme_background', '#f8f5ef'),
  ('theme_text', '#24231f'),
  ('theme_accent', '#603b21'),
  ('headline_fr', 'La chasse d’Halloween 2026 se prépare.'),
  ('headline_en', 'The Halloween 2026 hunt is coming.');

CREATE TABLE vote_entries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  contact_consent_at TEXT NOT NULL,
  choice_type TEXT NOT NULL CHECK (choice_type IN ('candidate', 'proposal')),
  candidate_id TEXT REFERENCES model_candidates(id),
  proposed_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, email_normalized),
  CHECK (
    (choice_type = 'candidate' AND candidate_id IS NOT NULL AND proposed_name IS NULL)
    OR (choice_type = 'proposal' AND candidate_id IS NULL AND proposed_name IS NOT NULL)
  )
);

CREATE INDEX idx_vote_entries_campaign_choice ON vote_entries(campaign_id, choice_type, candidate_id);
