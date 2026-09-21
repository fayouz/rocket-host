# Feuille de route V3 — inspirée de WelcomeScreen

Inventaire des fonctionnalités de <https://welcomescreen.com> (produit commercial d'accueil des voyageurs), relevé le 2026-09-21, pour les
reproduire **à notre façon** dans une V3. On reprend les idées, jamais leurs textes, visuels, marque ni code : tout est à concevoir et écrire nous-mêmes.

## Ce que fait WelcomeScreen (résumé)

| Fonction | Ce que ça apporte |
|---|---|
| **Écran d'accueil sur la TV du logement** | La TV salue le voyageur par son prénom, affiche ses dates d'arrivée et de départ, le Wi-Fi, des conseils locaux. |
| **Automatisation Google TV** | L'écran s'affiche tout seul quand le voyageur allume la TV (appli connectée une fois). Compatible avec les boîtiers de streaming courants. |
| **Livret d'accueil mobile** | Page web (accessible par QR code) : infos du logement, règles, arrivée/départ, attractions proches, aux couleurs du propriétaire. |
| **IA** | Suggestions d'expériences locales, planificateur de séjour, « concierge » qui répond aux questions sur le logement ; formule « messagerie IA » pour répondre aux voyageurs. |
| **Tableau de bord hôte** | Un seul endroit pour modifier le contenu de tous les logements et de tous les écrans. |
| **Personnalisation** | Logo, couleurs, ambiance propre à chaque propriétaire. |
| **Intégration PMS** | Récupère automatiquement nom, dates… depuis le logiciel de gestion (chez nous : Lodgify). |
| **Boutique d'extras** | Le voyageur réserve des « plus » (chef à domicile, fleurs, bois de chauffage, activités) depuis le livret. |
| **Monétisation** | Carrousel d'annonces sur la TV avec QR code : commission sur les activités réservées (programme d'affiliation). |
| **Réservations directes** | Lien vers le site du propriétaire pour les séjours suivants. |
| **Avis** | Objectif : transformer un bon séjour en avis 5 étoiles. |

## Ce que LoussaHousing a déjà (bases réutilisables)

- **Données du séjour** : voyageur, dates, horaires de check-in/out, canal, e-mail — lus dans Lodgify.
- **Code d'accès** : codes clavier Nuki calculés par réservation (valables de l'arrivée au départ).
- **Pages publiques sans compte** : le mécanisme « lien secret + QR code » du stock (`/r/<jeton>`) et le routage Traefik qui les laisse passer sans mot de passe.
- **Messages** : historique Lodgify, règles de messages automatiques, e-mails rattachés aux réservations.
- **Tableau de bord par logement** et **architecture ouverte** (fournisseurs remplaçables ; Home Assistant prévu un jour par logement, ce qui ouvre la porte à la TV).

## Découpage proposé pour la V3

1. **Livret d'accueil par logement** (le plus utile, le moins cher) — page mobile `/g/<jeton>` par logement :
   Wi-Fi, règles, arrivée et départ, plan d'accès, adresses utiles, conseils locaux, FAQ ; contenu modifiable dans l'appli ; FR/EN ; QR code imprimable (déjà maîtrisé avec le stock).
2. **Personnalisation par séjour** — un lien par réservation (`/g/<jeton-séjour>`) : prénom, dates, **code de la serrure valable pendant le séjour**, heure de check-out ; le lien est envoyé dans le message « instructions d'accès » (règle Lodgify existante ou n8n).
3. **Écran TV** — page plein écran `/tv/<jeton>` (accueil du voyageur du jour, Wi-Fi, météo, conseils) ; d'abord ouverte à la main sur la TV (navigateur ou boîtier), puis automatisée via Home Assistant / Google TV.
4. **Marque** — logo, couleurs, ton, réglables par logement (Réglages).
5. **Extras et avis** (plus tard) — demandes d'extras (simples formulaires transmis par e-mail) ; message de demande d'avis après le départ (workflow n8n) ; lien vers le site de réservation directe.
6. **IA concierge** (à évaluer, dernier) — répondre aux questions du voyageur sur la base du contenu du livret ; à traiter avec prudence (données personnelles, coût des appels, validation des réponses).

## À trancher avant de commencer

- Une seule langue (français) ou plusieurs ?
- Le livret est-il par logement seulement, ou aussi par séjour (avec le code de porte) ? Le code d'accès dans une page web demande un lien secret par séjour, à durée limitée.
- La monétisation (affiliation) est-elle voulue ? Elle suppose de s'inscrire à des programmes tiers et d'afficher de la publicité.
- Matériel TV : boîtier Google TV / Chromecast déjà présent dans les logements ?

## Autre idée V3 : suivi des clés de chaque logement (traceur)

Besoin : savoir, pour chaque logement, quelles clés existent, où elles sont et qui les a (ménage, dépannage, voyageur, boîte à clés).

**Inventaire dans l'appli** (simple, sans matériel) : une fiche par clé (logement, porte concernée, exemplaire n°, type : clé, badge, télécommande), un détenteur actuel
(moi, une personne de « Contacts », boîte à clés, dans le logement), et un **historique** (qui l'a prise, quand, rendue quand). Alerte « clé non rendue » à date d'échéance.
Scan d'un QR code sur l'étiquette de la clé pour la sortir ou la rendre, sur le modèle des pages publiques à lien secret déjà en place pour le stock.

**Traceur matériel, selon ce qui est réaliste** (à valider avant de choisir) :
- **AirTag / Tile / SmartTag (Samsung)** : pratiques pour retrouver un objet, mais **pas d'interface ouverte** pour qu'une application les lise automatiquement (elles passent par les applications des constructeurs). Utilisable seulement à la main.
- **Étiquettes Bluetooth (BLE) + Home Assistant** : un relais Bluetooth dans le logement (ESPHome ou boîtier HA) détecte si l'étiquette de la clé est **présente ou absente** du logement. C'est le plus fiable pour « la clé est-elle dans l'appartement ? » et cela s'accorde avec le principe prévu d'un Home Assistant par logement.
- **Traceur GPS** avec interface ouverte : plus cher (abonnement), utile seulement pour une clé qui voyage beaucoup ; portée et batterie à étudier.
- **Boîte à clés connectée** (type Nuki Keypad / boîte à code avec journal) : journal des ouvertures, à regarder si le fournisseur propose une interface.

**À trancher** : suivi manuel seul, ou aussi de la présence automatique (matériel à acheter) ? combien de clés par logement ? clés confiées à des tiers (ménage) : à tracer nominativement ?
