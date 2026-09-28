// TABLE DES PERMISSIONS : source unique de verite pour les roles ET pour la documentation Swagger (/docs-api, /api/docs/openapi.json).
// Refus par defaut : une route absente de cette table est refusee (403). Le script `npm run check:policy` verifie que chaque fichier de
// server/api figure ici (a lancer apres tout ajout de route ; a brancher sur la CI).
//
// Roles : A = administrateur, G = gestionnaire, C = comptable (lecture), M = menage, P = public (jeton ou sans session).
// Perimetre (colonne 5) : logement = :id est un logement ; document = :docId ; node = :id de l'explorateur ; booking = :bookingId ;
//                         handler = le gestionnaire de route filtre lui-meme (query, corps, liste) ; '' = sans perimetre.
// Format de chaque ligne (parse par scripts/check-policy.mjs) : ['METHODE', '/api/chemin/:param', 'roles', 'Resume', 'perimetre', 'Tag', 'Corps (facultatif)'],
export type Role = 'admin' | 'gestionnaire' | 'comptable' | 'menage'
export type Scope = '' | 'logement' | 'document' | 'node' | 'booking' | 'handler'
export interface Rule { method: string; path: string; roles: string; summary: string; scope: Scope; tag: string; body?: string; re: RegExp; params: string[] }

