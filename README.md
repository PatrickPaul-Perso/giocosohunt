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

Lorsque la migration distante sera autorisée et que Wrangler disposera d'un accès au compte Cloudflare :

```sh
npx wrangler d1 migrations apply giocosohunt-db --remote
```

La commande `--remote` modifie la base distante; la réserver à la mise en service. La migration initiale se trouve dans `migrations/0001_initial.sql`; `migrations/0002_scan_responses.sql` ajoute les réponses et les liens aux votes et propositions. Aucune géolocalisation structurée ni adresse IP n'est enregistrée. Le courriel et le handle social restent facultatifs et exigent deux consentements distincts.

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

- `/api/health` répond `status: ok` et indique `database: ready` ou `unavailable`; il ne fait qu'un `SELECT 1` et reste accessible sans D1 local configuré.
- La page de campagne pointe vers une figurine de démonstration. Chaque ouverture de sa fiche ajoute un événement dans `scan_events` et affiche le total. Le formulaire de participation enregistre séparément le choix de garder ou cacher la figurine, un vote ou une proposition, et un indice général facultatif après une nouvelle cachette. Le handle et le courriel sont facultatifs et enregistrés uniquement avec leurs consentements distincts. Aucune géolocalisation structurée ni adresse IP n’est enregistrée.
- `src/pages/` contient les routes; `migrations/` contient le schéma. Les accès D1 utilisent `env.DB` depuis `cloudflare:workers`, typé par `worker-configuration.d.ts` généré automatiquement par les scripts npm (fichier ignoré par Git).

## Formulaire MVP après un scan

La migration `0002_scan_responses.sql` ajoute les réponses liées aux scans. Après sa fusion, appliquer les migrations à la D1 visée, puis relancer `scripts/seed-demo.sql` sur cette même D1 pour créer les choix temporaires « Modèle #1 » à « Modèle #8 ». Le script de démonstration est idempotent. Les commandes locales figurent plus haut; pour la production, utiliser `--remote` et une authentification Wrangler autorisée. Aucune migration distante n'est appliquée par le build ou le déploiement du Worker.

Le formulaire fonctionne sans JavaScript côté navigateur. Chaque visite de la fiche crée un événement de scan; une réponse peut être enregistrée une seule fois par événement. Une nouvelle visite crée un nouveau scan. Les votes et propositions sont écrits dans la même transaction que la réponse au scan. Le nom d'un modèle proposé et l'indice sont limités en longueur. L'indice refuse les chiffres, adresses courantes, coordonnées et liens; il n'est pas affiché publiquement pour l'instant. Ce filtrage ne peut pas reconnaître toutes les formulations d'un emplacement précis : l'équipe devra relire les indices avant toute publication. L'upload photo et les instructions de recachette ne font pas partie de ce MVP.

Les shoutouts sont manuels. Pour lister les handles ayant donné leur consentement, exécuter `scripts/list-shoutouts.sql` avec `wrangler d1 execute giocosohunt-db --remote --file=./scripts/list-shoutouts.sql` depuis un environnement authentifié. Cette liste contient des renseignements personnels consentis : la réserver à l'équipe chargée des shoutouts et ne pas la publier. Aucun message ou courriel n'est envoyé automatiquement par le projet.
