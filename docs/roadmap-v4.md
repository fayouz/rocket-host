# Feuille de route V4 — marketing automation

Objectif : faire revenir les voyageurs en **réservation directe** (sans commission de plateforme), obtenir plus d'avis et remplir les creux du calendrier,
en automatisant les messages sans jamais perdre le contrôle. À ne développer qu'une fois la V3 (livret, séjour personnalisé, avis) lancée : la V4 s'appuie dessus.

## Ce qui existe déjà (bases réutilisables)

- **Voyageurs et séjours** : nom, e-mail, dates, canal, nombre de nuits — lus dans Lodgify (`fetchBookings`).
- **Messages** : historique Lodgify, règles de messages automatiques (copiées en base), e-mails rattachés aux réservations.
- **E-mail** : envoi SMTP (`nodemailer`, copie dans Envoyés) et lecture IMAP.
- **Mini CRM** : contacts, interactions, encart « À relancer » (aujourd'hui pour les tiers : comptable, artisans).
- **n8n** : circuit unique pour tout ce qui vient de l'extérieur (`docs/imports-n8n.md`), jeton `WEBHOOK_TOKEN`.
- **Calendrier** : nuits libres et occupation par logement (page Rentabilité).

## Constat dans Lodgify (relevé le 2026-09-21)

- Réservations confirmées, tous séjours : **181 Airbnb, 25 Booking.com, 2 saisies manuelles, aucune réservation via un site de réservation directe.** Le canal direct est donc aujourd'hui inutilisé : c'est le gain potentiel de la V4.
- **Non visible par l'API** : l'adresse du site de réservation directe, les codes promo et les promotions ne sont exposés ni par l'API publique ni dans les fiches logement. À relever à la main dans l'interface Lodgify (site web, promotions) avant de concevoir les scénarios 2 et 4.
- **E-mails des voyageurs** : Airbnb n'en fournit aucun (champ vide sur les 181 réservations) ; Booking.com donne une adresse relais (`guest.booking.com`) ; seules les 2 saisies manuelles ont une vraie adresse. La base voyageurs (étape 1) sera donc quasi vide au départ : elle se remplira avec les **premières réservations directes** et le **livret V3** (recueil volontaire de l'e-mail).

## Découpage proposé

1. **Base voyageurs (fondation)** — une fiche « voyageur » dédoublonnée (e-mail), avec ses séjours, son canal d'origine, son consentement marketing et sa date d'opposition.
   Sans cette base, rien d'autre n'est légal ni fiable.
2. **Scénarios après séjour** (le plus rentable) : remerciement + demande d'avis (J+1) → offre de réservation directe pour une prochaine venue (J+30) → rappel avant la date anniversaire (J+11 mois).
3. **Scénarios autour du séjour** : message avant l'arrivée (extras du livret V3), relance des demandes d'extras, question de satisfaction en cours de séjour (pour désamorcer avant un mauvais avis).
4. **Remplissage des creux** : détection des nuits libres à J-14 / J-7 par logement → suggestion d'une offre ciblée aux anciens voyageurs (code promo, lien de réservation directe).
5. **Segments et campagnes ponctuelles** : anciens voyageurs par logement, par saison, par nombre de séjours ; envoi d'une information (travaux, nouveautés, promotion).
6. **Mesure** : ouvertures/clics simples, réservations directes attribuées (code promo ou lien suivi), coût évité de commission ; tableau dans Rentabilité.

## Règles non négociables

