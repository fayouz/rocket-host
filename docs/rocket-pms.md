# Client Rocket PMS

LoussaHousing peut devenir client de l'API de **Rocket PMS** (`fayouz/rocket-pms`, brique privée du Middleware Rocket qui
gère les logements, réservations Lodgify, serrures Nuki, domotique et documents). Ce chantier est **désactivé par défaut** :
tant que `.env` ne contient pas `PMS_API_URL`, rien ne change (Lodgify et Nuki restent appelés en direct, comme avant).

## Activer

```
# .env
PMS_API_URL=https://pms.exemple.tld
PMS_API_TOKEN=rpm_xxxxxxxx   # jeton d'application créé dans Rocket PMS > Applications
```

Le jeton n'est jamais renvoyé au navigateur (comme les autres secrets de l'appli, voir `server/utils/pms.ts`).

## Ce qui est branché (première tranche)

- `server/utils/pms.ts` : client typé (`pmsEnabled`, `pmsProperties`, `pmsBookings`, `pmsLoadData`, `pmsHealth`).
- `server/utils/lodgify.ts::loadData()` bascule sur `pmsLoadData()` quand `PMS_API_URL` est renseigné : logements
  (associés à Lodgify) et réservations (60 derniers jours + à venir) viennent alors de Rocket PMS plutôt que de Lodgify
  en direct. Le reste de l'appli (tableau de bord, logements, timeline, stock…) ne change pas : il continue de lire
  `loadData()` et de raisonner avec l'identifiant Lodgify du logement.
- `GET /api/pms/status` + ligne d'état dans Réglages > Plugins.

## Limite connue de cette tranche

Les réservations qui viennent du PMS n'ont pas de `threadUid` (le fil de conversation Lodgify n'est pas exposé par
`GET /api/properties/{id}/bookings`) : le rattachement automatique des e-mails par fil de conversation ne fonctionne
donc pas encore pour ces réservations. À corriger en même temps que la conversation (voir ci-dessous).

## Tranches branchées ensuite (même drapeau `PMS_API_URL`)

Tout passe par `server/utils/pms.ts` ; le logement est traduit de l'identifiant Lodgify vers l'uuid PMS (`pmsPropertyId`).

1. **Conversation** : `conversation.get.ts` lit le fil via `pmsConversation` (les e-mails rattachés restent locaux) ;
   `conversation.post.ts` répond via `pmsReply`, uniquement sur le clic Envoyer (même `messageId`, envoi idempotent).
2. **Prix** : `pricing.get.ts` renvoie `pmsPricing` (même format).
3. **Serrures et codes** : décision prise, **la source de vérité est le PMS / Rocket Place** quand le PMS est actif.
   `nuki.ts::loadLocks` → `pmsLocks`, `codes.ts::planCodes` → `pmsCodes`, `codes.ts::sendCode` → `pmsSendCode`
   (écriture sur la serrure uniquement sur clic confirmé) ; la table locale `access_code` n'est alors ni lue ni écrite.
   L'onglet Réservations affiche le code exposé par le PMS (`pmsAccessByBooking`).
4. **Domotique** : `domotique.get.ts` ajoute `pms.sections` (connecteurs du lieu, lecture seule), affiché en tête de
   l'onglet Domotique. La configuration Homey locale reste inchangée.
5. **Documents** : `GET /api/logements/:id/pms-documents` (+ `/:itemId` pour télécharger) : bloc « Documents du lieu
   (Rocket Place) » au-dessus de l'explorateur local, en lecture.
6. **Stock** : `stock.get.ts` renvoie les niveaux du lieu (`pms: true`), modifiables via
   `PUT /api/logements/:id/pms-stock/:levelId` ; le catalogue se gère dans Rocket Place.

## Tranche 2 (branche `feature/pms-v2`, même drapeau)

7. **Livret et écran TV** : `GET /api/logements/:id/pms-livret` (lien TV, visites 30 jours, aperçu du contenu, lien vers
   l'éditeur du front PMS `…/properties/<uuid>?tab=livret`), affiché en tête de l'onglet Livret. Par réservation (colonne
   droite de l'onglet Réservations, composant `PmsBookingPanel`) : `GET …/reservations/:bookingId/guest-link` (lien
   `/g/<token>` du front PMS + QR code) et `POST …/guest-link` `{ channel: lodgify|email, messageId }` = bouton
   « Envoyer le livret », **uniquement après confirmation** (messageId du navigateur : double clic = un seul envoi).
8. **E-mails** (Rocket Mailer via le PMS) : `GET …/reservations/:bookingId/emails`, `GET …/emails/:conversationId`
   (texte seul) et `POST …/emails` `{ subject, text, messageId }` (formulaire de la réservation, envoi au clic confirmé).
9. **Bilan** : `GET /api/logements/:id/pms-bilan?year=` et `GET /api/logements/:id/pms-bilan.csv?year=` ; l'onglet Bilan
   affiche alors le bilan du PMS (revenus, charges, catégories, mois, liste des dépenses/recettes). La saisie et
   l'import des dépenses se font dans Rocket PMS (pas d'écriture depuis LoussaHousing).
10. **Ménages** : `GET /api/logements/:id/pms-menages` lit les événements `cleaning` de la timeline du PMS (14 jours
    passés, 60 à venir), affichés en lecture seule en tête de l'onglet Timeline.

`GET /api/logements/:id` renvoie `pms: true|false` : l'interface bascule sur ces blocs seulement si le PMS est actif.

Limites connues (côté PMS) :
- Le PMS n'expose pas les tâches de ménage Rocket Place ni leur lien secret `/m/<token>` : pas de lien direct vers la
  page ménage de Rocket Place, les ménages sont lus via la timeline (libellé, date, état, personne).
- La timeline du PMS (`GET …/timeline`) planifie les codes et synchronise les ménages au passage (écriture côté
  Rocket Place déclenchée par une lecture).

Côté serveurs, Rocket PMS et Rocket Place acceptent les jetons d'application sans usurpation (`X-Impersonate-User`
absent) sur leurs routes métier seulement (voters `PMS_*` / `PLACE_*`), jamais sur l'administration.

## Démo locale complète

Configurations `.claude/launch.json` : `rocket-place-api` (8900), `rocket-pms-api` (8700), `loussahousing-demo` (3010,
avec `PMS_API_URL=http://localhost:8700` et le jeton de démo `rpm_demo_rocket_pms_do_not_use_in_production`).
Semer d'abord Rocket Place puis Rocket PMS : `DEMO_MODE=1 php bin/console app:demo:seed` dans chaque `backend/`.

## Vérifier après une modification

```
npx nuxi typecheck
npm run check:policy
```