const RAW: [string, string, string, string, Scope, string, string?][] = [
  // --- Compte et acces public
  ['POST', '/api/auth/login', 'P', 'Connexion (ouvre une session)', '', 'Compte', '{ username, password }'],
  ['POST', '/api/auth/forgot', 'P', 'Mot de passe oublie : envoie un lien de reinitialisation par e-mail (reponse identique que le compte existe ou non)', '', 'Compte', '{ identifier }'],
  ['GET', '/api/auth/activate', 'P', 'Verifier un lien d\'invitation ou de reinitialisation (jeton secret)', '', 'Compte', '?token='],
  ['POST', '/api/auth/activate', 'P', 'Choisir son mot de passe avec un lien a usage unique', '', 'Compte', '{ token, password }'],
  ['GET', '/api/auth/rocket/login', 'P', 'Rocket Auth : redirection vers la connexion unique (code + PKCE ; actif si ROCKET_AUTH_URL)', '', 'Compte', '?next='],
  ['GET', '/api/auth/rocket/callback', 'P', 'Rocket Auth : retour de connexion (state, nonce, jeton verifie par JWKS), ouvre la session', '', 'Compte', '?code=&state='],
  ['POST', '/api/auth/rocket/backchannel', 'P', 'Rocket Auth : back-channel logout (logout_token signe) : ferme les sessions du compte', '', 'Compte', 'logout_token (form)'],
  ['GET', '/api/auth/rocket/config', 'P', 'Rocket Auth actif ? connexion locale gardee ?', '', 'Compte'],
  ['GET', '/api/auth/rocket/apps', 'AGCM', 'Applications de la suite Rocket (selecteur, lu chez Rocket Auth)', '', 'Compte'],
  ['POST', '/api/auth/logout', 'AGCM', 'Deconnexion (et adresse de fin de session Rocket Auth si connexion unique)', '', 'Compte'],
  ['GET', '/api/auth/me', 'AGCM', 'Utilisateur connecte', '', 'Compte'],
  ['GET', '/api/theme', 'AGCM', 'Couleurs de l\'appli (accent, neutre), partagees par toute l\'equipe', '', 'Compte'],
  ['PUT', '/api/theme', 'A', 'Modifier les couleurs de l\'appli', '', 'Compte', '{ primaryColor?, neutralColor? }'],
  ['POST', '/api/auth/password', 'AGCM', 'Changer son mot de passe (ferme les autres sessions)', '', 'Compte', '{ current, next }'],
  ['GET', '/api/r/:token', 'P', 'Page menage : etat du stock du logement (lien secret)', '', 'Public (jeton)'],
  ['PUT', '/api/r/:token', 'P', 'Page menage : signaler un niveau de stock (lien secret)', '', 'Public (jeton)'],
  ['POST', '/api/cleaning-tasks', 'P', 'Webhook n8n : taches de menage (Authorization: Bearer WEBHOOK_TOKEN)', '', 'Webhooks (jeton)'],
  ['POST', '/api/import/documents', 'P', 'Webhook n8n : import d\'un document (Bearer WEBHOOK_TOKEN)', '', 'Webhooks (jeton)'],
  ['POST', '/api/import/transactions', 'P', 'Webhook n8n : import de lignes de releve (Bearer WEBHOOK_TOKEN)', '', 'Webhooks (jeton)'],
  // --- Logements
  ['GET', '/api/logements', 'AGCM', 'Liste des logements (filtree selon les logements autorises)', 'handler', 'Logements'],
  ['GET', '/api/logements/:id', 'AGCM', 'Fiche d\'un logement', 'logement', 'Logements'],
  ['PUT', '/api/logements/:id', 'A', 'Renommer un logement / changer sa couleur', 'logement', 'Logements'],
  ['POST', '/api/logements/:id/sync-name', 'A', 'Reprendre le nom court de Lodgify', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/reservations', 'AG', 'Reservations du logement', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/reservations/:bookingId/conversation', 'AG', 'Fil de conversation Lodgify d\'une reservation (texte)', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/reservations/:bookingId/pricing', 'AG', 'Valeur d\'une reservation et detail du calcul (devis Lodgify)', 'logement', 'Logements'],
  ['POST', '/api/logements/:id/reservations/:bookingId/conversation', 'AG', 'Envoyer un message au voyageur (pousse sur Airbnb/Booking)', 'logement', 'Logements', '{ text, messageId }'],
  ['GET', '/api/logements/:id/reservations/:bookingId/guest-link', 'AG', 'Lien voyageur (livret Rocket PMS) d\'une reservation + QR code', 'logement', 'Livret d\'accueil'],
  ['POST', '/api/logements/:id/reservations/:bookingId/guest-link', 'AG', 'Envoyer le livret au voyageur via Rocket PMS (clic confirme)', 'logement', 'Livret d\'accueil', '{ channel: lodgify|email, messageId, text?, lang? }'],
  ['GET', '/api/logements/:id/reservations/:bookingId/emails', 'AG', 'E-mails Rocket Mailer rattaches a la reservation (Rocket PMS)', 'logement', 'Logements'],
  ['POST', '/api/logements/:id/reservations/:bookingId/emails', 'AG', 'Envoyer un e-mail au voyageur via Rocket PMS / Rocket Mailer', 'logement', 'Logements', '{ subject, text, messageId }'],
  ['GET', '/api/logements/:id/reservations/:bookingId/emails/:conversationId', 'AG', 'Messages d\'une conversation e-mail de la reservation (Rocket PMS)', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/pms-livret', 'AG', 'Livret et ecran TV du logement dans Rocket PMS (liens, visites)', 'logement', 'Livret d\'accueil'],
  ['GET', '/api/logements/:id/pms-menages', 'AG', 'Menages Rocket Place du logement (lecture, via Rocket PMS)', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/pms-bilan', 'AGC', 'Bilan annuel calcule par Rocket PMS', 'logement', 'Bilan et documents'],
  ['GET', '/api/logements/:id/pms-bilan.csv', 'AGC', 'Export CSV du bilan Rocket PMS', 'logement', 'Bilan et documents'],
  ['GET', '/api/logements/:id/locks', 'AG', 'Serrures du logement', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/codes', 'AG', 'Codes clavier des reservations a venir', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/timeline', 'AG', 'Chronologie du logement', 'logement', 'Logements'],
  ['GET', '/api/logements/:id/stock', 'AGM', 'Stock du logement', 'logement', 'Logements'],
  ['PUT', '/api/logements/:id/pms-stock/:levelId', 'AGM', 'Changer un niveau de stock du lieu (Rocket PMS actif)', 'logement', 'Logements', '{ level }'],
  ['GET', '/api/logements/:id/pms-documents', 'AGC', 'Documents du lieu via Rocket PMS (lecture)', 'logement', 'Bilan et documents'],
  ['GET', '/api/logements/:id/pms-documents/:itemId', 'AGC', 'Telecharger un document du lieu via Rocket PMS', 'logement', 'Bilan et documents'],
  ['GET', '/api/logements/:id/bilan', 'AGC', 'Bilan annuel', 'logement', 'Bilan et documents'],
  ['GET', '/api/logements/:id/documents.csv', 'AGC', 'Export CSV des fichiers comptables', 'logement', 'Bilan et documents'],
  ['GET', '/api/logements/:id/domotique', 'AG', 'Reglages domotique et simulation', 'logement', 'Domotique'],
  ['PUT', '/api/logements/:id/domotique', 'A', 'Modifier les reglages domotique (connexion, regle)', 'logement', 'Domotique'],
  ['POST', '/api/logements/:id/domotique/test', 'AG', 'Verifier la connexion Homey (sans lire les appareils)', 'logement', 'Domotique'],
  ['POST', '/api/logements/:id/domotique/discover', 'AG', 'Decouvrir les appareils Homey (lecture seule)', 'logement', 'Domotique'],
  ['GET', '/api/logements/:id/domotique/guest-devices', 'AG', 'Appareils mis a disposition du voyageur', 'logement', 'Domotique'],
  ['PUT', '/api/logements/:id/domotique/guest-devices', 'AG', 'Choisir les appareils et bornes de temperature pour le voyageur', 'logement', 'Domotique', '{ devices: [{deviceId, deviceName, deviceClass, minTemp?, maxTemp?}] }'],
  // --- Vues agregees
  ['GET', '/api/today', 'AG', 'Journee : arrivees, departs, menages (filtre selon les logements autorises)', 'handler', 'Vues agregees'],
  ['GET', '/api/dashboard/smart', 'AG', 'Tableau de bord intelligent : arrivees/departs croises avec Clean, Place, Stock, Cast, alertes et finances (filtre selon les logements autorises)', 'handler', 'Vues agregees', '?properties='],
  ['GET', '/api/timeline', 'AG', 'Chronologie de tous les logements autorises', 'handler', 'Vues agregees'],
  ['GET', '/api/profit', 'A', 'Rentabilite (tous logements)', '', 'Vues agregees'],
  ['GET', '/api/locks', 'A', 'Toutes les serrures Nuki', '', 'Vues agregees'],
  ['GET', '/api/codes', 'A', 'Tous les codes clavier', '', 'Vues agregees'],
  ['POST', '/api/codes/:bookingId', 'AG', 'Creer le code sur la serrure Nuki (action sur la porte)', 'booking', 'Codes'],
  // --- Documents
  ['PUT', '/api/documents/:docId', 'AG', 'Modifier un fichier importe (type, montant, logement)', 'document', 'Bilan et documents'],
  ['DELETE', '/api/documents/:docId', 'AG', 'Supprimer un fichier importe', 'document', 'Bilan et documents'],
  ['GET', '/api/documents/:docId/file', 'AGC', 'Telecharger / voir le fichier', 'document', 'Bilan et documents'],
  // --- Explorateur de fichiers
  ['GET', '/api/explorer/list', 'AGC', 'Contenu d\'un dossier, recherche, filtre par etiquette ou par type', 'handler', 'Explorateur'],
  ['POST', '/api/explorer/folder', 'AG', 'Creer un dossier', 'handler', 'Explorateur', '{ logement, parent?, name }'],
  ['POST', '/api/explorer/upload', 'AG', 'Deposer des fichiers (multipart)', 'handler', 'Explorateur'],
  ['PATCH', '/api/explorer/:id', 'AG', 'Renommer / deplacer / typer un fichier (type, date, montant : Bilan)', 'node', 'Explorateur', '{ name?, parent?, fileType?, date?, amount?, note? }'],
  ['DELETE', '/api/explorer/:id', 'AG', 'Supprimer (dossier : tout son contenu)', 'node', 'Explorateur'],
  ['GET', '/api/explorer/:id/file', 'AGC', 'Telecharger / voir un fichier', 'node', 'Explorateur'],
  ['GET', '/api/explorer/tags', 'AGC', 'Etiquettes et compteurs', '', 'Explorateur'],
  ['POST', '/api/explorer/tags', 'AG', 'Creer une etiquette', '', 'Explorateur', '{ name, color? }'],
  ['PATCH', '/api/explorer/tags/:tagId', 'AG', 'Renommer / recolorer une etiquette', '', 'Explorateur'],
  ['DELETE', '/api/explorer/tags/:tagId', 'A', 'Supprimer une etiquette', '', 'Explorateur'],
  ['POST', '/api/explorer/tags/assign', 'AG', 'Poser / retirer des etiquettes', 'handler', 'Explorateur', '{ nodes[], add?[], remove?[] }'],
  // --- Stock
  ['GET', '/api/stock', 'A', 'Stock de tous les logements', '', 'Stock'],
  ['POST', '/api/stock/items', 'A', 'Ajouter un article au catalogue', '', 'Stock'],
  ['PUT', '/api/stock/items/:id', 'A', 'Modifier un article', '', 'Stock'],
  ['DELETE', '/api/stock/items/:id', 'A', 'Supprimer un article', '', 'Stock'],
  ['PUT', '/api/stock/level', 'AGM', 'Changer un niveau de stock', 'handler', 'Stock', '{ propertyId, itemId, level }'],
  ['PUT', '/api/stock/track', 'A', 'Suivre / ne plus suivre un article pour un logement', '', 'Stock'],
  ['POST', '/api/stock/token', 'A', 'Generer le lien secret (QR) d\'un logement', '', 'Stock'],
  ['GET', '/api/stock/qr/:propertyId', 'A', 'QR code du lien menage', '', 'Stock'],
  // --- Contacts
  ['GET', '/api/contacts', 'A', 'Contacts', '', 'Contacts'],
  ['POST', '/api/contacts', 'A', 'Creer un contact', '', 'Contacts'],
  ['PUT', '/api/contacts/:id', 'A', 'Modifier un contact', '', 'Contacts'],
  ['DELETE', '/api/contacts/:id', 'A', 'Supprimer un contact', '', 'Contacts'],
  ['POST', '/api/contacts/:id/interactions', 'A', 'Ajouter une interaction', '', 'Contacts'],
  ['DELETE', '/api/contacts/:id/interactions/:iid', 'A', 'Supprimer une interaction', '', 'Contacts'],
  // --- E-mail (boite de l'administrateur)
  ['GET', '/api/mail/folders', 'A', 'Dossiers de la boite', '', 'E-mail'],
  ['POST', '/api/mail/folders', 'A', 'Creer un dossier', '', 'E-mail'],
  ['POST', '/api/mail/folders/rules', 'A', 'Creer une regle de dossier', '', 'E-mail'],
  ['DELETE', '/api/mail/folders/rules/:id', 'A', 'Supprimer une regle de dossier', '', 'E-mail'],
  ['GET', '/api/mail/messages', 'A', 'Messages', '', 'E-mail'],
  ['GET', '/api/mail/messages/:id', 'A', 'Un message', '', 'E-mail'],
  ['GET', '/api/mail/messages/:id/attachments/:n', 'A', 'Piece jointe', '', 'E-mail'],
  ['POST', '/api/mail/messages/:id/save-attachment', 'A', 'Enregistrer une piece jointe comme document', '', 'E-mail'],
  ['GET', '/api/mail/messages/:id/suggest', 'A', 'Suggestions de rattachement', '', 'E-mail'],
  ['POST', '/api/mail/messages/:id/links', 'A', 'Rattacher un message', '', 'E-mail'],
  ['DELETE', '/api/mail/messages/:id/links', 'A', 'Retirer un rattachement', '', 'E-mail'],
  ['GET', '/api/mail/targets', 'A', 'Cibles de rattachement', '', 'E-mail'],
  ['POST', '/api/mail/relink', 'A', 'Relancer l\'association', '', 'E-mail'],
  ['POST', '/api/mail/send', 'A', 'Envoyer un message (SMTP)', '', 'E-mail'],
  ['POST', '/api/mail/smtp-test', 'A', 'Tester l\'envoi', '', 'E-mail'],
  ['POST', '/api/mail/sync', 'A', 'Synchroniser les en-tetes', '', 'E-mail'],
  ['POST', '/api/mail/file', 'A', 'Ranger des messages', '', 'E-mail'],
  ['PUT', '/api/mail/filing-settings', 'A', 'Reglages du rangement', '', 'E-mail'],
  ['DELETE', '/api/mail/cache', 'A', 'Vider le cache d\'en-tetes', '', 'E-mail'],
  // --- Reglages, imports, IMAP, Homey (administration)
  ['GET', '/api/settings', 'A', 'Reglages generaux', '', 'Administration'],
  ['PUT', '/api/settings', 'A', 'Modifier les reglages generaux', '', 'Administration'],
  ['GET', '/api/imap', 'A', 'Configuration et etat IMAP', '', 'Administration'],
  ['PUT', '/api/imap/config', 'A', 'Modifier la configuration IMAP', '', 'Administration'],
  ['POST', '/api/imap/detect', 'A', 'Detecter le service e-mail', '', 'Administration'],
  ['POST', '/api/imap/rules', 'A', 'Creer une regle IMAP', '', 'Administration'],
  ['PUT', '/api/imap/rules/:id', 'A', 'Modifier une regle IMAP', '', 'Administration'],
  ['DELETE', '/api/imap/rules/:id', 'A', 'Supprimer une regle IMAP', '', 'Administration'],
  ['POST', '/api/imap/run', 'A', 'Lancer un releve IMAP', '', 'Administration'],
  ['POST', '/api/imap/test', 'A', 'Tester la connexion IMAP', '', 'Administration'],
  ['GET', '/api/imports', 'A', 'Imports a classer et journal', '', 'Administration'],
  ['POST', '/api/imports/assign-transactions', 'A', 'Affecter des lignes importees a un logement', '', 'Administration'],
  ['DELETE', '/api/imports/log', 'A', 'Vider le journal des imports', '', 'Administration'],
  ['DELETE', '/api/imports/transactions', 'A', 'Supprimer des lignes importees', '', 'Administration'],
  ['GET', '/api/homey/connect', 'A', 'Demarrer l\'autorisation OAuth Homey (redirection)', '', 'Homey'],
  ['GET', '/api/homey/callback', 'A', 'Retour de l\'autorisation OAuth Homey', '', 'Homey'],
  ['POST', '/api/homey/disconnect', 'A', 'Deconnecter le compte Homey', '', 'Homey'],
  ['GET', '/api/homey/homeys', 'A', 'Homey du compte connecte', '', 'Homey'],
  ['GET', '/api/plugins', 'A', 'Bibliotheque de plugins', '', 'Plugins et connecteurs'],
  ['GET', '/api/pms/status', 'A', 'Etat de la connexion a Rocket PMS (si PMS_API_URL est renseigne)', '', 'Plugins et connecteurs'],
  ['GET', '/api/logements/:id/connectors', 'A', 'Connecteurs du logement', 'logement', 'Plugins et connecteurs'],
  ['POST', '/api/logements/:id/connectors', 'A', 'Ajouter un connecteur', 'logement', 'Plugins et connecteurs', '{ pluginId, name, config }'],
  ['PUT', '/api/connectors/:cid', 'A', 'Modifier un connecteur', '', 'Plugins et connecteurs', '{ name?, config?, enabled? }'],
  ['DELETE', '/api/connectors/:cid', 'A', 'Supprimer un connecteur', '', 'Plugins et connecteurs'],
  ['POST', '/api/connectors/:cid/test', 'A', 'Tester la connexion (lecture seule)', '', 'Plugins et connecteurs'],
  ['GET', '/api/connectors/:cid/info', 'A', 'Informations lues sur le service', '', 'Plugins et connecteurs'],
  ['POST', '/api/connectors/:cid/actions/:actionId', 'A', 'Lancer une action manuelle (confirmee)', '', 'Plugins et connecteurs'],
  ['POST', '/api/connectors/:cid/import', 'A', 'Recuperer les documents du service dans l\'explorateur', '', 'Plugins et connecteurs'],
  // --- Livret d'accueil (V3)
  ['GET', '/api/logements/:id/livret', 'AG', 'Contenu du livret d\'accueil, pour edition', 'logement', 'Livret d\'accueil'],
  ['PUT', '/api/logements/:id/livret', 'AG', 'Enregistrer le livret d\'accueil', 'logement', 'Livret d\'accueil'],
  ['POST', '/api/logements/:id/livret/token', 'A', 'Regenerer le lien secret du livret', 'logement', 'Livret d\'accueil'],
  ['GET', '/api/logements/:id/livret/qr', 'AG', 'QR code du livret d\'accueil', 'logement', 'Livret d\'accueil'],
  ['POST', '/api/logements/:id/livret/background', 'AG', 'Deposer l\'image de fond propre au logement (multipart)', 'logement', 'Livret d\'accueil'],
  ['DELETE', '/api/logements/:id/livret/background', 'AG', 'Retirer le fond propre au logement (revient au fond general)', 'logement', 'Livret d\'accueil'],
  ['PUT', '/api/logements/:id/livret/background-web', 'AG', 'Choisir une image web (Openverse) comme fond du logement', 'logement', 'Livret d\'accueil', '{ url, attribution }'],
  ['PUT', '/api/logements/:id/livret/background-mode', 'AG', 'Forcer aucun fond, ou revenir au fond general', 'logement', 'Livret d\'accueil', '{ mode: inherit|none }'],
  ['PUT', '/api/logements/:id/livret/animated', 'AG', 'Activer/desactiver l\'animation du fond pour ce logement', 'logement', 'Livret d\'accueil', '{ animated }'],
  ['GET', '/api/logements/:id/livret/search', 'AG', 'Rechercher des images de fond libres de droits (Openverse)', 'logement', 'Livret d\'accueil', '?q='],
  ['PUT', '/api/logements/:id/livret/layout', 'AG', 'Navigation (defilement/onglets) et nombre de colonnes', 'logement', 'Livret d\'accueil', '{ navMode, gridColumns }'],
  ['GET', '/api/logements/:id/livret/pages', 'AG', 'Pages du livret/ecran TV (regroupement de widgets)', 'logement', 'Livret d\'accueil'],
  ['POST', '/api/logements/:id/livret/pages', 'AG', 'Creer une page', 'logement', 'Livret d\'accueil', '{ label, icon }'],
  ['PUT', '/api/logements/:id/livret/pages-order', 'AG', 'Reordonner les pages', 'logement', 'Livret d\'accueil', '{ order: number[] }'],
  ['PUT', '/api/logements/:id/livret/pages/:pageId', 'AG', 'Renommer une page', 'logement', 'Livret d\'accueil', '{ label, icon }'],
  ['DELETE', '/api/logements/:id/livret/pages/:pageId', 'AG', 'Supprimer une page (ses widgets deviennent non assignes)', 'logement', 'Livret d\'accueil'],
  ['PUT', '/api/logements/:id/livret/pages/:pageId/widgets-order', 'AG', 'Reordonner les widgets d\'une page', 'logement', 'Livret d\'accueil', '{ order: string[] }'],
  ['PUT', '/api/logements/:id/livret/widgets/:widgetId/page', 'AG', 'Assigner un widget a une page (ou l\'en retirer)', 'logement', 'Livret d\'accueil', '{ pageId: number|null }'],
  ['POST', '/api/logements/:id/livret/pages/:pageId/background', 'AG', 'Deposer l\'image de fond propre a une page (multipart)', 'logement', 'Livret d\'accueil'],
  ['DELETE', '/api/logements/:id/livret/pages/:pageId/background', 'AG', 'Retirer le fond propre a une page (revient au fond du logement)', 'logement', 'Livret d\'accueil'],
  ['PUT', '/api/logements/:id/livret/pages/:pageId/background-web', 'AG', 'Choisir une image web (Openverse) comme fond d\'une page', 'logement', 'Livret d\'accueil', '{ url, attribution }'],
  ['GET', '/api/g/:token/background', 'P', 'Image de fond propre au logement (lien secret)', '', 'Public (jeton)'],
  ['GET', '/api/g/:token/pages/:pageId/background', 'P', 'Image de fond propre a une page (lien secret)', '', 'Public (jeton)'],
  ['GET', '/api/g/:token/devices', 'P', 'Appareils domotiques mis a disposition du voyageur, etat en direct (lien secret)', '', 'Public (jeton)'],
  ['PUT', '/api/g/:token/devices/:deviceId', 'P', 'Commander un appareil mis a disposition (lien secret, bornes verifiees)', '', 'Public (jeton)', '{ capabilityId, value }'],
  ['GET', '/api/bg-default', 'P', 'Image de fond par defaut des reglages generaux', '', 'Public (jeton)'],
  ['GET', '/api/g/:token', 'P', 'Page publique du livret d\'accueil (lien secret)', '', 'Public (jeton)'],
  ['GET', '/api/tv/:token', 'P', 'Page TV plein ecran (meme lien secret) : accueil du voyageur du jour + livret', '', 'Public (jeton)'],
  // --- Reglages generaux du livret/ecran TV (V3)
  ['GET', '/api/settings/welcomescreen', 'A', 'Reglages generaux du fond par defaut', '', 'Reglages'],
  ['PUT', '/api/settings/welcomescreen', 'A', 'Activer/desactiver l\'animation par defaut', '', 'Reglages', '{ animated }'],
  ['POST', '/api/settings/welcomescreen/background', 'A', 'Deposer le fond par defaut (multipart)', '', 'Reglages'],
  ['DELETE', '/api/settings/welcomescreen/background', 'A', 'Retirer le fond par defaut', '', 'Reglages'],
  ['PUT', '/api/settings/welcomescreen/background-web', 'A', 'Choisir une image web (Openverse) comme fond par defaut', '', 'Reglages', '{ url, attribution }'],
  ['GET', '/api/settings/welcomescreen/search', 'A', 'Rechercher des images de fond libres de droits (Openverse)', '', 'Reglages', '?q='],
  ['GET', '/api/settings/welcomescreen/stats', 'A', 'Tableau de bord : ouvertures du livret par logement', '', 'Reglages'],
  // --- Utilisateurs (administrateur)
  ['GET', '/api/users', 'A', 'Liste des comptes et de leurs logements', '', 'Utilisateurs'],
  ['POST', '/api/users', 'A', 'Creer un compte (sans mot de passe : il s\'active par invitation)', '', 'Utilisateurs', '{ username, displayName, email?, role, logements[] }'],
  ['PUT', '/api/users/:id', 'A', 'Modifier nom, e-mail, role, logements, etat actif', '', 'Utilisateurs', '{ displayName, email?, role, logements[], active? }'],
  ['DELETE', '/api/users/:id', 'A', 'Supprimer un compte (jamais soi-meme ni le dernier administrateur)', '', 'Utilisateurs'],
  ['POST', '/api/users/:id/invite', 'A', 'Lien d\'invitation ou de reinitialisation a usage unique (affiche une fois ; envoi par e-mail facultatif)', '', 'Utilisateurs', '{ send?: boolean }'],
  ['POST', '/api/users/:id/revoke-sessions', 'A', 'Fermer toutes les sessions d\'un compte', '', 'Utilisateurs'],
  ['GET', '/api/audit', 'A', 'Journal d\'audit (connexions, gestion des comptes)', '', 'Utilisateurs'],
  // --- Documentation
  ['GET', '/api/docs/openapi.json', 'A', 'Specification OpenAPI (Swagger) generee depuis cette table', '', 'Documentation'],
]

const compile = (p: string) => {
  const params: string[] = []
  const re = new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/:([A-Za-z]+)/g, (_m, n) => { params.push(n); return '([^/]+)' }) + '/?$')
  return { re, params }
}
export const RULES: Rule[] = RAW.map(([method, path, roles, summary, scope, tag, body]) => ({ method, path, roles, summary, scope, tag, body, ...compile(path) }))