- **Aucun envoi sans validation.** Chaque scénario produit d'abord des messages **en attente** (aperçu, destinataire, texte), que Faez valide un par un ou par lot. Un mode « envoi automatique » ne peut être activé que scénario par scénario, explicitement, et reste désactivable en un clic. (Même principe que le rangement des e-mails : désactivé par défaut, aperçu d'abord.)
- **Consentement et désinscription (RGPD + règles sur la prospection électronique)** : un message de service (code d'accès, consigne de départ) n'est pas du marketing ; une offre commerciale, si. Il faut une base légale claire (consentement recueilli à la réservation directe ou au livret, ou intérêt légitime dans les limites du droit), un **lien de désinscription** dans chaque envoi, et le respect immédiat d'une opposition. À faire relire par un juriste ou l'expert-comptable avant le premier envoi.
- **Plateformes (Airbnb, Booking)** : leurs conditions interdisent en général d'utiliser la messagerie de la plateforme, ou les coordonnées obtenues par elle, pour détourner le voyageur vers une réservation directe. Les scénarios « réservation directe » doivent donc reposer sur un **e-mail obtenu légitimement** (réservation directe, livret d'accueil, formulaire volontaire) et jamais sur la messagerie de la plateforme. À vérifier plateforme par plateforme.
- **Données de tiers** : la base voyageurs ne va jamais dans git, jamais dans les journaux ; export et suppression à la demande d'un voyageur (droit à l'effacement).
- **Pas d'achat de publicité ni d'action payante automatique** : on prépare, Faez valide.

## Architecture ouverte

- Envoi derrière une **interface remplaçable** (SMTP OVH aujourd'hui ; un service d'envoi dédié plus tard si le volume ou la délivrabilité l'exigent). Le SMTP d'une boîte perso n'est pas fait pour des envois en masse : limite de volume à prévoir.
- Scénarios décrits en **données** (déclencheur, délai, segment, modèle de message, canal), pas en code, pour les modifier depuis les Réglages ; modèles avec variables (prénom, logement, dates, lien du livret) et FR/EN.
- Exécution par **n8n** (planification et relances) qui appelle l'appli ; l'appli reste seule à décider qui a le droit de recevoir quoi (consentement, désinscription, fréquence maximale).
- **Fréquence maximale** par voyageur (ex. un message marketing par mois) et journal de tout ce qui est envoyé.

## À trancher avant de commencer

- Canal : e-mail seulement, ou aussi SMS / WhatsApp (coûts, consentement plus strict) ?
- **WhatsApp — organisation par voyageur et par ménage** (demande du 2026-09-22, recherchée le même jour) : chez WhatsApp, un « Channel » est une diffusion à sens unique (newsletter), pas un fil d'échange — ce n'est pas l'outil ici. Avec l'**API officielle WhatsApp Business Platform**, **un seul numéro** gère autant de **conversations séparées** qu'il y a de voyageurs, ouvertes automatiquement dès leur premier message (rien à créer à la main). Répondre est gratuit dans les 24 h suivant un message reçu ; envoyer en premier (ex. rappel avant l'arrivée) coûte par message envoyé (modèle pré-approuvé par WhatsApp) — et à partir d'octobre 2026, même les réponses dans la fenêtre de 24 h deviennent payantes au-delà de 1000 messages gratuits par mois et par numéro.
  - **Situation réelle du user** : numéro perso (WhatsApp classique) pour le ménage, numéro pro (WhatsApp Business, l'appli) pour la clientèle. Il envisageait de tout consolider sur un seul numéro.
  - **Techniquement possible de garder l'appli ET brancher l'API sur le même numéro** : fonction « coexistence » de Meta (disponible partout depuis 2026), le numéro ne change pas, les conversations existantes restent dans l'appli.
  - **Recommandation : NE PAS consolider.** Garder les deux numéros séparés — le pro (déjà en WhatsApp Business) pour la clientèle, à brancher sur l'API le jour venu via la coexistence ; le perso pour le ménage, en usage manuel (l'automatisation n'y apporte rien et évite la vérification Meta + les modèles de message à faire approuver rien que pour ça). Si l'automatisation du ménage devient utile un jour, lui donner son **propre** numéro dédié plutôt que de fusionner avec celui des voyageurs — jamais mélanger les deux publics sur un seul numéro.
- Existe-t-il un site ou une page de réservation directe (Lodgify) et un code promo réel à proposer ? Sans cela, les scénarios 2 et 4 n'ont pas d'objet.
- Volume attendu de voyageurs par an : détermine si un service d'envoi dédié est utile (coût) ou si le SMTP actuel suffit.
- Qui valide les messages (Faez seul, ou aussi une autre personne) ?
- Recueil du consentement : à quel moment (message d'arrivée, livret, formulaire de réservation directe) ?
