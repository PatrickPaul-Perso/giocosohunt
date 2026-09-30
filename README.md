# Giocoso Hunt

Fondation Astro SSR en TypeScript pour un **Cloudflare Worker** nommé `giocosohunt`. La première campagne est accessible à `/halloween-2026`; la fiche de démonstration utilise `/halloween-2026/t/00000000-0000-4000-8000-000000000001`. Le domaine `giocosohunt.forgenord.ca` est prévu, mais n'est pas encore configuré.

## Démarrer localement avec Docker

Docker Compose est l'environnement de développement recommandé, comme dans `forgenord.ca`. L'image Node 24 est fixée dans `compose.yaml` et les dépendances dans `package-lock.json`; Node et npm ne sont pas nécessaires sur l'hôte.

Depuis la racine du dépôt :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npm ci
docker compose run --rm --service-ports --user "$(id -u):$(id -g)" app
```

Ouvrir <http://localhost:4321/halloween-2026>. Un Dev Container utilisant Node.js 24 peut exécuter les mêmes commandes `npm ci` et `npm run dev`. Le développement local passe par le runtime Workers de l'adaptateur Astro. Le binding D1 local utilise l'UUID fictif jusqu'à la création de la base distante.

Pour régénérer les types, vérifier le build et préparer un paquet Worker sans déploiement :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npm run types
docker compose run --rm --user "$(id -u):$(id -g)" app npm run build
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler deploy --dry-run
```

Les commandes `npm` et `npx` suivantes s'exécutent de la même façon dans le service `app`, ou directement dans un Dev Container Node 24.

## Base D1 et migrations

`wrangler.jsonc` déclare le binding `DB` pour la future base `giocosohunt-db`. Son `database_id` vaut actuellement `00000000-0000-0000-0000-000000000000` : **c'est un emplacement fictif, à remplacer avant tout déploiement**. Aucune base distante n'est créée par ce dépôt.

Lorsque la création distante sera autorisée :

```sh
npx wrangler d1 create giocosohunt-db
```

Copier l'ID retourné dans `d1_databases[0].database_id` de `wrangler.jsonc`, puis régénérer les types et appliquer la migration :

```sh
npm run types
npx wrangler d1 migrations apply giocosohunt-db --local
npx wrangler d1 migrations apply giocosohunt-db --remote
```

La commande `--remote` modifie la base distante; la réserver à la mise en service. La migration initiale se trouve dans `migrations/0001_initial.sql`. Elle crée les six tables de base et les index d'historique. Aucun emplacement exact, IP, courriel ou handle social n'est stocké. Toute future collecte de courriel et de handle social devra rester facultative, avec deux consentements distincts.

## Build et déploiement

```sh
npm run build
npm run preview
```

Après remplacement du `database_id`, application de la migration distante et configuration du compte Cloudflare :

```sh
npm run deploy
```

Ce déploiement cible **Workers**, pas Pages. Le domaine personnalisé est à configurer plus tard dans Cloudflare; il n'est pas déclaré dans le projet. Aucune ressource distante ni déploiement n'est effectué par la préparation locale.

## Routes et suite

- `/api/health` répond `status: ok` et indique `database: ready` ou `unavailable`; il ne fait qu'un `SELECT 1` et reste accessible sans D1 local configuré.
- Les pages de campagne et de figurine utilisent des données de démonstration. Elles n'effectuent ni scan, ni géolocalisation, ni vote, ni collecte de contacts.
- `src/pages/` contient les routes; `migrations/` contient le schéma. Les futurs accès D1 pourront utiliser `env.DB` depuis `cloudflare:workers`, typé par `worker-configuration.d.ts` généré automatiquement par les scripts npm (fichier ignoré par Git).