export function matchRule(method: string, pathname: string): { rule: Rule; params: Record<string, string> } | null {
  for (const rule of RULES) {
    if (rule.method !== method) continue
    const m = rule.re.exec(pathname)
    if (m) return { rule, params: Object.fromEntries(rule.params.map((n, i) => [n, decodeURIComponent(m[i + 1]!)])) }
  }
  return null
}
const LETTER: Record<Role, string> = { admin: 'A', gestionnaire: 'G', comptable: 'C', menage: 'M' }
export const roleAllowed = (roles: string, role: Role) => roles.includes(LETTER[role])

// --- Pages (memes lettres ; le perimetre `:id` d'une page /logements/:id/... est un logement) ---
export const PAGES: [string, string][] = [
  ['/', 'AG'], ['/logements', 'AGCM'], ['/logements/:id', 'AGCM'],
  ['/logements/:id/reservations', 'AG'], ['/logements/:id/serrures', 'AG'], ['/logements/:id/codes', 'AG'], ['/logements/:id/timeline', 'AG'],
  ['/logements/:id/stock', 'AGM'], ['/logements/:id/qr', 'A'], ['/logements/:id/fichiers', 'AGC'], ['/logements/:id/documents', 'AGC'], ['/logements/:id/bilan', 'AGC'],
  ['/logements/:id/domotique', 'AG'],
  ['/logements/:id/reglement', 'AG'], ['/logements/:id/livret', 'AG'], ['/logements/:id/mails', 'A'], ['/logements/:id/connecteurs', 'A'], ['/logements/:id/contacts', 'A'],
  ['/documents', 'AGC'], ['/contacts', 'A'], ['/mail', 'A'], ['/profit', 'A'],
  ['/settings', 'A'], ['/settings/utilisateurs', 'A'], ['/settings/imap', 'A'], ['/settings/imports', 'A'], ['/settings/plugins', 'A'], ['/settings/stock', 'A'], ['/settings/welcomescreen', 'A'], ['/docs-api', 'A'], ['/changelog', 'A'],
  ['/docs', 'A'], ['/docs/:slug', 'A'],
  ['/mon-compte', 'AGCM'],
]
const PAGE_RULES = PAGES.map(([path, roles]) => ({ path, roles, ...compile(path) }))
export function matchPage(pathname: string) {
  for (const r of PAGE_RULES) {
    const m = r.re.exec(pathname)
    if (m) return { roles: r.roles, params: Object.fromEntries(r.params.map((n, i) => [n, m[i + 1]!])) }
  }
  return null
}
// Page d'accueil selon le role (evite une boucle de redirection : la page doit etre autorisee pour le role)
export const homeFor = (role: Role) => (role === 'comptable' ? '/documents' : role === 'menage' ? '/logements' : '/')
