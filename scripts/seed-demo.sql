-- Données de démonstration uniquement; aucune donnée personnelle ou localisation.
INSERT OR IGNORE INTO campaigns (id, slug, title)
VALUES ('00000000-0000-4000-8000-000000000000', 'halloween-2026', 'Halloween 2026');

INSERT OR IGNORE INTO items (id, campaign_id, display_name)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000000',
  'Chat fantôme'
);
