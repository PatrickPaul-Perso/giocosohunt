-- Distingue le GPS EXIF de la position actuelle obtenue avec un consentement séparé.
ALTER TABLE scan_response_photos ADD COLUMN location_source TEXT CHECK (location_source IN ('photo', 'device'));
ALTER TABLE scan_response_photos ADD COLUMN device_location_consent_at TEXT;
UPDATE scan_response_photos SET location_source = 'photo' WHERE gps_consent_at IS NOT NULL;
