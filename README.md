# Giocoso Hunt

Application Astro SSR sur Cloudflare Workers avec D1. La campagne initiale est `/halloween-2026`; le Token de test est accessible à `/halloween-2026/t/00000000-0000-4000-8000-000000000001`. Les figurines physiques cachées dans la région d’Ottawa–Gatineau sont des lignes de `items`.

## Démarrer avec Docker Compose

L’image Node 24 et le verrouillage npm sont fixés dans le dépôt. Docker suffit sur l’hôte.

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npm ci
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 migrations apply giocosohunt-db --local
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 execute giocosohunt-db --local --file=./scripts/seed-demo.sql
LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)" docker compose up -d app admin
```

Ouvrir <http://localhost:4321/halloween-2026> et la gestion locale à <http://127.0.0.1:8788>. `docker compose down` arrête les deux services. La D1 locale persiste dans `.wrangler/state` et ne requiert aucune authentification Cloudflare. Le Dev Container Node 24 peut utiliser les mêmes commandes npm et Wrangler.

La page de campagne présente les classes de figurines. Chaque classe donne accès à ses instances physiques et à leurs historiques publics, sans lien vers leurs fiches de scan. Déposer la photo de la première figurine dans `src/assets/items/chat_fantome.jpg`; Astro inclut la photo dans le build; la carte et la fiche de scan affichent l’image entière sans la rogner. Sans le fichier, une carte provisoire s’affiche. Pour une D1 déjà peuplée avec l’ancien nom, exécuter `scripts/name-chat-fantome.sql` sur la cible voulue :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" app npx wrangler d1 execute giocosohunt-db --local --file=./scripts/name-chat-fantome.sql
# Après fusion et avec les variables Cloudflare chargées :
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 execute giocosohunt-db --remote --file=./scripts/name-chat-fantome.sql
```

Le UUID de la figurine et ses scans existants sont conservés. La photo requiert un nouveau build et déploiement pour apparaître en production.

La fiche du Token de test enregistre un scan à chaque ouverture. Sa réponse enregistre la décision de garder ou recacher la figurine et les contacts facultatifs avec consentements distincts. Avec un consentement public distinct, un indice texte et une photo peuvent apparaître dans le journal des scans. La photo d’indice est réduite côté navigateur, puis stockée dans D1; la route publique retire toujours ses métadonnées EXIF. Le GPS EXIF ou la position actuelle ajoutée à cette photo restent privés et exigent leur propre consentement.

Deux cartes facultatives distinguent le lieu du scan de la nouvelle cachette prévue. Chaque point exige un consentement public séparé. Le navigateur arrondit la position choisie à trois décimales, puis le serveur ajoute un décalage aléatoire une seule fois avant de conserver le point final, toujours arrondi. Le décalage maximal se règle par campagne dans la gestion locale ou distante (300 m par défaut, 100 à 1 000 m). Ces points ne garantissent pas l’anonymat; les anciens scans n’obtiennent ni point public ni publication rétroactive de leurs indices. Le journal affiche les scans du plus récent au plus ancien, avec une carte qui regroupe les points voisins selon le zoom. La carte utilise les tuiles OpenStreetMap et affiche leur attribution.

## Portail Giocoso Création

Après l’enregistrement du choix de recacher la figurine, la page de remerciement propose de visiter <https://vote.forgenord.ca/giocoso-creation> pour découvrir un rabais à l’achat d’une décoration murale Giocoso Création. Cette visite est facultative; aucune donnée de scan ou de contact n’est transmise dans le lien. Le choix de garder la figurine n’affiche pas cette invitation.

Le vote, les propositions et le tirage ne sont plus gérés par cette application. L’ancienne route `/vote` est retirée. Les tables, anciennes données et migrations sont conservées pour préserver l’historique; aucune nouvelle participation au vote n’est enregistrée ici.

## Gestion locale et distante

Le service `admin` est un Worker **de développement uniquement**, séparé du Worker Astro public. Docker ne publie son port que sur `127.0.0.1:8788`. Son code n’entre pas dans `dist` et n’est pas déployé par `npm run deploy`. Il permet de gérer les campagnes, les figurines physiques, les couleurs et les accroches FR/EN, ainsi que de valider les scans. Pour chaque instance physique, il affiche le UUID et les URL complètes de la page de statistiques et de la page de scan sur la cible sélectionnée; ouvrir la page de scan crée un événement. Les couleurs et textes sont enregistrés par campagne dans `app_settings`.

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

`wrangler.jsonc` configure le Worker public `giocosohunt`, le binding `DB` et l’identifiant de la D1 existante. Les migrations `0001` à `0004` constituent le schéma initial et les réponses aux scans; `0005` ajoute les paramètres et les participations indépendantes du scan; `0006` ajoute les positions publiques approximatives consenties et les champs des médias du catalogue; `0007` ajoute les surnoms et adresses publiques des figurines; `0008` ajoute la validation manuelle des réponses aux scans. Avant toute mise à jour distante, sauvegarder la base et examiner les migrations en attente :

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

Le fichier `scripts/clear-chat-fantome-test-scans.sql` retire uniquement les scans associés à l’ancien tag de test, désormais nommé Token, ses réponses et ses photos d'indice. Il conserve la figurine, les votes et les propositions en retirant leurs anciens liens aux scans. Sauvegarder la D1 visée avant de l'exécuter; aucune migration n'est nécessaire. Pour la D1 distante, après `source scripts/load-cloudflare-token.sh` et une sauvegarde vérifiée :

