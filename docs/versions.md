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

## V3 — plus tard
Voir `docs/roadmap-v3.md` : livret d'accueil et écran TV inspirés de WelcomeScreen, séjour personnalisé, extras, avis, IA, suivi des clés par traceur.

## Prochain chantier — connecteurs d'import
Voir `docs/connecteurs-imports.md` : Free, TotalEnergies, assurances, banques ; API d'abord, puis e-mails, scraping n8n en dernier recours ; configuration dans Réglages > Connecteurs.

## V4 — marketing automation (plus tard)
Voir `docs/roadmap-v4.md` : base voyageurs avec consentement, scénarios après séjour (avis, réservation directe), remplissage des creux du calendrier, segments et campagnes, mesure ;
tout envoi validé par Faez avant départ, désinscription et règles des plateformes respectées. S'appuie sur la V3 (livret, avis).
