# Plan — intégration continue (CI)

Statut : **brouillon à fignoler** (2026-09-21). Rien n'est mis en place.

## 1. Constat

- Dépôt GitHub **privé** `fayouz/host-management` ; une branche par version (`v2`, …) mergée dans `main` (mémoire du projet).
- **Aucune CI** : pas de dossier `.github`, aucun test, aucun lint, aucune vérification de types (les scripts se limitent à `dev`, `build`, `preview`).
- Seule barrière existante : le `Dockerfile` (Node 24) fait `npm ci` puis `npm run build` ; un build cassé échoue donc au déploiement, pas avant.
- **Jamais lancés jusqu'ici** : `nuxt build` et la vérification de types (les changements récents ont été testés à la main sur l'appli qui tourne). L'état réel est inconnu tant qu'on n'a pas fait la mesure de départ (étape 0).
- Le code touche des services réels (Lodgify, Nuki, e-mail, Homey) et des données de tiers : la CI ne doit **jamais** les contacter ni en contenir.

## 2. Objectifs

1. **Filet anti-régression** à chaque push : ça compile, les types passent, les tests passent.
2. **Empêcher les fuites** : secrets, `.env`, `.data`, données de voyageurs.
3. **Vérifier l'image Docker** avant qu'elle serve à déployer.
4. **Garder les dépendances à jour et saines** (vulnérabilités connues).
5. Rester **gratuit** et rapide (moins de 5 minutes par exécution).

Hors périmètre pour l'instant : le déploiement automatique (CD), voir étape 6.

## 3. Coût

GitHub Actions offre **2 000 minutes par mois** sur les dépôts privés du plan gratuit (minutes Linux ; Windows compte double, macOS dix fois). Une exécution de 4 à 5 minutes autorise environ 400 exécutions par mois : largement suffisant. On n'utilise que des exécuteurs **Linux** pour rester dans ce quota. Les exécuteurs auto-hébergés restent gratuits (inutile ici).
À vérifier : les règles de protection de branche (bloquer un merge si la CI échoue) ne sont probablement **pas disponibles sur un dépôt privé du plan gratuit** ; sinon, la règle sera une convention (merge seulement si la CI est verte).

## 4. Principes de conception

- **Aucun secret dans la CI** : l'appli tourne en mode démo (`DEMO=1`), avec de faux jetons ; tous les services externes sont remplacés par des **faux serveurs locaux** (comme le faux Homey/Athom et le bac à sable IMAP déjà utilisés à la main).
- **Données factices seulement** dans les tests : aucun vrai nom de voyageur, e-mail ou identifiant.
- **Permissions minimales** du workflow (`contents: read`), actions **épinglées** (version précise ou empreinte) et mises à jour par Dependabot.
- **Même commande en local et en CI** : un script `npm run check` (types + tests) que Faez ou moi lançons avant de pousser ; la CI appelle le même script.
- Les workflows se déclenchent sur les pushes des branches de version et de `main`, et sur les demandes de fusion vers `main` ; une nouvelle exécution **annule** la précédente sur la même branche.

## 5. Étapes

| # | Étape | Contenu | Effort | Bloquant si… |
|---|---|---|---|---|
| **0** | Mesure de départ (en local) | Lancer `nuxt build` et la vérification de types (ajout de `typescript` et `vue-tsc` en dépendances de développement), lister les erreurs existantes | 1 h | — |
| **1** | Workflow « CI » minimal | `npm ci` → `nuxt prepare` → vérification de types → `nuxt build`, cache npm, Node 24 (comme le Dockerfile) | 1 h | l'étape 0 révèle beaucoup d'erreurs de types : on les corrige ou on les met en liste d'attente, puis on durcit |
| **2** | Tests automatiques (Vitest) | Voir §6 ; d'abord la logique pure et à risque, puis un test « fumée » de l'appli complète | 1 à 2 jours | — |
| **3** | Sécurité | Détection de secrets (gitleaks) sur chaque push, `npm audit --omit=dev` (échec si vulnérabilité élevée), Dependabot (npm, GitHub Actions, Docker), vérification que `.env` et `.data` ne sont jamais suivis | 0,5 j | — |
| **4** | Image Docker | Construction de l'image dans la CI **sans la publier** (vérifie le `Dockerfile`), analyse du Dockerfile (hadolint) | 0,5 j | — |
| **5** | Lint (optionnel) | ESLint via `@nuxt/eslint` ; d'abord en simple avertissement (le code existant n'a jamais été linté), puis on durcit | 0,5 j | trop de bruit : à différer |
| **6** | Livraison continue (plus tard) | Publication de l'image (registre GitHub) puis déploiement sur l'hébergement, **déclenché à la main** au début. Dépend du choix de l'hébergement (Oracle Cloud gratuit envisagé, pas fait) | à cadrer | l'hébergement n'est pas choisi |

