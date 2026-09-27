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

## Prochaines tranches (non faites)

Chacune doit rester un ajout dans `server/utils/pms.ts`, activé par le même `pmsEnabled()`, jamais un changement de
comportement quand le PMS n'est pas configuré :

1. **Conversation** (`GET`/`POST /api/properties/{id}/bookings/{bookingId}/conversation`) : lecture et réponse au
   voyageur. Écriture uniquement sur clic explicite (comme aujourd'hui avec Lodgify), jamais en tâche de fond ni en test.
2. **Prix d'une réservation** (`GET /api/properties/{id}/bookings/{bookingId}/pricing`).
3. **Serrures et codes** (`GET /api/locks`, `GET /api/properties/{id}/locks`, `GET /api/properties/{id}/codes`,
   `POST /api/codes/{bookingId}`) : plus délicat, car la planification des codes de LoussaHousing (`server/utils/codes.ts`)
   a son propre état local (table `access_code`, statuts `planned/created/error`) et le lien serrure↔logement du PMS
   utilise l'UUID Rocket PMS du logement, pas l'identifiant Lodgify utilisé partout ailleurs dans LoussaHousing. Il faut
   d'abord décider où vit la source de vérité (LoussaHousing ou le PMS) avant de brancher l'écriture.
4. **Domotique** (`GET /api/properties/{id}/domotique`) : infos des connecteurs du logement, en lecture.
5. **Documents** (`/api/properties/{id}/documents`, Rocket Cloud) : à rapprocher de l'explorateur de fichiers existant.

## Vérifier après une modification

```
npx nuxi typecheck
npm run check:policy
```
