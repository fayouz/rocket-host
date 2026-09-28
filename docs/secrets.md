# Secrets et réglages d'intégration

Depuis la branche `feature/secrets-in-db`, les jetons, clés, mots de passe et adresses des services branchés ne vivent plus dans `.env`.
Ils se saisissent dans **Administration › Connexions** (`/settings/connexions`, administrateur seulement) et sont stockés en base :

- **réglages** (table `app_setting`, texte clair) : adresses des API, identifiants non sensibles ;
- **secrets** (table `secret`) : chiffrés en **AES-256-GCM** (`node:crypto`), un nonce aléatoire de 12 octets par valeur, le nom du secret
  lié comme donnée associée (un texte chiffré recopié sous un autre nom ne se déchiffre pas). Colonnes : `name` (unique), `ciphertext`
  (+ étiquette GCM), `nonce`, `key_version` (8 premiers caractères hexadécimaux du SHA-256 de la clé, jamais la clé), `hint`, `created_at`, `updated_at`.

Seule la **clé maître** reste dans l'environnement : `ROCKET_SECRETS_KEY` (32 octets en base64, `openssl rand -base64 32`), à côté de
l'infrastructure (`SESSION_SECRET`, `ADMIN_INITIAL_PASSWORD`, `PORT`, `DOMAIN`, `ACME_EMAIL`, `N8N_ENCRYPTION_KEY` du conteneur n8n, Rocket Auth).
**Sauvegarde-la hors du serveur** : sans elle, les secrets en base sont illisibles (il faudrait tous les ressaisir).

## Ce que voit le navigateur

Jamais une valeur secrète. `GET /api/settings/connexions` renvoie pour chaque secret : `set`, `hint` (les 4 derniers caractères,
seulement si la valeur fait 12 caractères ou plus), `source` (`db`, `env` pendant la migration, ou vide) et `updatedAt`.
Les champs sont en écriture seule : « ••••1234 » puis **Remplacer** / **Effacer**. `PUT /api/settings/connexions` prend
`{ settings: { NOM: valeur }, secrets: { NOM: valeur | null } }` (null = effacer) et ne renvoie que `{ ok: true }`.
Le journal d'audit note les noms modifiés, jamais les valeurs.

## Noms (identiques aux anciennes variables)

| Ancienne variable `.env` | Nouveau | Type | Où dans l'interface |
|---|---|---|---|
| `PMS_API_URL` | `PMS_API_URL` | réglage | Connexions › Rocket PMS |
| `PMS_API_TOKEN` | `PMS_API_TOKEN` | secret | Connexions › Rocket PMS |
| `PMS_IMPERSONATE_USER` | `PMS_IMPERSONATE_USER` | réglage | Connexions › Rocket PMS |
| `ROCKET_PLACE_URL` / `_TOKEN` | idem | réglage / secret | Connexions › Rocket Place |
| `ROCKET_CLEAN_URL` / `_TOKEN` | idem | réglage / secret | Connexions › Rocket Clean |
| `ROCKET_STOCK_URL` / `_TOKEN` | idem | réglage / secret | Connexions › Rocket Stock |
| `ROCKET_CAST_URL` / `_TOKEN` | idem | réglage / secret | Connexions › Rocket Cast |
| `IMAP_PASSWORD` | `IMAP_PASSWORD` | secret | Connexions › E-mail, et Boîte e-mail (IMAP/SMTP) |
| (serveur, port, identifiant, règles IMAP/SMTP) | déjà en base (`imap_config`, `imap_rule`) | réglages | Boîte e-mail (IMAP/SMTP) |
| `HOMEY_API_KEY` | `HOMEY_API_KEY` | secret | Connexions › Domotique |
| `HOMEY_CLIENT_ID` | `HOMEY_CLIENT_ID` | réglage | Connexions › Domotique |
| `HOMEY_CLIENT_SECRET` | `HOMEY_CLIENT_SECRET` | secret | Connexions › Domotique |
| `HOMEY_REDIRECT_URI` | `HOMEY_REDIRECT_URI` | réglage | Connexions › Domotique |
| `LODGIFY_API_KEY` | `LODGIFY_API_KEY` | secret | Connexions › Lodgify / Nuki en direct |
| `NUKI_API_TOKEN` | `NUKI_API_TOKEN` | secret | Connexions › Lodgify / Nuki en direct |
| `WEBHOOK_TOKEN` | `WEBHOOK_TOKEN` | secret | Connexions › Webhook (n8n) |
| `CONNECTOR_*` | même nom | secret | Connexions › Secrets des connecteurs |

Restent dans l'environnement : `ROCKET_SECRETS_KEY` (+ `ROCKET_SECRETS_KEY_OLD` pendant une rotation), `SESSION_SECRET`, `ADMIN_INITIAL_PASSWORD`,
`PORT`, `DEMO`, `LH_*`, les adresses publiques compilées (`PMS_FRONT_URL`, `PLACE_FRONT_URL`, `ROCKET_CONSOLE_PUBLIC_URL`), `ROCKET_AUTH_*`
(connexion unique, hors périmètre de ce chantier), et les variables Docker (`DOMAIN`, `ACME_EMAIL`, `N8N_ENCRYPTION_KEY`, utilisée par n8n et non par l'appli).
Pas de SMTP séparé : l'envoi utilise l'adresse et le mot de passe de la boîte IMAP. Le jeton OAuth Homey (renouvellement) reste dans `.data/homey-oauth.json` (0600).

## Lecture côté serveur

`server/utils/secrets.ts` : `getSetting(nom)`, `getSecret(nom)`, `hasSecret(nom)`, `secretStatus(nom)`. Cache mémoire de 60 s, rechargé à chaque
écriture. **Repli de migration** : si un nom est absent de la base, la variable d'environnement du même nom (ou `NUXT_<NOM>`, forme passée par
l'ancien docker-compose) est lue, avec un avertissement unique dans le journal (sans la valeur). Une valeur en base a toujours priorité.

## Importer l'existant

```
npm run secrets:import-env                  # base .data/db.sqlite3, lit .env
npm run secrets:import-env -- chemin.sqlite3 --force
```

Idempotent : une valeur déjà en base n'est pas écrasée (sauf `--force`). N'affiche que des noms. En Docker (le script est dans l'image) :

```
docker compose exec app node --experimental-strip-types --no-warnings scripts/secrets-import-env.mjs /app/.data/db.sqlite3
```

## Rotation de la clé maître

1. `ROCKET_SECRETS_KEY_OLD` = clé actuelle, `ROCKET_SECRETS_KEY` = `openssl rand -base64 32` ; redémarrer (les deux clés déchiffrent).
2. `npm run secrets:rotate` (Docker : `docker compose exec app node --experimental-strip-types --no-warnings scripts/secrets-rotate.mjs /app/.data/db.sqlite3`) :
   tout est rechiffré dans une transaction (tout ou rien).
3. Retirer `ROCKET_SECRETS_KEY_OLD`, redémarrer, sauvegarder la nouvelle clé.

## Vérifications

`npm run check:secrets` : aller-retour AES-256-GCM, nonce unique, donnée associée, falsification et mauvaise clé refusées, rotation ;
et contrôle statique que les routes n'exposent que l'état (toute nouvelle route qui lit un secret doit être relue et ajoutée à la liste du script).
