# Giocoso Hunt

Application Astro SSR sur Cloudflare Workers avec D1. La campagne initiale est `/halloween-2026`; Chat fantôme est accessible à `/halloween-2026/t/00000000-0000-4000-8000-000000000001`. Les figurines physiques cachées dans la région d’Ottawa–Gatineau sont des lignes de `items`. Les modèles Giocoso Création proposés au vote forment un catalogue global distinct.

## Démarrer avec Docker Compose

L’image Node 24 et le verrouillage npm sont fixés dans le dépôt. Docker suffit sur l’hôte.

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npm ci
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 migrations apply giocosohunt-db --local
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 execute giocosohunt-db --local --file=./scripts/seed-demo.sql
LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)" docker compose up -d app admin
```

Ouvrir <http://localhost:4321/halloween-2026>, <http://localhost:4321/vote> et la gestion locale à <http://127.0.0.1:8788>. `docker compose down` arrête les deux services. La D1 locale persiste dans `.wrangler/state` et ne requiert aucune authentification Cloudflare. Le Dev Container Node 24 peut utiliser les mêmes commandes npm et Wrangler.

La page de campagne présente les figurines de `items` sous forme de cartes, sans lien vers leurs fiches de scan. Déposer la photo de la première figurine dans `src/assets/items/chat_fantome.jpg`; Astro inclut la photo dans le build; la carte et la fiche de scan affichent l’image entière sans la rogner. Sans le fichier, une carte provisoire s’affiche. Pour une D1 déjà peuplée avec l’ancien nom, exécuter `scripts/name-chat-fantome.sql` sur la cible voulue :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 execute giocosohunt-db --local --file=./scripts/name-chat-fantome.sql
# Après fusion et avec les variables Cloudflare chargées :
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 execute giocosohunt-db --remote --file=./scripts/name-chat-fantome.sql
```

Le UUID de la figurine et ses scans existants sont conservés. La photo requiert un nouveau build et déploiement pour apparaître en production.

La fiche de Chat fantôme simule un scan à chaque ouverture. Sa réponse enregistre la décision de garder ou recacher la figurine et les contacts facultatifs avec consentements distincts. Avec un consentement public distinct, un indice texte et une photo peuvent apparaître dans le journal des scans. La photo d’indice est réduite côté navigateur, puis stockée dans D1; la route publique retire toujours ses métadonnées EXIF. Le GPS EXIF ou la position actuelle ajoutée à cette photo restent privés et exigent leur propre consentement.

Deux cartes facultatives distinguent le lieu du scan de la nouvelle cachette prévue. Chaque point exige un consentement public séparé. Le navigateur arrondit la position choisie à trois décimales, puis le serveur ajoute un décalage aléatoire une seule fois avant de conserver le point final, toujours arrondi. Le décalage maximal se règle par campagne dans la gestion locale ou distante (300 m par défaut, 100 à 1 000 m). Ces points ne garantissent pas l’anonymat; les anciens scans n’obtiennent ni point public ni publication rétroactive de leurs indices. Le journal affiche les scans du plus récent au plus ancien, avec une carte qui regroupe les points voisins selon le zoom. La carte utilise les tuiles OpenStreetMap et affiche leur attribution. Le vote se fait séparément à `/vote`.

## Vote et tirage

`/vote` affiche les modèles du catalogue global. Pour illustrer un modèle, ajouter son image dans `src/assets/models/`, puis saisir son nom de fichier et l’URL HTTPS de sa fiche Etsy dans la gestion. Les images sont versionnées dans le dépôt et exigent un build et un déploiement pour apparaître; la gestion ne téléverse pas de fichiers. Chaque participation se rattache à la campagne active et exige un courriel avec consentement au contact. Une nouvelle participation avec le même courriel, sans tenir compte de la casse, remplace le choix précédent pour cette campagne. Les anciens votes et propositions restent dans leurs tables d’origine; ils ne sont pas supprimés par la migration `0005_vote_settings.sql`.

Le tirage est **fermé par défaut**. Avant de l’ouvrir, faire valider et publier ses modalités, puis saisir leur URL HTTPS dans la gestion. Le vote pour un modèle en vente peut donner une chance d’obtenir un rabais pour la boutique Etsy Giocoso Création; la proposition d’un nouveau modèle peut donner une chance d’en recevoir une copie. Aucun tirage, courriel ou remise n’est automatisé. Les huit modèles numérotés du script de démonstration sont temporaires et doivent être remplacés par les vrais modèles de la boutique.

## Gestion locale et distante

