-- Les images des items sont indépendantes de la couverture de leur groupe.
ALTER TABLE items ADD COLUMN image_key TEXT;
ALTER TABLE items ADD COLUMN display_name_en TEXT;

UPDATE items
SET image_key = (SELECT f.image_key FROM figurine_classes f WHERE f.id = items.class_id),
    display_name_en = (SELECT f.name_en FROM figurine_classes f
      WHERE f.id = items.class_id AND f.name_fr = items.display_name)
WHERE class_id IS NOT NULL;
