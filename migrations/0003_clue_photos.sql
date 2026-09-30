-- Photo d'indice réduite, liée à une participation. Le GPS EXIF est facultatif et consenti séparément.
CREATE TABLE scan_response_photos (
  scan_event_id TEXT PRIMARY KEY REFERENCES scan_responses(scan_event_id) ON DELETE CASCADE,
  jpeg BLOB NOT NULL CHECK (length(jpeg) <= 300000),
  gps_consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
