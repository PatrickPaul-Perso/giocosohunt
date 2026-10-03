-- Le tag de test représente désormais un Token, hors des classes de figurines.
-- Son UUID, son adresse publique et ses scans restent inchangés.
UPDATE items
SET display_name = 'Token', nickname = 'Token', class_id = NULL
WHERE id = '00000000-0000-4000-8000-000000000001';
