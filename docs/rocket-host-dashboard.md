# Tableau de bord intelligent

Quand Rocket PMS est branché (`PMS_API_URL`), l'accueil de Rocket Host (`/`) devient un tableau de bord qui croise les
briques Rocket. Sans PMS, l'accueil historique (`app/components/ClassicHome.vue`, Lodgify en direct) reste affiché.

## Configuration

Chaque brique est facultative : adresse vide = brique masquée (aucun appel, aucune colonne, aucune alerte).
Les jetons sont des jetons d'application de chaque brique, jamais renvoyés au navigateur.

```
PMS_API_URL=…            PMS_API_TOKEN=rpm_…     # obligatoire pour ce tableau de bord
ROCKET_PLACE_URL=…       ROCKET_PLACE_TOKEN=rpl_…
ROCKET_CLEAN_URL=…       ROCKET_CLEAN_TOKEN=rcl_…
ROCKET_STOCK_URL=…       ROCKET_STOCK_TOKEN=rst_…
ROCKET_CAST_URL=…        ROCKET_CAST_TOKEN=rct_…
```

## Architecture

- `server/utils/bricks/http.ts` : appel commun (délai 4 s par appel, 6 s pour le PMS ; réponse plafonnée à 2 Mo ;
  erreur typée `BrickError`). Aucun auto-import Nuxt : la configuration est passée en paramètre.
- `server/utils/bricks/{pms,place,clean,stock,cast}.ts` : clients en lecture seule.
- `server/utils/bricks/smart.ts` : `collectSmartDashboard(configs, { now, allowed })`, appels en parallèle ; chaque
  appel passe par `guard()` : en cas d'échec la brique est marquée en panne, sa donnée est vide, une alerte
  « brique injoignable » est ajoutée, le reste continue.
- `GET /api/dashboard/smart` (rôles admin et gestionnaire, filtré par les logements autorisés et `?properties=`).
- `app/components/SmartDashboard.vue` : bouton Rafraîchir + rafraîchissement automatique toutes les 5 minutes
  (onglet visible), badge d'état par brique, « Source : » sur chaque widget.

La correspondance logement ↔ lieu vient de `GET /api/place-links` du PMS (`placeId` par logement, identifiant partagé
par Place, Clean et Stock). Repli sur `/api/properties` (sans lieu) si Place est injoignable côté PMS.

## Données et règles

| Colonne / widget | Source | Règle |
|---|---|---|
| Arrivées / départs | PMS `/api/properties/{id}/bookings` | aujourd'hui et demain (fuseau Europe/Paris), réservations annulées exclues ; heure = checkIn (16:00 par défaut) / checkOut (11:00) |
| Ménage | Clean `/api/cleanings?date=` (veille, jour, lendemain) | tâche du lieu la veille ou le jour de l'arrivée, la plus proche avant l'heure d'arrivée : fait / en cours / en retard / à faire / aucun |
| Linge | Clean `/api/linen/readiness?place=&date=` | ready / tight / missing ; **404 = colonne masquée** (fonction pas encore livrée, branche `feature/linen`) |
| Accès | PMS (`access` de la réservation) puis Place `/api/places/{id}/access-grants` (externalRef `booking:<id>`) | `created` = envoyé, `planned` ou dates modifiées = à envoyer, `error` = erreur |
| Écran | Cast `/api/screens` | Cast ne connaît pas les lieux : un écran est rattaché si son champ *location* ou son nom contient l'uuid du lieu, l'uuid PMS ou le nom du logement |
| Paiement | PMS `/bookings/{id}/pricing` (`due`, `paid`) | colonne masquée si aucune valeur ; un échec ne marque pas le PMS en panne |
| Départs | Clean | ménage planifié le jour du départ : oui / non |
| Finances du mois | PMS bilan (`months[m].revenue/nights`), repli : réservations au prorata des nuits | occupation = nuits / jours du mois ; canaux d'après `source` des réservations |
| Coût des ménages | Clean `/api/cleanings/export?type=rental&from=&to=` (centimes) | total et par lieu, part des revenus |
| Consommation stock | Stock `/api/export/consumption?usage=rental&from=&to=` | `totalCost` du mois |
| Prévision 30 jours | PMS | réservations confirmées arrivant dans les 30 jours : total, nuits |

Alertes (triées : critique, attention, info ; puis par heure) : ménage non terminé moins de 2 h avant l'arrivée
(critique), aucun ménage / ménage en retard avant une arrivée, accès non envoyé la veille (attention) ou le jour même /
en erreur (critique), écran hors ligne avec arrivée aujourd'hui, départ sans ménage, stock bas ou vide au lieu d'une
arrivée, linge manquant (critique le jour même) ou juste, réservation modifiée après planification du ménage (drapeau
`conflict` de Rocket Clean), brique injoignable (critique pour le PMS). Chaque alerte renvoie à l'onglet du logement.

## Vérifier

```
npm run check:smart-dashboard   # 11 cas avec fetch simulé (pannes, délai, taille, 404 linge, périmètre)
npm run check:policy
```

Démo locale : configuration `rocket-host-demo` de `.claude/launch.json` (PMS 8700, Place 8900, Clean 9000, Stock 9100,
Cast 8600, jetons de démo de chaque brique).

## Limites connues

- Linge : l'API de Rocket Clean n'est pas encore livrée ; le format lu est `{ status | readiness | level }`.
- Écran : rattachement par texte (pas de lien lieu ↔ écran dans Cast).
- Accès : en démo, les lieux Place / Clean / Stock ne partagent pas forcément les mêmes uuid que les `placeId` du PMS,
  d'où « aucun » dans certaines colonnes.
- Lecture seule : aucune action (envoyer un code, planifier un ménage) depuis ce tableau de bord ; les liens mènent aux
  pages existantes.
