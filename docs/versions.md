# Versions de LoussaHousing

## V1 — socle (début du projet)
Tableau de bord Nuxt lisant Lodgify : page **Aujourd'hui** (arrivées, départs, turnovers) et **Rentabilité** (revenus et occupation par mois).

## V2 — version actuelle (construite)
**Organisation** : logements en base (associés à Lodgify, renommables, nom court repris de Lodgify) ; une page par logement avec menu vertical
(Réservations, Serrures, Codes, Timeline, Stock, QR code ménage, Documents, Bilan, Contacts) ; page Aujourd'hui en deux colonnes (journée / widgets et timeline commune).

**Exploitation** : codes clavier Nuki par réservation (création sur clic) ; ménages et messages calculés d'après Lodgify ; stock par logement (OK / Bas / Vide, QR code, panier Amazon pré-rempli) ;
documents par logement et bilan annuel ; **explorateur de fichiers** façon Finder (menu Documents + onglet Fichiers de chaque logement : dossiers et sous-dossiers, glisser-déposer, renommer, aperçu, recherche, étiquettes de couleur filtrables) ; mini CRM (comptable, artisans…, historique, relances) ; imports de factures et de relevés (n8n, IMAP).

**E-mail** (`docs/mail.md`) : lecture, envoi (SMTP), dossiers de la boîte, rangement automatique (copie + original dans « Traité » ou « Archive »), rattachement aux réservations et aux contacts.

**Sécurité** :
- Protection **contre les requêtes venant d'un autre site (CSRF)** : toute écriture dont l'origine n'est pas l'appli est refusée (403) ; les appels de n8n (serveur à serveur) passent. Vérifiée : trois cas refusés, usage normal et n8n intacts.
- Secrets uniquement dans `.env` (jamais en base ni renvoyés au navigateur) ; jetons secrets pour n8n et pour les pages ménage ; rien de personnel dans git.
- Fichiers déposés : types autorisés, contenu vérifié, taille limitée, noms générés ; e-mails affichés en texte seul.
- Déploiement : Traefik (HTTPS, mot de passe, limitation de débit sur les pages publiques), filtre d'accès à Docker en lecture seule.

**Non fait / à valider** : rangement des e-mails jamais lancé sur la vraie boîte ; HTTPS Let's Encrypt jamais testé ; codes Nuki jamais créés sur la vraie serrure ; workflows n8n non montés ; Git non choisi. Détail dans la mémoire du projet.

## Chantier en cours — client Rocket PMS
Voir `docs/rocket-pms.md` : LoussaHousing sait parler à Rocket PMS (fayouz/rocket-pms), débranché tant que `PMS_API_URL` n'est pas dans `.env`.
Tranches branchées : logements + réservations, conversation, prix, serrures/codes, domotique, documents, stock (V1 du client) ;
puis (branche `feature/pms-v2`) livret du séjour + écran TV, e-mails Rocket Mailer, bilan PMS et ménages Rocket Place en lecture ;
menu Administration rangé par brique (Rocket PMS / Place / Mailer / Cloud / local) avec état de chaque brique et liens facultatifs `PMS_FRONT_URL` / `PLACE_FRONT_URL`.

## Chantier en cours — Rocket Auth (connexion unique)
Branche `feature/rocket-auth` : LoussaHousing client OpenID Connect de Rocket Auth (code + PKCE, jeton vérifié par JWKS, comptes associés par e-mail,
rôles d'après les groupes, déconnexion chez Rocket Auth et back-channel logout, sélecteur d'applications de la suite). Débranché tant que `ROCKET_AUTH_URL`
est vide ; connexion locale gardée pendant la transition. Voir `docs/rocket-auth.md`.

## V3 — plus tard
Voir `docs/roadmap-v3.md` : livret d'accueil et écran TV inspirés de WelcomeScreen, séjour personnalisé, extras, avis, IA, suivi des clés par traceur.

## Prochain chantier — connecteurs d'import
Voir `docs/connecteurs-imports.md` : Free, TotalEnergies, assurances, banques ; API d'abord, puis e-mails, scraping n8n en dernier recours ; configuration dans Réglages > Connecteurs.

## Idées notées, pas encore développées
- **Autres idées (2026-09-22)** : voir `docs/idees-futures.md` (score de préparation, échéances administratives, taxe de séjour, export comptable, entretien récurrent, mode hors ligne, suivi énergie, notifications push, avis clients).
- **Boutique d'upsell par logement** (V3) : voir `docs/roadmap-v3.md`.
- **Assistant de tâches pour le ménage** (wizard, checklist, photos, stock intégré, accès compte + lien secret) : voir `docs/plan-assistant-menage.md`.

## Chantiers avant mise en ligne
- **Gestion des utilisateurs** (prérequis) : `docs/plan-gestion-utilisateurs.md` — connexion et rôles faits (admin, gestionnaire, comptable, ménage ; périmètre par logement ; Swagger généré depuis la table des permissions) ; gestion des comptes par l'administrateur faite (création, invitations à lien unique, désactivation, journal). « mot de passe oublié » en libre-service et script de secours faits. Pas de double authentification. Reste : bascule en production.
- **Hébergement gratuit** : `docs/hebergement-gratuit.md` — Oracle Always Free en tête (offre ARM réduite à 2 processeurs / 12 Go en 2026, risque de récupération), serveur maison + Cloudflare Tunnel, petit VPS payant en plan B ; les offres gratuites qui s'endorment (Render, Koyeb) sont écartées.

## Chantier transverse — intégration continue
Voir `docs/plan-integration-continue.md` : GitHub Actions gratuit (types, build, tests, secrets, image Docker), aucun service réel ni secret dans la CI ; livraison continue plus tard.

## V4 — marketing automation (plus tard)
Voir `docs/roadmap-v4.md` : base voyageurs avec consentement, scénarios après séjour (avis, réservation directe), remplissage des creux du calendrier, segments et campagnes, mesure ;
tout envoi validé par Faez avant départ, désinscription et règles des plateformes respectées. S'appuie sur la V3 (livret, avis).
