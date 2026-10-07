-- Nettoyage ponctuel : conserve tous les scans du Token de test.
-- Conserve les items, les votes et les propositions.
-- Vérifier les comptes et sauvegarder la D1 visée avant exécution.
UPDATE votes SET scan_event_id = NULL
WHERE scan_event_id IN (SELECT id FROM scan_events WHERE item_id <> '00000000-0000-4000-8000-000000000001');
UPDATE model_proposals SET scan_event_id = NULL
WHERE scan_event_id IN (SELECT id FROM scan_events WHERE item_id <> '00000000-0000-4000-8000-000000000001');
DELETE FROM scan_response_photos
WHERE scan_event_id IN (SELECT id FROM scan_events WHERE item_id <> '00000000-0000-4000-8000-000000000001');
DELETE FROM scan_responses
WHERE scan_event_id IN (SELECT id FROM scan_events WHERE item_id <> '00000000-0000-4000-8000-000000000001');
DELETE FROM scan_events
WHERE item_id <> '00000000-0000-4000-8000-000000000001';
