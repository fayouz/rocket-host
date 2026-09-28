# Rocket Auth : connexion unique (étape 1 du plan Rocket)

LoussaHousing devient un **client OpenID Connect** de Rocket Auth (`fayouz`/rocket-middleware/rocket-auth).
Désactivé tant que `ROCKET_AUTH_URL` est vide : la connexion locale fonctionne exactement comme avant.

## Fonctionnement
- **Connexion** : bouton « Se connecter avec Rocket Auth » sur `/connexion` → `GET /api/auth/rocket/login` → Rocket Auth
  (`/oauth/authorize`, code d'autorisation + **PKCE S256**, `state` et `nonce` dans un cookie chiffré `lh_oidc` de 10 minutes, usage unique).
- **Retour** : `GET /api/auth/rocket/callback` échange le code (`client_secret_basic`), vérifie le jeton d'identité
  (**RS256** avec les clés de `/oauth/jwks`, émetteur, audience = client ID, expiration, nonce ; module `crypto` de Node, aucune dépendance ajoutée),
  puis ouvre la **session locale habituelle** (cookie `lh_session`, marquée « SSO »). Adresses découvertes par `/.well-known/openid-configuration` (cache 10 min).
- **Association des comptes** : lien déjà connu (`sub` → compte, table `rocket_auth_link`), sinon compte local ayant la **même adresse e-mail**,
  sinon création si `ROCKET_AUTH_AUTOCREATE=1` (compte sans mot de passe local). Adresse marquée non vérifiée : refus.
- **Rôles** : groupe `ROCKET_AUTH_ADMIN_GROUP` (défaut `rocket-admins`) → administrateur ; autres groupes par `ROCKET_AUTH_ROLE_GROUPS`
  (`gestionnaire=lh-gestion|gestion,comptable=lh-compta,menage=lh-menage` ; le rôle le plus fort l'emporte). Si un groupe donne un rôle, il remplace
  le rôle local à chaque connexion ; sinon le rôle local est gardé. Compte créé sans groupe reconnu : `ROCKET_AUTH_DEFAULT_ROLE`, sinon refus.
  Les logements autorisés restent gérés dans LoussaHousing (Réglages > Utilisateurs).
- **Déconnexion** : une session ouverte par Rocket Auth renvoie vers `end_session_endpoint` (`/oauth/logout`, *RP-initiated*) avec
  `post_logout_redirect_uri` = `/connexion?logged_out=1` (ou `ROCKET_AUTH_POST_LOGOUT_URI`).
- **Back-channel logout** : `POST /api/auth/rocket/backchannel` (`logout_token`, `typ` `logout+jwt`, signature, émetteur, audience, événement, pas de nonce, `jti` non rejoué).
  Les sessions locales étant des cookies chiffrés sans état serveur, **toutes les sessions du compte** sont fermées (`session_version + 1`).
- **Connexion locale** : gardée par défaut (`ROCKET_LOCAL_LOGIN=1`) ; `ROCKET_LOCAL_LOGIN=0` la coupe (formulaire masqué, `POST /api/auth/login` refusé) quand Rocket Auth est actif.
- **Sélecteur d'applications** : icône grille dans l'en-tête, liste de `GET /api/suite/apps` de Rocket Auth (cache 60 s, via `GET /api/auth/rocket/apps`) et lien « Mon compte Rocket ».
  Invisible sans Rocket Auth ou si la liste est vide.

## Variables d'environnement
| Variable | Rôle |
|---|---|
| `ROCKET_AUTH_URL` | Émetteur Rocket Auth (ex. `http://localhost:8100`). Vide = désactivé |
| `ROCKET_AUTH_CLIENT_ID` | Client ID (défaut `loussahousing`) |
| `ROCKET_AUTH_CLIENT_SECRET` | Secret du client (24 caractères au moins) |
| `ROCKET_AUTH_ADMIN_GROUP` | Groupe administrateur (défaut `rocket-admins`) |
| `ROCKET_AUTH_ROLE_GROUPS` | Autres rôles d'après les groupes |
| `ROCKET_AUTH_AUTOCREATE` | `1` : création du compte à la première connexion |
| `ROCKET_AUTH_DEFAULT_ROLE` | Rôle d'un compte créé sans groupe reconnu |
| `ROCKET_LOCAL_LOGIN` | `1` (défaut) garde la connexion locale ; `0` la coupe |
| `ROCKET_AUTH_REDIRECT_URI`, `ROCKET_AUTH_POST_LOGOUT_URI`, `ROCKET_AUTH_APPS_URL` | Facultatifs (sinon calculés depuis l'adresse de l'appli / l'émetteur) |

**Secret client** : la règle « aucune clé d'intégration dans `.env` » vise les intégrations ; ce secret est l'identité propre de l'appli auprès de Rocket Auth.
Il reste dans `.env` pour l'instant et **passera dans le coffre de secrets du compte en phase 2**.

## Déclarer LoussaHousing dans Rocket Auth
Interface Rocket Auth : Administration → Clients OAuth (confidentiel, application de confiance, scopes `openid profile email groups`, flux `authorization_code`).
En démo, une ligne de `DEMO_OAUTH_CLIENTS` (`clientId|Nom|secret|redirect|post-logout|homeUrl|icône|backchannel`), par exemple pour LoussaHousing sur le port 3000 :

```
loussahousing|LoussaHousing|demo-loussahousing-client-secret|http://localhost:3000/api/auth/rocket/callback|http://localhost:3000/connexion?logged_out=1|http://localhost:3000|i-lucide-house|http://host.docker.internal:3000/api/auth/rocket/backchannel
```
(adresse de back-channel joignable depuis le conteneur Rocket Auth). Côté LoussaHousing : `ROCKET_AUTH_URL=http://localhost:8100`, `ROCKET_AUTH_CLIENT_ID=loussahousing`,
`ROCKET_AUTH_CLIENT_SECRET=demo-loussahousing-client-secret`.

## Vérifications
- `npm run check:rocket-auth` : signature JWKS (clé valide, falsifiée, autre clé, `alg` none/HS256), émetteur, audience, expiration, type `logout+jwt`, PKCE, rôles, retour interne seulement.
- `npm run check:policy` : routes dans la table des permissions.
- Non testé de bout en bout contre un vrai Rocket Auth (pas lancé localement).

## Plus tard
Phase 2 : secret client dans le coffre du compte ; fermeture de la seule session concernée (`sid`) au lieu de toutes ; rafraîchissement des rôles sans reconnexion.
