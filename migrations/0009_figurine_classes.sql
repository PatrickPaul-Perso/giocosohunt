-- Classes de figurines et instances physiques; conserve les scans existants.
INSERT OR IGNORE INTO campaigns (id, slug, title)
VALUES ('00000000-0000-4000-8000-000000000000', 'halloween-2026', 'Halloween 2026');

CREATE TABLE figurine_classes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  slug TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  image_key TEXT,
  UNIQUE(campaign_id, slug)
);
ALTER TABLE items ADD COLUMN class_id TEXT REFERENCES figurine_classes(id);
CREATE INDEX idx_items_class ON items(class_id);

INSERT INTO figurine_classes (id, campaign_id, slug, name_fr, name_en, image_key) SELECT 'halloween-2026:chat-fantome', id, 'chat-fantome', 'Chat fantôme', 'Ghost cat', 'chat_fantome.jpg' FROM campaigns WHERE slug = 'halloween-2026';
UPDATE items SET class_id = 'halloween-2026:chat-fantome' WHERE id = '00000000-0000-4000-8000-000000000001';
INSERT OR IGNORE INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '00000000-0000-4000-8000-000000000001', id, 'Chat fantôme', 'Chat fantôme', 'chat-fantome', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '0640ff57-8bf3-4452-bf96-c9731ea54088', id, 'Chat fantôme', 'Chat fantôme 2', 'chat-fantome-2', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT 'f3584ad9-cd6c-4dd6-b81f-b64782189c86', id, 'Chat fantôme', 'Chat fantôme 3', 'chat-fantome-3', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '94b91bc8-e14d-43a7-884c-781d2645e02f', id, 'Chat fantôme', 'Chat fantôme 4', 'chat-fantome-4', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '17bdb5ea-1f23-4932-be39-43da1ad56e2f', id, 'Chat fantôme', 'Chat fantôme 5', 'chat-fantome-5', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '213d7bdc-e769-4bc2-b1e8-e44ff2adda6b', id, 'Chat fantôme', 'Chat fantôme 6', 'chat-fantome-6', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';

INSERT INTO figurine_classes (id, campaign_id, slug, name_fr, name_en, image_key) SELECT 'halloween-2026:gnome-squelette', id, 'gnome-squelette', 'Gnome squelette', 'Skeleton gnome', 'gnome_squelette.jpg' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '5cca6aab-cf8b-4485-a1c6-0c9299ea7c0e', id, 'Gnome squelette', 'Gnome squelette 1', 'gnome-squelette-1', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '15232ddd-3956-4aea-affe-bd1d39ecae8f', id, 'Gnome squelette', 'Gnome squelette 2', 'gnome-squelette-2', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT 'b68e243e-2c29-4e48-8595-be9a36fc0361', id, 'Gnome squelette', 'Gnome squelette 3', 'gnome-squelette-3', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT 'a4574cfd-5958-47cc-913d-6b2e1bf621cf', id, 'Gnome squelette', 'Gnome squelette 4', 'gnome-squelette-4', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '8f1ebdf2-36da-4336-88f3-27af237cd4a6', id, 'Gnome squelette', 'Gnome squelette 5', 'gnome-squelette-5', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '0c793825-86fa-4128-bf6c-24cd157b1f8e', id, 'Gnome squelette', 'Gnome squelette 6', 'gnome-squelette-6', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
