-- Supprime uniquement les scans du Token dont la réponse est en attente.
-- Conserve les items, les votes, les propositions et les autres scans.
-- Sauvegarder la D1 visée avant exécution. Exécuter le fichier en entier.
PRAGMA defer_foreign_keys = ON;
UPDATE votes SET scan_event_id = NULL
WHERE scan_event_id IN (
  SELECT s.id FROM scan_events s JOIN scan_responses r ON r.scan_event_id = s.id
  WHERE s.item_id = '00000000-0000-4000-8000-000000000001' AND r.moderation_status = 'pending'
);
UPDATE model_proposals SET scan_event_id = NULL
WHERE scan_event_id IN (
  SELECT s.id FROM scan_events s JOIN scan_responses r ON r.scan_event_id = s.id
  WHERE s.item_id = '00000000-0000-4000-8000-000000000001' AND r.moderation_status = 'pending'
);
DELETE FROM scan_response_photos
WHERE scan_event_id IN (
  SELECT s.id FROM scan_events s JOIN scan_responses r ON r.scan_event_id = s.id
  WHERE s.item_id = '00000000-0000-4000-8000-000000000001' AND r.moderation_status = 'pending'
);
-- Les contraintes sont différées jusqu'à la suppression des réponses ci-dessous.
DELETE FROM scan_events
WHERE item_id = '00000000-0000-4000-8000-000000000001'
  AND id IN (SELECT scan_event_id FROM scan_responses WHERE moderation_status = 'pending');
DELETE FROM scan_responses
WHERE moderation_status = 'pending'
  AND NOT EXISTS (SELECT 1 FROM scan_events s WHERE s.id = scan_responses.scan_event_id);
PRAGMA defer_foreign_keys = OFF;
