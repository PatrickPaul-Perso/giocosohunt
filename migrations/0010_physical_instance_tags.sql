-- UUID et surnoms des tags physiques fournis dans data/instances/*.csv.
-- Les instances provisoires avec historique sont conservées hors des classes physiques.
-- Les anciennes migrations restent inchangées, même si 0009 a déjà été appliquée.
-- Le Chat fantôme de démonstration reste accessible avec tous ses scans,
-- mais ne fait pas partie des six instances physiques de la classe.
UPDATE items SET class_id = NULL WHERE id = '00000000-0000-4000-8000-000000000001';

INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '94158f04-db1d-4d99-b4c7-079bff27739b', id, 'Chat fantôme', 'Pixel', 'chat-fantome-pixel', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '156c8f0e-caa8-4ac9-8240-954baf2dda56', id, 'Chat fantôme', 'Moustache', 'chat-fantome-moustache', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '9c58cfd6-69f9-4c65-a209-7da5e97f74c0', id, 'Chat fantôme', 'Simba', 'chat-fantome-simba', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '70d1fd93-7e8b-4afa-8873-ecf4defc290b', id, 'Chat fantôme', 'Sushi', 'chat-fantome-sushi', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT 'ffd52b09-710c-42b4-bb6c-9d80ad4b76f6', id, 'Chat fantôme', 'Mimine', 'chat-fantome-mimine', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '38625028-7b06-405c-a788-7608ba66adc1', id, 'Chat fantôme', 'Pacha', 'chat-fantome-pacha', 'halloween-2026:chat-fantome' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '57fc9183-3bbd-4fc5-bfb4-7b16967b4093', id, 'Gnome squelette', 'Gribouille', 'gnome-squelette-gribouille', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '9200e94c-8d52-4817-bbe1-2f6a6b34bd42', id, 'Gnome squelette', 'Pipou', 'gnome-squelette-pipou', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT 'c3c96d8a-a9f0-4c4e-9e8a-5fca44035d54', id, 'Gnome squelette', 'Fripon', 'gnome-squelette-fripon', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '1611efaa-cc12-44ed-b3c9-d92209568be2', id, 'Gnome squelette', 'Bricole', 'gnome-squelette-bricole', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '883b9d78-0d13-4378-bd0c-8da2105ce324', id, 'Gnome squelette', 'Turlututu', 'gnome-squelette-turlututu', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
INSERT INTO items (id, campaign_id, display_name, nickname, public_slug, class_id) SELECT '4830272f-07bb-4835-bb2e-96a69fba77b6', id, 'Gnome squelette', 'Chafouin', 'gnome-squelette-chafouin', 'halloween-2026:gnome-squelette' FROM campaigns WHERE slug = 'halloween-2026';
UPDATE items SET class_id = NULL WHERE id = '0640ff57-8bf3-4452-bf96-c9731ea54088';
DELETE FROM items WHERE id = '0640ff57-8bf3-4452-bf96-c9731ea54088' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = 'f3584ad9-cd6c-4dd6-b81f-b64782189c86';
DELETE FROM items WHERE id = 'f3584ad9-cd6c-4dd6-b81f-b64782189c86' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = '94b91bc8-e14d-43a7-884c-781d2645e02f';
DELETE FROM items WHERE id = '94b91bc8-e14d-43a7-884c-781d2645e02f' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = '17bdb5ea-1f23-4932-be39-43da1ad56e2f';
DELETE FROM items WHERE id = '17bdb5ea-1f23-4932-be39-43da1ad56e2f' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = '213d7bdc-e769-4bc2-b1e8-e44ff2adda6b';
DELETE FROM items WHERE id = '213d7bdc-e769-4bc2-b1e8-e44ff2adda6b' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = '5cca6aab-cf8b-4485-a1c6-0c9299ea7c0e';
DELETE FROM items WHERE id = '5cca6aab-cf8b-4485-a1c6-0c9299ea7c0e' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = '15232ddd-3956-4aea-affe-bd1d39ecae8f';
DELETE FROM items WHERE id = '15232ddd-3956-4aea-affe-bd1d39ecae8f' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = 'b68e243e-2c29-4e48-8595-be9a36fc0361';
DELETE FROM items WHERE id = 'b68e243e-2c29-4e48-8595-be9a36fc0361' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = 'a4574cfd-5958-47cc-913d-6b2e1bf621cf';
DELETE FROM items WHERE id = 'a4574cfd-5958-47cc-913d-6b2e1bf621cf' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = '8f1ebdf2-36da-4336-88f3-27af237cd4a6';
DELETE FROM items WHERE id = '8f1ebdf2-36da-4336-88f3-27af237cd4a6' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
UPDATE items SET class_id = NULL WHERE id = '0c793825-86fa-4128-bf6c-24cd157b1f8e';
DELETE FROM items WHERE id = '0c793825-86fa-4128-bf6c-24cd157b1f8e' AND NOT EXISTS (SELECT 1 FROM scan_events WHERE item_id = items.id);
