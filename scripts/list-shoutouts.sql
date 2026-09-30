-- Utilisation par l'équipe pour les shoutouts manuels seulement.
SELECT social_platform, social_handle, MIN(created_at) AS first_submitted_at
FROM scan_responses
WHERE social_consent_at IS NOT NULL
GROUP BY social_platform, social_handle
ORDER BY first_submitted_at;