Le service `admin` est un Worker **de développement uniquement**, séparé du Worker Astro public. Docker ne publie son port que sur `127.0.0.1:8788`. Son code n’entre pas dans `dist` et n’est pas déployé par `npm run deploy`. Il permet de gérer les campagnes, le catalogue, les couleurs et les accroches FR/EN, l’ouverture du tirage et de consulter les participations récentes. Les couleurs, textes et modalités sont enregistrés par campagne dans `app_settings`.

Le sélecteur **Local / Distant** détermine la base utilisée pour toutes les lectures et écritures. Les modifications locales n’affectent que la D1 de développement. Les modifications distantes affectent immédiatement `giocosohunt-db` sur Cloudflare et demandent une confirmation supplémentaire sur chaque formulaire.

Pour activer le mode distant, fournir au conteneur un jeton Cloudflare avec les permissions D1 Read et D1 Write, ainsi que l’ID du compte. Depuis le même terminal Bash :

```sh
source scripts/load-cloudflare-token.sh
LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)" docker compose up -d --build --force-recreate admin
```

L’image `admin` installe les certificats racines système nécessaires aux appels HTTPS de Wrangler vers Cloudflare. Le jeton est transmis au seul conteneur `admin`. Son démarrage crée un fichier temporaire `.dev.vars` **dans le conteneur**, hors du dépôt monté, puis le supprime à l’arrêt. Il n’est jamais envoyé au navigateur. Après la session :

```sh
docker compose stop admin
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
```

Sans ces variables, le mode distant refuse les opérations. L’interface utilise l’API D1 de Cloudflare avec des paramètres SQL liés; elle ne propose pas d’éditeur SQL libre. Elle ne réalise pas les migrations : les appliquer séparément avec Wrangler après revue et sauvegarde.

## Migrations, build et déploiement

`wrangler.jsonc` configure le Worker public `giocosohunt`, le binding `DB` et l’identifiant de la D1 existante. Les migrations `0001` à `0004` constituent le schéma initial et les réponses aux scans; `0005` ajoute les paramètres et les participations indépendantes du scan; `0006` ajoute les positions publiques approximatives consenties et les champs des médias du catalogue; `0007` ajoute les surnoms et adresses publiques des figurines. Avant toute mise à jour distante, sauvegarder la base et examiner les migrations en attente :

```sh
source scripts/load-cloudflare-token.sh
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 migrations list giocosohunt-db --remote
mkdir -p ../giocosohunt-backups
docker compose run --rm --user "$(id -u):$(id -g)" -v "$PWD/../giocosohunt-backups:/backups" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 export giocosohunt-db --remote --output /backups/giocosohunt-backup.sql
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 migrations apply giocosohunt-db --remote
```

La sauvegarde est enregistrée hors du dépôt, dans `../giocosohunt-backups`. Vérifier sa présence et sa taille avant d’appliquer la migration. Ne pas déposer une sauvegarde contenant des renseignements personnels dans Git.

Vérifier avant une PR ou un déploiement :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npm test
docker compose run --rm --user "$(id -u):$(id -g)" app npm run build
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler deploy --dry-run
```

Le déploiement du seul Worker public, après migration distante et approbation, se fait avec `docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npm run deploy`. Le domaine prévu est `giocosohunt.forgenord.ca`. `/api/health` vérifie la connexion D1, sans exiger que la base soit déjà préparée.

## Statistiques publiques des figurines

La migration `0007_item_public_names.sql` ajoute un surnom et un slug publics uniques à chaque instance. Chat fantôme reçoit initialement `chat-fantome`. Le service de gestion permet de définir ces valeurs pour les autres figurines. La page `/halloween-2026/figurines/<slug>` est en lecture seule et ne publie ni le UUID de la figurine ni un lien vers le formulaire de scan. La carte y reste visible même quand aucun scan ne dispose encore d'une position publique consentie. Les indices et photos anciens restent privés tant qu'ils n'ont pas de consentement explicite de publication.

## Nettoyage ponctuel des scans de démonstration

Le fichier `scripts/clear-chat-fantome-test-scans.sql` retire uniquement les scans associés à l'instance Chat fantôme, ses réponses et ses photos d'indice. Il conserve la figurine, les votes et les propositions en retirant leurs anciens liens aux scans. Sauvegarder la D1 visée avant de l'exécuter; aucune migration n'est nécessaire. Pour la D1 distante, après `source scripts/load-cloudflare-token.sh` et une sauvegarde vérifiée :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 execute giocosohunt-db --remote --file=./scripts/clear-chat-fantome-test-scans.sql
```
