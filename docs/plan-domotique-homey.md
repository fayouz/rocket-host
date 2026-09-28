# Plan — domotique de Béglès via Homey Pro (et hub Aqara)

Statut : **brouillon à fignoler** (2026-09-21). Page Domotique en deux onglets (**Appareils**, **Réglages**). **Un Homey est associé explicitement à un logement** (un Homey = un logement, sinon refus) : Le ponant ↔ « Homey Pro de Faez Ponant » ; Gaston : aucun Homey. Construit pour l'instant : la page **Domotique** de chaque logement (réglages de connexion, règle de préchauffage, **simulation** des actions sur les réservations à venir, bornes de sécurité côté serveur). **P0 codé** : « Tester la connexion » (authentification seulement) et « Lancer la découverte » (liste des appareils) en **lecture seule** (`server/utils/homey.ts`), en mode **local** (clé d'API) et en mode **cloud** (OAuth : `server/utils/homeyCloud.ts`, routes `/api/homey/*`), testés sur de faux serveurs Homey/Athom ; **pas encore essayés sur le vrai compte**. Aucune commande n'est envoyée.

## 1. Objectif

Faire piloter par Rocket Host les appareils du logement **Le ponant** (Béglès) à partir des réservations Lodgify : chauffage avant l'arrivée, scènes d'arrivée et de départ,
alertes (porte ouverte, fuite, température anormale). L'appli reste le « cerveau » métier ; Homey est l'exécutant local (principe de `project-open-architecture-home-assistant`).

