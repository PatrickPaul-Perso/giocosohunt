-- Plusieurs figurines réelles peuvent représenter un même modèle de leur campagne.
ALTER TABLE items ADD COLUMN model_candidate_id TEXT REFERENCES model_candidates(id);
CREATE INDEX idx_items_model_candidate ON items(model_candidate_id);

-- La seule figurine existante est une donnée fictive de démonstration.
UPDATE items SET model_candidate_id = '00000000-0000-4000-8000-000000000101'
WHERE id = '00000000-0000-4000-8000-000000000001';

-- Arrêter la migration si un autre item existant n'a pas été associé explicitement.
CREATE TABLE item_model_migration_check (missing_count INTEGER NOT NULL CHECK (missing_count = 0));
INSERT INTO item_model_migration_check (missing_count)
SELECT COUNT(*) FROM items i
WHERE i.model_candidate_id IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM model_candidates m
     WHERE m.id = i.model_candidate_id AND m.campaign_id = i.campaign_id
   );
DROP TABLE item_model_migration_check;

CREATE TRIGGER items_model_same_campaign_insert
BEFORE INSERT ON items
WHEN NEW.model_candidate_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM model_candidates
    WHERE id = NEW.model_candidate_id AND campaign_id = NEW.campaign_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Chaque figurine doit avoir un modèle de sa campagne');
END;

CREATE TRIGGER items_model_same_campaign_update
BEFORE UPDATE OF model_candidate_id, campaign_id ON items
WHEN NEW.model_candidate_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM model_candidates
    WHERE id = NEW.model_candidate_id AND campaign_id = NEW.campaign_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Chaque figurine doit avoir un modèle de sa campagne');
END;

CREATE TRIGGER model_candidates_campaign_update_with_items
BEFORE UPDATE OF campaign_id ON model_candidates
WHEN EXISTS (
  SELECT 1 FROM items
  WHERE model_candidate_id = OLD.id AND campaign_id != NEW.campaign_id
)
BEGIN
  SELECT RAISE(ABORT, 'Un modèle associé ne peut pas changer de campagne');
END;

-- Les vrais tags utilisent des UUID v4 générés par crypto.randomUUID().
-- L'identifiant fixe du démo est réservé aux essais et n'est pas un vrai tag.
CREATE TRIGGER items_uuid_v4_insert
BEFORE INSERT ON items
WHEN NEW.id IS NULL
  OR (NEW.id = '00000000-0000-4000-8000-000000000001'
    AND NEW.campaign_id != '00000000-0000-4000-8000-000000000000')
  OR (NEW.id != '00000000-0000-4000-8000-000000000001'
  AND (
    length(NEW.id) != 36
    OR substr(NEW.id, 9, 1) != '-'
    OR substr(NEW.id, 14, 1) != '-'
    OR substr(NEW.id, 19, 1) != '-'
    OR substr(NEW.id, 24, 1) != '-'
    OR length(replace(NEW.id, '-', '')) != 32
    OR lower(replace(NEW.id, '-', '')) GLOB '*[^0-9a-f]*'
    OR substr(lower(NEW.id), 15, 1) != '4'
    OR substr(lower(NEW.id), 20, 1) NOT GLOB '[89ab]'
  ))
BEGIN
  SELECT RAISE(ABORT, 'L’identifiant de la figurine doit être un UUID v4');
END;

CREATE TRIGGER items_id_immutable
BEFORE UPDATE OF id ON items
BEGIN
  SELECT RAISE(ABORT, 'L’identifiant d’une figurine ne peut pas changer');
END;
