# Plan — gestion des utilisateurs (avant toute mise en ligne)

Statut : **étapes U1 (socle), U2 (rôles et périmètre), U3 et U4 (gestion des comptes par l'administrateur, invitations, journal) construites et testées** ; le **« mot de passe oublié » en libre-service** est fait ; reste la bascule en production (U6). Un **Swagger** est maintenu (voir §9). Choix technique : sessions par cookie chiffré avec les outils de h3 déjà présents (aucune dépendance ajoutée) plutôt que `nuxt-auth-utils` ; pas de double authentification (décision du user).

## 1. Constat

- Aujourd'hui l'appli **n'a aucun compte** : elle est protégée par **Traefik** (mot de passe unique `ADMIN_USERS`, middleware `admin-auth`). Les pages publiques (`/r/…`, `/api/r/…`, ressources statiques) contournent ce mot de passe ; le webhook n8n passe par un jeton (`WEBHOOK_TOKEN`) sans Traefik.
- Sur ton Mac, personne d'autre n'y accède : en ligne, **toute personne qui a le mot de passe voit tout** (codes des serrures, voyageurs, e-mails, Bilan) et peut agir (créer un code Nuki, supprimer des documents, demain commander le chauffage).
- Un mot de passe partagé ne dit pas **qui a fait quoi**, ne se révoque pas par personne et n'a pas de double authentification.

## 2. Objectifs

1. Un **compte par personne**, avec **rôles** et, si besoin, limité à certains logements.
2. **Authentification solide** : mots de passe robustes (12 caractères au moins), verrouillage contre les essais répétés, sessions courtes. **Pas de double authentification** (décision du user, 2026-09-21) ; elle pourra s'ajouter plus tard sans refaire le reste.
3. **Refus par défaut** : toute nouvelle route est protégée tant qu'on ne la déclare pas publique.
4. **Journal d'audit** : qui a créé un code, supprimé un document, commandé un appareil.
5. Ne rien casser : pages publiques du ménage (QR), webhook n8n, retour OAuth Homey.

## 3. Rôles (validés par le user le 2026-09-21)

| Rôle | Peut | Ne peut pas |
|---|---|---|
| **Administrateur** (toi) | Tout : réglages, connecteurs, utilisateurs, secrets liés (Homey, e-mail), suppression | — |
| **Gestionnaire** | Réservations, codes, messages, stock, documents, Bilan, domotique (lecture/commande) sur ses logements | Réglages sensibles (IMAP, Homey, utilisateurs), suppression de comptes |
| **Comptable / lecture seule** | Documents et Bilan (en lecture), export CSV | Voyageurs, codes de serrure, e-mails, domotique |
| **Ménage** | Ses tâches et le stock de ses logements, page mobile simple | Tout le reste |

Chaque compte a une **liste de logements autorisés** (Gaston, Le ponant, ou les deux). Les pages publiques à jeton du ménage (QR) restent telles quelles.

## 4. Deux approches, à combiner

| Approche | Apport | Limite |
|---|---|---|
| **A. Comptes dans l'appli** (recommandée) avec `nuxt-auth-utils` : session par cookie chiffré, hachage des mots de passe, prise en charge des clés d'accès (passkeys) | Rôles et logements autorisés **dans** l'appli, journal d'audit, invitations, aucun service externe | À coder et tester soigneusement |
| **B. Protection en amont** : **Cloudflare Access** (gratuit jusqu'à 50 utilisateurs, à vérifier) ou Authelia, devant l'appli | Connexion par Google / GitHub / e-mail avec double authentification déjà faite ; personne n'atteint l'appli sans être passé par là | Ne gère pas les rôles ni les logements autorisés ; dépend d'un tiers ; suppose un nom de domaine chez Cloudflare |

**Reco** : A **d'abord** (indispensable pour les rôles), B **en plus** plus tard si l'hébergement s'y prête (défense en profondeur). Le mot de passe unique de Traefik est retiré une fois A en place (ou gardé comme seconde barrière pour l'administration).

## 5. Fonctionnement prévu (approche A)

- **Comptes** : table `user` (e-mail, nom, rôle, actif, hachage du mot de passe, secret de double authentification, dernière connexion) et table de liaison `user_logement`.
- **Pas d'inscription libre** : l'administrateur **invite** par e-mail (l'envoi SMTP existe) ; le lien est à **usage unique et à durée limitée**.
- **Premier administrateur** (décision du user, 2026-09-21 : un seul compte au départ, `admin`) :
  - **En développement (sur le Mac)** : le compte `admin` est créé au premier démarrage avec le mot de passe `admin`, pour pouvoir avancer sans friction. Ce mot de passe **n'existe qu'en mode développement**.
  - **Changement obligatoire** : à la première connexion, l'appli **exige un nouveau mot de passe** avant tout autre écran.
  - **En production (en ligne)** : l'appli **refuse de démarrer** si un compte utilise encore un mot de passe par défaut, et le compte `admin` est créé par une commande unique (ou un jeton à usage unique) avec un mot de passe choisi. Un `admin:admin` accessible depuis Internet serait pris d'assaut en quelques minutes par des robots.
  - Un test de la CI vérifie qu'aucun mot de passe par défaut n'est accepté en mode production.
- **Mots de passe** : hachage moderne (scrypt ou argon2id), longueur minimale, refus des mots de passe courants ; **réinitialisation par e-mail** (jeton à usage unique).
- **Double authentification : non retenue** (décision du user). Compensations : mots de passe longs, verrouillage, limitation par adresse, sessions de 2 h d'inactivité, HTTPS obligatoire, mot de passe Traefik conservé en seconde barrière pour l'administration. À reconsidérer si l'appli est exposée durablement (clés d'accès possibles plus tard).
- **Session** : cookie `HttpOnly`, `Secure`, `SameSite=Lax`, expiration après inactivité et durée maximale, déconnexion partout, liste des appareils.
- **Protection contre les essais répétés** : limitation de débit et verrouillage temporaire par compte et par adresse ; messages d'erreur identiques (ne pas révéler si un compte existe).
- **Refus par défaut** : un intergiciel serveur (`server/middleware/auth.ts`) exige une session pour tout `/api/**` et toute page, sauf une **liste blanche courte** : connexion, pages et API du ménage à jeton (`/r/`, `/api/r/`), webhook n8n (jeton `WEBHOOK_TOKEN`), état de santé. Les rôles et les logements autorisés sont vérifiés **côté serveur** (jamais seulement en masquant un bouton), y compris sur `/api/logements/[id]/**`.
- **Existant conservé** : protection anti-CSRF ; retour OAuth Homey réservé à un administrateur connecté (le cookie d'état reste) ; jeton Homey et mot de passe IMAP inaccessibles hors administrateur.
- **Journal d'audit** : table `audit_log` (qui, quoi, quand, sur quel logement, adresse) pour les actions sensibles : connexion, échec, création de code, suppression, commande d'appareil, changement de rôle ; consultable par l'administrateur.
- **Interface** : page de connexion en français, Réglages > Utilisateurs (inviter, rôle, logements, désactiver, révoquer les sessions), page « Mon compte » (mot de passe, double authentification).

## 6. Étapes

| # | Étape | Contenu | Effort |
|---|---|---|---|
| **U0** | Décisions | Rôles, personnes concernées, méthode de double authentification, Cloudflare Access ou non | 0,5 j |
| **U1** ✅ | Socle | Tables, connexion / déconnexion, compte `admin` de départ, sessions, changement de mot de passe obligatoire, verrouillage, journal (connexions), refus par défaut (tout est réservé à l'administrateur en attendant U2) | fait |
| **U2** ✅ | Refus par défaut + rôles | Table des permissions unique (`server/utils/policy.ts`), contrôle par rôle et par logement sur les 98 routes et les pages, menus adaptés au rôle, explorateur en lecture seule pour le comptable | fait |
| **U3** ✅ | Comptes et invitations | Création de comptes par l'administrateur, invitations et réinitialisation du mot de passe (lien à usage unique, affiché une fois, envoi par e-mail sur clic) | fait |
| **U4** ✅ | Audit et interface | Réglages > Utilisateurs (comptes, journal), Mon compte | fait |
| **U5** ✅ (script) | Tests automatiques | **Matrice d'autorisation** `scripts/authz-matrix.mjs` : 589 vérifications, chaque route avec chaque rôle et sans session ; reste à l'intégrer à la CI (`docs/plan-integration-continue.md`) | fait |
| **U6** | Bascule | Retrait (ou maintien) du mot de passe Traefik, test complet avant mise en ligne | 0,5 j |

## 7. Points de vigilance

- Une route oubliée = fuite de données : d'où le **refus par défaut** et la **matrice de tests**, à ne pas négliger.
- Le journal d'audit contient des données personnelles : accès réservé à l'administrateur, durée de conservation limitée.
- Les comptes du ménage et du comptable sont des **données de tiers** : jamais dans git.
- Les appels de l'appli vers l'extérieur (Lodgify, Nuki, Homey) se font avec les jetons du serveur, pas ceux des utilisateurs : seul le rôle autorisé déclenche l'action.

## 8. À trancher avant de commencer

1. ~~Qui aura un compte ?~~ **Réponse : un seul compte `admin` au départ** (mot de passe de développement `admin`, changement obligatoire, interdit en production). Les autres comptes (comptable, ménage, gestionnaire) plus tard.
2. ~~Rôles~~ **Réponse : les quatre rôles du §3 sont validés** (administrateur, gestionnaire, comptable / lecture seule, ménage).
3. ~~Double authentification~~ **Réponse : aucune.**
4. ~~Cloudflare Access~~ **Réponse : non**, authentification dans l'appli seule.
5. ~~Comptes par e-mail~~ **Réponse : oui**, invitation et réinitialisation par e-mail (SMTP OVH existant).
6. ~~Mot de passe Traefik~~ **Réponse : gardé** en seconde barrière.

## 9. Table des permissions et Swagger (maintenus ensemble)

- **Source unique** : `server/utils/policy.ts` liste chaque route (méthode, chemin, rôles, périmètre, résumé). L'appli s'en sert pour **appliquer** les droits ET pour **générer** la documentation : elle ne peut pas diverger.
- **Swagger** : page **Réglages > API (Swagger)** (`/docs-api`, administrateur) ; spécification OpenAPI 3 : `/api/docs/openapi.json` (administrateur). Swagger UI est hébergé par l'appli (`public/_docs-ui`, copié depuis `swagger-ui-dist` au lancement de `npm run dev` / `build`), sans CDN.
- **Ajouter une route** : créer le fichier dans `server/api`, puis **ajouter sa ligne dans `policy.ts`** (sinon elle est refusée). `npm run check:policy` liste les écarts (98 routes / 98 lignes aujourd'hui) : à brancher sur la CI.
- **Périmètre `handler`** : la route filtre elle-même selon les logements autorisés (`scopeOf`, `assertLogement`). C'est le cas de la liste des logements, Aujourd'hui, la timeline, l'explorateur (liste, dossier, dépôt, étiquettes) et le niveau de stock.
- **Matrice de tests** : `node scripts/authz-matrix.mjs <http://localhost:PORT> <base SQLite de TEST>` (jamais sur une base réelle : elle crée des comptes et supprime des données). Vérifie sans session → 401, rôle interdit → 403, logement interdit → 403, cas autorisés → ni 401 ni 403, filtrage des listes, pages. Testée aussi par **mutation** : contrôle du périmètre, des rôles ou de la session désactivé volontairement → le script détecte 49, 276 et 89 échecs.
- **Limites actuelles** : sans interface pour créer des comptes (étape U3), les comptes se créent à la main en base ; le gestionnaire n'a pas encore accès aux contacts, à l'e-mail ni aux réglages (réservés à l'administrateur) ; le ménage n'a que le stock de ses logements (les pages par QR restent publiques).

## 10. Gestion des comptes par l'administrateur (Réglages > Utilisateurs)

- **Créer** : identifiant (minuscules, chiffres, `. _ -`), nom, e-mail facultatif, rôle, logements autorisés. Le compte est créé **sans mot de passe** (impossible de s'y connecter) jusqu'à l'activation.
- **Invitation** : lien personnel **à usage unique**, valable **72 h** (24 h pour une réinitialisation), **affiché une seule fois** à l'administrateur ; seul son **hachage** est enregistré. L'administrateur peut aussi l'**envoyer par e-mail d'un clic** (avec confirmation) ; jamais d'envoi automatique. Un nouveau lien annule les précédents. La personne choisit son mot de passe (12 caractères au moins) sur la page publique `/activation`.
- **Réinitialiser** un mot de passe = nouveau lien ; l'activation ferme les autres sessions du compte.
- **Modifier** rôle, logements, e-mail : effet **immédiat** (relus à chaque requête). **Désactiver** : sessions coupées tout de suite, connexion refusée ; **Réactiver** : le mot de passe est conservé. **Fermer les sessions** : déconnexion forcée. **Supprimer** : définitif (le journal garde l'identifiant).
- **Garde-fous** : on ne peut ni se supprimer, ni se désactiver, ni se retirer le rôle d'administrateur ; il reste toujours un administrateur actif.
- **Journal** (onglet Journal) : connexions, échecs, gestion des comptes, sans mot de passe ni lien. Limitation des essais de lien : 20 par 10 minutes et par adresse.
- **Tests** (copie isolée, 107 routes) : matrice d'autorisation 630 vérifications, 0 échec ; parcours complet vérifié (création, invitation, activation, réutilisation refusée, expiration, réinitialisation, changement de rôle immédiat, désactivation, fermeture des sessions, garde-fous, aucun jeton ni mot de passe dans le journal ni en base). Envoi d'e-mail testé **à blanc uniquement** (`LH_MAIL_DRYRUN=1`, aucun message envoyé).
- **Limites** : les e-mails (invitation, mot de passe oublié) partent de la boîte configurée dans Réglages > E-mail (IMAP/SMTP) : il faut l'avoir configurée, sinon l'administrateur transmet le lien lui-même. Ces e-mails ne sont **pas copiés** dans le dossier « Envoyés » (le lien secret ne reste pas dans la boîte).

## 11. Mot de passe oublié (libre-service)

- **Parcours** : lien « Mot de passe oublié ? » sur la page de connexion → page publique `/mot-de-passe-oublie` (identifiant **ou** adresse e-mail) → e-mail avec un lien personnel (**valable 1 heure, à usage unique**) → `/activation` pour choisir un nouveau mot de passe (les autres sessions du compte sont fermées).
- **Aucune fuite sur l'existence d'un compte** : la réponse est **toujours la même et immédiate** (l'envoi se fait en arrière-plan), que le compte existe, soit inconnu, désactivé, sans e-mail, etc.
- **Garde-fous** : 5 demandes par adresse et par 10 minutes (sinon 429) ; **un seul lien par compte toutes les 5 minutes** ; plafond de 30 e-mails par heure au total ; aucun envoi pour un compte désactivé, en attente d'invitation, sans e-mail, ou dont l'adresse est partagée par plusieurs comptes.
- **Journal** (administrateur) : chaque demande est tracée avec sa suite (`oubli_envoye`, `oubli_demande` + motif, `oubli_echec`), sans jeton ni lien.
- **Secours** : `node scripts/reset-password.mjs <identifiant> <base sqlite> <adresse du site>` (à lancer **sur le serveur**) affiche un lien à usage unique de 1 heure, sans envoyer d'e-mail ; utile si l'administrateur est enfermé dehors et que l'e-mail n'est pas configuré. Tracé dans le journal (`reinitialisation_secours`).
- **Tests** (copie isolée, envoi à blanc) : réponses et temps identiques compte existant / inconnu, jeton d'1 h créé sans administrateur, délai de garde, limite par adresse, cas sans envoi (désactivé, en attente, sans e-mail, adresse partagée), script de secours, journal sans secret, matrice d'autorisation 630/630.
