# Déploiement (appli + n8n + Traefik + HTTPS)

Un seul `docker compose up -d` sur un petit serveur (VPS Linux, environ 4 à 6 €/mois) avec Docker installé.

## Avant de démarrer

1. **Domaine** : crée deux enregistrements DNS vers l'IP du serveur : `app.<domaine>` et `n8n.<domaine>`.
2. **Ports 80 et 443 ouverts** sur le serveur (Traefik obtient le certificat HTTPS tout seul via Let's Encrypt).
3. Copie le projet sur le serveur et crée le fichier `.env` (modèle : `.env.example`) avec :

| Variable | Valeur |
|---|---|
| `LODGIFY_API_KEY`, `NUKI_API_TOKEN` | tes clés |
| `WEBHOOK_TOKEN` | `openssl rand -hex 24` |
| `DOMAIN` | `exemple.fr` |
| `ACME_EMAIL` | ton e-mail (alertes d'expiration de certificat) |
| `IMAP_PASSWORD` | mot de passe de la boîte e-mail (facultatif ; le reste se règle dans Réglages > E-mail) |
| `N8N_ENCRYPTION_KEY` | `openssl rand -hex 24` (**à sauvegarder** : sans elle, les identifiants enregistrés dans n8n sont perdus) |

## Lancer

```bash
docker compose up -d --build
docker compose logs -f
```

- Tableau de bord : `https://app.<domaine>` (connexion par compte, voir §Comptes et connexion plus bas).
- n8n : `https://n8n.<domaine>` (au premier lancement, n8n te fait créer le compte propriétaire).

## Brancher n8n sur l'appli

Dans n8n, le nœud HTTP Request appelle l'appli **en interne** : `POST http://app:3000/api/cleaning-tasks`
avec l'en-tête `Authorization: Bearer <WEBHOOK_TOKEN>`. Ce chemin est public au niveau Traefik (comme les pages du ménage) : c'est le jeton, pas un compte, qui protège l'accès.
Voir `docs/n8n-cleaning-sync.md`.

## Sauvegardes

Les volumes Docker `appdata` (base SQLite : réglages, codes clavier, règles de messages, **et les documents déposés dans `.data/documents/`**) et `n8ndata` (workflows) contiennent tout :
sauvegarde-les régulièrement. Les documents (factures, taxes, assurances) sont des données sensibles : ils ne sont jamais dans git ni dans l'image Docker, et ne sont servis qu'à un compte connecté et autorisé (voir §Comptes et connexion).

## À prévoir

- Les pages ouvertes par QR code (ménage, stock) restent des routeurs Traefik séparés (`app-public`), publics par construction (lien secret non devinable), indépendants du mot de passe Traefik qui n'existe plus (voir §Comptes et connexion).
- Traefik lit la liste des conteneurs via `socket-proxy` (lecture seule) et non le socket Docker directement : c'est voulu,
  ne le remplace pas par un montage direct de `/var/run/docker.sock`.
- Premier essai : décommente la ligne `caserver` (staging Let's Encrypt) dans `docker-compose.yml` pour éviter la limite de
  certificats en cas d'erreur de DNS, puis retire-la une fois que tout marche (et vide le volume `letsencrypt`).
- **SELinux** (Oracle Linux, Fedora) : le service `socket-proxy` a `security_opt: label=disable`, sinon il ne peut pas ouvrir
  le socket Docker et Traefik ne trouve aucun service (tout répond 404, le filtre répond 503). Sans effet sur Ubuntu/Debian.
- **Limite Docker Hub** : les téléchargements anonymes sont limités par adresse IP. Si `docker compose pull` répond
  « toomanyrequests », fais `docker login`, ou utilise `ghcr.io/n8n-io/n8n:latest` pour n8n.

## Ce qui a été testé

Sur un Mac (Podman, interface compatible Docker), en mode démo et avec de fausses valeurs : construction de l'image de l'appli,
démarrage des 4 services, découverte des services par Traefik via `socket-proxy` (écritures refusées : 403), redirection HTTP vers HTTPS,
connexion par compte (401 sans session, 200 avec le bon compte), n8n joignable et joignant l'appli en interne,
en-têtes de sécurité. **Non testé** : l'obtention du certificat Let's Encrypt (demande un vrai domaine joignable depuis Internet).

## Développement local (noms `*.local`)

Pour tester toute la pile sur ton Mac avec des noms plutôt que des ports :

1. Ajoute dans `/etc/hosts` (droits administrateur) :
   `127.0.0.1 traefik.local n8n.local loussahousing.local`
2. Crée `.env.local` (non versionné, voir `docker-compose.local.yml`) avec `DOMAIN=local`, `ACME_EMAIL`, `APP_HOST=loussahousing.local`,
   `N8N_HOST=n8n.local`, `TRAEFIK_HOST=traefik.local`, `TRAEFIK_DASHBOARD=true`, `N8N_ENCRYPTION_KEY`,
   et `HTTP_PORT=8080`, `HTTPS_PORT=8443` et `HTTPS_REDIRECT_TO=:8443` (Podman rootless ne publie pas les ports < 1024 ; la redirection HTTP→HTTPS doit alors viser le port 8443).
3. Lance : `docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env --env-file .env.local up -d --build`
4. Ouvre `https://loussahousing.local:8443`, `https://n8n.local:8443`, `https://traefik.local:8443`.
   Le certificat est **auto-signé** (Let's Encrypt refuse `*.local`) : le navigateur affiche un avertissement à accepter,
   ou installe un certificat local de confiance avec `mkcert`.

Seul Traefik publie des ports : l'appli et n8n ne sont pas exposés directement.

**Attention** : si `N8N_ENCRYPTION_KEY` change alors que le volume `n8ndata` existe déjà, n8n refuse de démarrer
(« Mismatching encryption keys »). Garde la même clé, ou supprime le volume si rien d'important n'y est stocké.

## Comptes et connexion (nouveau)

L'appli a maintenant sa propre page de connexion (`docs/plan-gestion-utilisateurs.md`). Au **premier démarrage en production**, le compte `admin` est créé avec le mot de passe de `ADMIN_INITIAL_PASSWORD`
(12 caractères au moins, pas un mot de passe courant) ; l'appli **refuse de démarrer** sans lui, ou si un compte utilise encore un mot de passe par défaut. Ce mot de passe est à **changer dès la première connexion** (l'appli l'exige).
`SESSION_SECRET` est facultatif (sinon une clé est générée dans le volume, `.data/session-secret`). **Le mot de passe Traefik (`ADMIN_USERS`) a été retiré le 2026-09-23** : l'appli protège déjà tout elle-même (comptes, rôles, refus par défaut sur toute route hors pages publiques à jeton) — la double authentification n'apportait plus rien. Les pages du ménage (QR) et les appels de n8n ne demandent pas de connexion (jetons).

Les comptes se gèrent ensuite dans **Réglages > Utilisateurs** (invitations par lien à usage unique). Pour envoyer l'invitation par e-mail, configure d'abord **Réglages > E-mail** ; sinon copie le lien à la main. `LH_MAIL_DRYRUN=1` (tests uniquement) construit les messages sans les envoyer.
