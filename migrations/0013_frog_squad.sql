-- Groupe thématique et tags physiques fournis dans data/instances/grenouilles-halloween.csv.
INSERT INTO figurine_classes (id, campaign_id, slug, name_fr, name_en, image_key)
SELECT 'halloween-2026:grenouille-halloween', id, 'grenouille-halloween',
  'L’Escouade grenouille', 'The Frog Squad', 'escouade_grenouilles.png'
FROM campaigns WHERE slug = 'halloween-2026';

INSERT INTO items (id, campaign_id, class_id, display_name, display_name_en, nickname, public_slug, image_key)
SELECT '39ec7d8d-ce18-458a-8847-37eab6c71a32', id, 'halloween-2026:grenouille-halloween', 'Grenouille citrouille', 'Pumpkin frog', 'Nox', 'grenouille-halloween-nox', 'nox.png'
FROM campaigns WHERE slug = 'halloween-2026';

INSERT INTO items (id, campaign_id, class_id, display_name, display_name_en, nickname, public_slug, image_key)
SELECT '38feec84-b1fc-461e-a8f2-55f2917f98ec', id, 'halloween-2026:grenouille-halloween', 'Grenouille vampire', 'Vampire frog', 'Draco', 'grenouille-halloween-draco', 'draco.png'
FROM campaigns WHERE slug = 'halloween-2026';

INSERT INTO items (id, campaign_id, class_id, display_name, display_name_en, nickname, public_slug, image_key)
SELECT '7943659e-3b00-427e-8893-5977d5f0719e', id, 'halloween-2026:grenouille-halloween', 'Grenouille fantôme', 'Ghost frog', 'Boo', 'grenouille-halloween-boo', 'boo.png'
FROM campaigns WHERE slug = 'halloween-2026';

INSERT INTO items (id, campaign_id, class_id, display_name, display_name_en, nickname, public_slug, image_key)
SELECT '98871879-f5ac-407e-95d1-4a9b7de15a93', id, 'halloween-2026:grenouille-halloween', 'Grenouille sorcière', 'Witch frog', 'Luna', 'grenouille-halloween-luna', 'luna.png'
FROM campaigns WHERE slug = 'halloween-2026';

INSERT INTO items (id, campaign_id, class_id, display_name, display_name_en, nickname, public_slug, image_key)
SELECT 'be85dc5c-b8d1-43c2-9d93-fa4119a479bd', id, 'halloween-2026:grenouille-halloween', 'Grenouille chauve-souris', 'Bat frog', 'Echo', 'grenouille-halloween-echo', 'echo.png'
FROM campaigns WHERE slug = 'halloween-2026';
