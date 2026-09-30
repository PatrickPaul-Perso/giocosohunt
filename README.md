# Giocoso Hunt

Fondation Astro SSR en TypeScript pour un **Cloudflare Worker** nommé `giocosohunt`. La première campagne est accessible à `/halloween-2026`; la fiche de démonstration utilise `/halloween-2026/t/00000000-0000-4000-8000-000000000001`. Le domaine `giocosohunt.forgenord.ca` est prévu, mais n'est pas encore configuré.

## Démarrer localement avec Docker

Docker Compose est l'environnement de développement recommandé, comme dans `forgenord.ca`. L'image Node 24 est fixée dans `compose.yaml` et les dépendances dans `package-lock.json`; Node et npm ne sont pas nécessaires sur l'hôte.

Depuis la racine du dépôt, installer les dépendances et préparer la D1 locale :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npm ci
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 migrations apply giocosohunt-db --local
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 execute giocosohunt-db --local --file=./scripts/seed-demo.sql
```

Démarrer ensuite le serveur :

```sh
docker compose run --rm --service-ports --user "$(id -u):$(id -g)" app
```

Ouvrir <http://localhost:4321/halloween-2026>, puis suivre le lien de la figurine. Chaque ouverture de sa fiche enregistre un scan local. Un Dev Container utilisant Node.js 24 peut exécuter les mêmes commandes `npm ci` et `npm run dev`. Le développement local passe par le runtime Workers de l'adaptateur Astro. Le binding D1 local utilise une copie locale de la base; les données distantes ne sont pas consultées en développement.

Pour régénérer les types, vérifier le build et préparer un paquet Worker sans déploiement :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npm run types
docker compose run --rm --user "$(id -u):$(id -g)" app npm run build
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler deploy --dry-run
```

Les commandes `npm` et `npx` suivantes s'exécutent de la même façon dans le service `app`, ou directement dans un Dev Container Node 24.

## Base D1 et migrations

`wrangler.jsonc` déclare le binding `DB` pour la base `giocosohunt-db`, avec son `database_id` Cloudflare. La base existe déjà sur Cloudflare; elle n'est pas créée par ce dépôt.

Pour régénérer les types et appliquer la migration initiale localement :

```sh
npm run types
npx wrangler d1 migrations apply giocosohunt-db --local
```

Pour préparer la base Cloudflare, charger le jeton et l’ID du compte dans un terminal Bash. La saisie du jeton est masquée et les valeurs restent en mémoire dans ce terminal :

```sh
source scripts/load-cloudflare-token.sh
```

Exécuter ensuite les commandes Wrangler dans le même terminal :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 migrations list giocosohunt-db --remote
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 migrations apply giocosohunt-db --remote
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 execute giocosohunt-db --remote --file=./scripts/seed-demo.sql
```

Les commandes transmettent au conteneur le jeton et l’ID du compte exportés dans le terminal. Après les opérations, exécuter `unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID`. Ne pas mettre le jeton dans un fichier suivi par Git ni le partager dans une conversation. Si le conteneur dispose déjà d’une authentification Wrangler persistante, retirer les options `-e CLOUDFLARE_API_TOKEN` et `-e CLOUDFLARE_ACCOUNT_ID`.

Les commandes `apply` et `execute` avec `--remote` modifient la base distante; les réserver à la mise en service. Le chargement de démonstration est idempotent grâce à `INSERT OR IGNORE`. La migration initiale se trouve dans `migrations/0001_initial.sql`. Elle crée les six tables de base et les index d'historique. Aucun emplacement exact, IP, courriel ou handle social n'est stocké. Toute future collecte de courriel et de handle social devra rester facultative, avec deux consentements distincts.

## Build et déploiement

```sh
npm run build
npm run preview
```

Après application de la migration distante et configuration du compte Cloudflare :

```sh
npm run deploy
```

Ce déploiement cible **Workers**, pas Pages. Le domaine personnalisé est à configurer plus tard dans Cloudflare; il n'est pas déclaré dans le projet. Aucune ressource distante ni déploiement n'est effectué par la préparation locale.

## Routes et suite

- `/api/health` répond `status: ok` et indique `database: ready` ou `unavailable`; il ne fait qu'un `SELECT 1` et ne vérifie pas la présence des tables. Il reste accessible sans D1 local configuré.
- La page de campagne pointe vers une figurine de démonstration. Chaque ouverture de sa fiche ajoute un événement dans `scan_events` et affiche le total. Ce scan simulé n'enregistre ni géolocalisation, ni IP, ni donnée personnelle; les votes et la collecte de contacts restent à développer.
- `src/pages/` contient les routes; `migrations/` contient le schéma. Les futurs accès D1 pourront utiliser `env.DB` depuis `cloudflare:workers`, typé par `worker-configuration.d.ts` généré automatiquement par les scripts npm (fichier ignoré par Git).