## 6. Ce qu'on teste en priorité (étape 2)

Ordre : risque d'erreur silencieuse × coût d'un bug.

1. **Règles de calcul pures** : simulation du préchauffage (`simulate`, continuité entre séjours, changement d'heure), fenêtres de validité des codes Nuki (`parisToIso`, heure d'été), calcul du bilan (revenus par nuit, charges).
2. **Validation des entrées** : bornes de température et adresse Homey (`parseDomoConfig`), noms de fichiers et de dossiers (`checkName`), étiquettes (doublons avec accents), types et contenu des fichiers déposés (`magicOk`, `saveFile`).
3. **Sécurité** : protection anti-CSRF (origine étrangère refusée, appels de n8n acceptés), export CSV contre l'injection de formules, retour OAuth (état invalide, retour vers un site externe refusé).
4. **Test « fumée » de l'appli complète** : démarrer l'appli construite avec une base temporaire et `DEMO=1`, puis rejouer les scénarios que j'ai faits à la main : explorateur (dossiers, dépôt, déplacement, suppression récursive, étiquettes), domotique (règle, refus hors bornes), et le **flux Homey cloud contre de faux serveurs** (connexion, session expirée, renouvellement, association exclusive). Ces scripts existent déjà en version manuelle : il suffit de les transformer en tests.
5. **Interdiction d'appeler l'extérieur** : les tests échouent si une requête sort vers autre chose que `127.0.0.1`.

Difficulté connue : les fonctions utilitaires s'appuient sur les mécanismes automatiques de Nuxt/Nitro (`useDatabase`, `createError`…). Deux voies : extraire la logique pure dans des fonctions sans dépendance (simple, recommandé au début), ou utiliser `@nuxt/test-utils` pour lancer le serveur (plus lourd, réservé au test « fumée »).

## 7. Structure prévue

```
.github/
  workflows/ci.yml          types + tests + build (étapes 1, 2)
  workflows/security.yml    secrets, audit, Dockerfile, image (étapes 3, 4)
  dependabot.yml            mises à jour (npm, actions, docker)
tests/
  unit/                     logique pure (étape 2)
  smoke/                    appli complète + faux Homey/Athom/IMAP (étape 2)
package.json                scripts « typecheck », « test », « check »
```

## 8. À trancher avant de commencer

1. Faut-il que **tous les tests** passent avant tout merge dans `main`, ou seulement types + build au début ? (Reco : types + build d'abord, puis les tests quand ils couvrent l'essentiel.)
2. **Étape 0** : ok pour ajouter `typescript` et `vue-tsc` aux dépendances de développement ? Et si la vérification de types révèle beaucoup d'erreurs, on corrige tout d'abord, ou on avance par fichiers ?
3. **Lint** : voulu maintenant ou à différer ?
4. **Protection de `main`** : vérifier ce que permet le plan gratuit pour un dépôt privé ; sinon, règle de convention.
5. **CD** : on garde ça pour plus tard, en même temps que le choix de l'hébergement (`docs/deploiement.md`) ?
6. Les alertes de la CI (échec) : e-mail GitHub par défaut, suffisant ?

## Sources

- [Tarification GitHub Actions 2026 (quotas des dépôts privés)](https://cicdcalculator.com/github-actions-free-tier)
- [Changements de tarification de GitHub Actions, GitHub](https://github.com/resources/insights/2026-pricing-changes-for-github-actions)
- [Note de version GitHub, tarification simplifiée d'Actions](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/)
