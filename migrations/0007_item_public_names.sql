-- Chaque instance peut avoir un nom public et une adresse lisible sans exposer son UUID.
ALTER TABLE items ADD COLUMN nickname TEXT;
ALTER TABLE items ADD COLUMN public_slug TEXT;
CREATE UNIQUE INDEX idx_items_nickname_unique ON items(nickname COLLATE NOCASE);
CREATE UNIQUE INDEX idx_items_public_slug_unique ON items(public_slug);

-- La figurine existante garde son UUID et tous ses scans.
UPDATE items SET nickname = 'Chat fantôme', public_slug = 'chat-fantome'
WHERE id = '00000000-0000-4000-8000-000000000001';
