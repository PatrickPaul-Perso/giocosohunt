-- Suivi privé des shoutouts et signalement administratif des figurines perdues.
ALTER TABLE scan_responses ADD COLUMN shoutout_at TEXT;
ALTER TABLE items ADD COLUMN missing_at TEXT;
ALTER TABLE items ADD COLUMN missing_after_scan_id TEXT;
-- Une réponse reçue après le signalement lève celui-ci, même si le tag avait
-- été ouvert auparavant. L'insertion et la levée sont atomiques.
CREATE TRIGGER clear_missing_after_response AFTER INSERT ON scan_responses
BEGIN
  UPDATE items SET missing_at = NULL, missing_after_scan_id = NULL
  WHERE id = (SELECT item_id FROM scan_events WHERE id = NEW.scan_event_id);
END;
