-- Renomme uniquement la figurine de démonstration existante.
-- Idempotent : les scans et réponses liés à son UUID restent inchangés.
UPDATE items
SET display_name = 'Chat fantôme'
WHERE id = '00000000-0000-4000-8000-000000000001'
  AND display_name = 'Figurine de démonstration';
