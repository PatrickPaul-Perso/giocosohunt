# Giocoso Hunt

- Worker Cloudflare : `giocosohunt`
- Base de données D1 : `giocosohunt-db`
- Domaine de production : `giocosohunt.forgenord.ca`
- Première campagne : `/halloween-2026`
- Route des figurines : `/halloween-2026/t/<uuid>`

- Ne pas modifier `wrangler.jsonc`, les bindings D1 ou les migrations sans validation.
- Ne jamais stocker de localisation exacte, sauf les coordonnées GPS EXIF d’une photo d’indice avec consentement distinct, ou la position actuelle du navigateur si aucun GPS EXIF n’est utilisé et si la personne a donné un consentement distinct à cette position. La source doit être enregistrée. Ces coordonnées restent privées. Ne jamais stocker d’adresse IP ou de données personnelles non nécessaires.
- Le courriel et le handle social sont facultatifs et exigent des consentements distincts.
- Utiliser une branche et une pull request pour les changements visuels importants.
- Vérifier le build avant de proposer une pull request.