**Ce qui est acquis** : Homey Pro à Béglès (clé d'API locale possible), HomeKit, hub Aqara. **Ce qui est inconnu** : modèle du hub Aqara, liste des appareils, où tourne l'appli (voir §7).

## 2. Architecture

```
Lodgify (réservations) ─► Rocket Host ──(adaptateur homey.ts)──► Homey Pro ──► appareils (Aqara via Matter/Zigbee, autres)
                              ▲                                       │
                              └────────── événements (alertes) ◄──────┘  (Flows Homey → webhook, à valider)
```

- **Un seul adaptateur** `server/utils/homey.ts` (comme `nuki.ts`) ; le reste de l'appli ne connaît pas Homey. Interface volontairement étroite (§3) pour pouvoir le remplacer par Home Assistant plus tard.
- **Aqara** : arrive dans Homey par Matter Bridge (hub compatible) ou Zigbee direct. Pas d'adaptateur Aqara ; l'API cloud Aqara reste un plan B non prévu.
- **HomeKit** : hors périmètre (fermé aux applications tierces) ; il continue de servir aux usages manuels sur place.

## 3. Interface de l'adaptateur (proposition)

| Fonction | Rôle |
|---|---|
| `listDevices(logement)` | Appareils Homey (id, nom, classe, zone, capacités) |
| `getState(device)` | Lit les capacités (température, onoff, contact, batterie…) |
| `setCapability(device, capability, value)` | Commande (allumer, consigne de température…) — **liste blanche** de capacités |
| `runFlow(flow)` | Déclenche un Flow Homey nommé (scène arrivée / départ) |
| `ping()` | Test de connexion (Réglages) |

Stockage : `logement_homey` (logement_id, url, mode `local|cloud`) en base ; **la clé d'API reste dans `.env`** (`HOMEY_API_KEY_<logement>` ou une seule variable), jamais en base, jamais renvoyée au navigateur.

## 4. Modèle de données

- `logement_homey` : lien logement ↔ Homey (adresse, mode, dernier ping, état).
- `domotique_appareil` : appareils choisis pour un logement (id Homey, nom affiché, rôle : `chauffage`, `capteur_porte`, `scène`…, actif).
- `domotique_regle` : règles (logement, déclencheur, délai, action, actif) — voir §5.
- `domotique_action` : journal de chaque commande (heure, règle, appareil, valeur, résultat, erreur) → alimente la **Timeline** existante (nouveau type d'évènement).

## 5. Règles (premiers scénarios)

Déclencheurs calculés d'après Lodgify (horaires d'arrivée/départ **de chaque réservation**, cf. `check_in.time`), même logique que les codes Nuki :

1. **Préchauffage** : X heures avant l'arrivée → consigne « confort » ; au départ (+ délai) → consigne « éco » ; **pas de préchauffage s'il n'y a pas de réservation**.
2. **Scène d'arrivée / de départ** : lancer un Flow Homey (lumières, volets, mode absent) à l'heure voulue.
3. **Alertes entrantes** (Homey → appli) : porte ouverte après le départ, fuite d'eau, température hors plage ; notification dans l'appli (et e-mail, sur validation).
4. **Séjours consécutifs** : ne pas éteindre entre un départ et une arrivée le même jour (règle de continuité).

## 6. Sécurité et garde-fous (non négociables)

- **Pas d'ouverture de porte ni de serrure via cette voie** : les codes d'accès restent gérés par le circuit Nuki existant. Liste blanche de capacités commandables (température, on/off, scènes) ; toute autre capacité refusée côté serveur.
- **Mode « à blanc » par défaut** : chaque règle commence par **simuler et afficher** ce qu'elle ferait (comme le rangement des e-mails). Activation règle par règle, jamais globale.
- **Bornes** : consigne de température limitée (ex. 16–24 °C), une seule commande par appareil et par créneau, limite de fréquence.
- **Secrets** : clé d'API uniquement dans `.env`, droits minimaux (lire appareils, commander, lancer Flows), jamais dans git ni dans les journaux.
- **Panne** : si Homey est injoignable, nouvel essai puis **alerte visible** ; aucune commande « rattrapée » en retard qui surprendrait un voyageur (péremption d'une action manquée).
- Protection anti-CSRF et jeton pour l'entrée webhook (comme n8n, `WEBHOOK_TOKEN`).

## 7. Décision d'accès réseau (à trancher en premier)

L'API locale de Homey Pro est sur le réseau de Béglès. **Accès local = clé d'API seule** (`Authorization: Bearer`), pas d'« app key » ; l'identifiant + secret OAuth ne servent qu'à l'option B (cloud). Options :

| Option | Avantages | Inconvénients / à vérifier |
|---|---|---|
| **A. Tailscale** (déjà prévu au plan) | Sécurisé, pas d'exposition Internet | Un appareil sur place doit relayer le réseau (Tailscale sur Homey Pro **non vérifié**) |
| **B. API cloud de Homey (OAuth)** | Marche de partout, aucun pont | Client OAuth à créer chez Homey ; dépend du cloud Homey ; jeton d'accès à renouveler |
| **C. L'appli tourne à Béglès** | Accès local direct | Alourdit l'hébergement ; pas cohérent avec l'appli unique |

**Choix du user (2026-09-21) : option B, mode cloud**, implémentée (application OAuth du user, identifiant et secret dans `.env`, jeton de renouvellement dans `.data/homey-oauth.json`). Le mode local reste disponible. Dépend de l'endroit où tourne l'appli.

## 8. Phases

1. **P0 — Découverte** (sans risque) : le user crée la clé d'API ; on lit la liste des appareils et leur état ; page Réglages > Domotique avec « Tester la connexion » et liste des appareils. **Lecture seule.**
2. **P1 — Affectation** : choisir les appareils du logement, leur rôle ; onglet « Domotique » sur la page du logement (état en direct, dernière commande).
3. **P2 — Commande manuelle** : boutons (consigne, scène) avec confirmation, journal d'actions, liste blanche.
4. **P3 — Règles à blanc** : préchauffage/scènes calculés d'après Lodgify, simulés sur la Timeline.
5. **P4 — Règles actives** : activation règle par règle, avec péremption et alerte de panne.
6. **P5 — Alertes entrantes** : Flows Homey → webhook (porte, fuite, température), notifications.
7. **P6 — Extension** : autres logements (autre Homey ou HA), autres capteurs.

## 9. Tests sans matériel

- **Faux serveur Homey** (petit serveur local reproduisant les routes utilisées) pour tester l'adaptateur, les règles, les pannes et les péremptions, comme le bac à sable IMAP.
- Les commandes réelles ne sont jamais lancées avant validation explicite du user, un appareil à la fois, présent sur place.

## 10. Points à trancher

1. Modèle du **hub Aqara** et liste des **appareils** de Béglès (chauffage ? capteurs ? prises ?).
2. **Accès réseau** : A, B ou C (§7) ; où tourne l'appli ?
3. **Premier scénario** à mettre en service (préchauffage, scène, alerte) et **consignes** souhaitées (confort / éco, délai avant l'arrivée).
4. Gaston aussi ? (aujourd'hui : Nuki seulement.)
5. Les alertes doivent-elles aussi partir par e-mail (validation par message, cf. règle d'envoi) ?
6. Utiliser la bibliothèque officielle **`homey-api`** (Node) ou de simples appels HTTP ? À arbitrer après lecture de sa doc et de ses dépendances.
