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