```sh
docker compose run --rm --user "$(id -u):$(id -g)" -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID app npx wrangler d1 execute giocosohunt-db --remote --file=./scripts/clear-chat-fantome-test-scans.sql
```

## Validation manuelle des réponses aux scans

La migration `0008_scan_moderation.sql` place toutes les réponses existantes et futures en attente. L’historique public conserve la date et la décision; l’indice texte, la photo et les deux points approximatifs n’apparaissent qu’après approbation dans le service de gestion local, et seulement si les consentements correspondants ont été donnés. Les deux routes publiques de photo appliquent la même règle. La gestion permet d’approuver, de suspendre ou de rejeter une réponse sur la D1 locale ou distante; un rejet garde les détails privés dans D1. Pour masquer les anciens détails dès la mise en service du nouveau code, sauvegarder la D1 distante, déployer le Worker mis à jour, puis appliquer immédiatement la migration 0008. Les pages qui lisent les scans peuvent répondre temporairement 503 entre ces deux étapes, car la colonne de modération n’existe pas encore. Appliquer la migration avant le déploiement évite cette interruption, mais les anciens détails restent accessibles avec le Worker précédent jusqu’au déploiement.

## Campagnes et classes de figurines

La racine `/` présente les campagnes, avec la campagne active définie dans la gestion mise en avant. Les autres campagnes restent accessibles à leur adresse `/<slug>`, y compris leurs classes et leurs historiques publics. L’en-tête affiche le titre de la campagne consultée.

La migration `0009_figurine_classes.sql` ajoute les classes et leur rattachement aux instances. Halloween 2026 contient deux classes : `chat-fantome` et `gnome-squelette`, avec six instances chacune. Le Chat fantôme existant conserve son UUID, son adresse publique et tous ses scans. La migration ajoute les onze autres instances, avec leurs UUID et adresses publiques distincts; la gestion permet de consulter leurs liens de scan et de statistiques.

Les classes apparaissent à la racine de la campagne. `/<campagne>/classes/<classe>` présente leurs instances, avec des liens vers les statistiques qui ne déclenchent aucun scan. Chaque classe partage sa photo avec ses six instances (`chat_fantome.jpg` et `gnome_squelette.jpg`). Appliquer la nouvelle migration D1 avant de déployer ce code. Aucune migration n’a été exécutée sur la production par cette PR.

La migration `0010_physical_instance_tags.sql` utilise les 12 UUID et surnoms des CSV de `data/instances/`. Les six Chats fantômes sont Pixel, Moustache, Simba, Sushi, Mimine et Pacha; les six Gnomes squelettes sont Gribouille, Pipou, Fripon, Bricole, Turlututu et Chafouin. Les adresses publiques combinent la classe et le surnom (par exemple `chat-fantome-pixel`). Le Chat fantôme de démonstration reste accessible à son ancienne adresse avec son historique, mais n’est plus compté dans la classe physique. Les autres instances provisoires sont retirées seulement si elles n’ont aucun scan; celles ayant un historique sont conservées hors des classes. Appliquer les migrations 0009, 0010 et 0011 avant le déploiement.

La migration `0011_test_tag_token.sql` renomme l’ancien tag de test en « Token ». Il n’utilise plus la photo du Chat fantôme et reste hors des deux classes physiques. Son UUID, son adresse publique historique et tous ses scans sont conservés.

## Statut de circulation et lancement de la chasse

Dans la galerie d’une classe, la dernière réponse enregistrée à un scan détermine le statut de chaque instance : « Hors Circulation » après le choix de la garder, « À découvrir » après le choix de la recacher ou en l’absence de réponse. Une simple ouverture du tag sans réponse ne change pas ce statut. Les réponses sont ordonnées par date du scan, puis par identifiant, comme le journal public.

Pour lancer la chasse, scanner chaque figurine, choisir de la cacher à nouveau et ajouter un indice texte et une photo JPEG. Cocher le consentement de publication, enregistrer la réponse, puis approuver sa publication dans la gestion. Les indices et photos restent privés avant approbation. Les consentements de localisation demeurent séparés et facultatifs.

## Images et noms individuels

La migration `0012_item_images_names.sql` ajoute `items.image_key` et `items.display_name_en`. Le nom français reste `items.display_name`. Les références des anciennes images de groupes sont copiées vers leurs membres; la traduction anglaise n’est reprise que lorsque le nom français de l’item correspond au nom du groupe. Le Token reste sans image imposée. Appliquer cette migration avant de déployer le code; aucune modification en production n’est faite par la PR.

Chaque item utilise exclusivement sa propre référence d’image dans sa galerie, sa fiche de statistiques et sa page de scan. Plusieurs items peuvent référencer le même fichier. Une référence absente ou introuvable affiche « Photo à venir » sans reprendre la couverture du groupe. Les groupes conservent une couverture indépendante dans `figurine_classes.image_key`; les routes `/classes/` restent compatibles, tandis que les textes visibles parlent de groupes.

La gestion permet de modifier le nom français obligatoire, le nom anglais facultatif et le fichier image facultatif de chaque item. Ajouter les fichiers dans `src/assets/items/`, puis effectuer un build et un déploiement; la gestion ne téléverse aucun fichier. Les noms de fichiers doivent être simples, en minuscules, avec l’extension jpg, jpeg, png ou webp. La page de scan affiche le surnom dans « Bravo tu as trouvé Pixel! » et le nom individuel en sous-titre. Sans surnom, le nom individuel apparaît dans le titre seulement; sans traduction anglaise, le nom français est utilisé.
