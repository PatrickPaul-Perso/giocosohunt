-- Position publique volontairement approximative. Les valeurs entières représentent
-- des milli-degrés après décalage aléatoire; aucun GPS exact n'est ajouté ici.
ALTER TABLE scan_responses ADD COLUMN map_lat_milli INTEGER
  CHECK (map_lat_milli BETWEEN -90000 AND 90000);
ALTER TABLE scan_responses ADD COLUMN map_lon_milli INTEGER
  CHECK (map_lon_milli BETWEEN -180000 AND 180000);
ALTER TABLE scan_responses ADD COLUMN map_location_source TEXT
  CHECK (map_location_source IN ('device', 'manual'));
ALTER TABLE scan_responses ADD COLUMN map_location_consent_at TEXT;
-- La nouvelle cachette est un second point facultatif, distinct du lieu du scan.
ALTER TABLE scan_responses ADD COLUMN rehide_lat_milli INTEGER
  CHECK (rehide_lat_milli BETWEEN -90000 AND 90000);
ALTER TABLE scan_responses ADD COLUMN rehide_lon_milli INTEGER
  CHECK (rehide_lon_milli BETWEEN -180000 AND 180000);
ALTER TABLE scan_responses ADD COLUMN rehide_location_source TEXT
  CHECK (rehide_location_source IN ('device', 'manual'));
ALTER TABLE scan_responses ADD COLUMN rehide_location_consent_at TEXT;
-- Les anciens indices ne sont pas publiés sans cette nouvelle autorisation.
ALTER TABLE scan_responses ADD COLUMN public_clue_consent_at TEXT;

-- Les photos de modèles restent des assets versionnés dans le dépôt.
ALTER TABLE model_candidates ADD COLUMN image_key TEXT;
ALTER TABLE model_candidates ADD COLUMN etsy_url TEXT;
