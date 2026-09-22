# Idées de fonctionnalités notées (pas développées)

Propositions faites le 2026-09-22, en plus des chantiers déjà documentés (V3 : `docs/roadmap-v3.md`, V4 : `docs/roadmap-v4.md`,
assistant ménage : `docs/plan-assistant-menage.md`, connecteurs : `docs/connecteurs-imports.md`). Classées par facilité de mise en œuvre :
toutes s'appuient sur des données déjà présentes dans l'appli, sans nouvelle intégration externe (sauf mention contraire).

## 🟢 Faciles — juste exploiter ce qui existe déjà

1. **Score de préparation avant chaque arrivée** : indicateur en un coup d'œil sur l'accueil (« code créé ✅, ménage fait ✅, stock OK ✅,
   message envoyé ✅ ») pour la prochaine arrivée de chaque logement. Toutes les données existent déjà (codes Nuki, `cleaning_task`, stock,
   messages envoyés) — à rassembler, pas à créer.
2. **Échéances administratives** : ajouter une date d'expiration aux documents des catégories « Assurance » et « Diagnostic / attestation »
   (déjà existantes), avec un rappel avant échéance — même mécanisme que l'encart « À relancer » du mini CRM.
3. **Calcul de la taxe de séjour** : à partir des nuitées déjà lues dans Lodgify (bilan), un montant dû par période de déclaration.
4. **Export annuel pour la comptable** (Violette SERY) : un paquet complet (Bilan + tous les documents de l'année en cours) en un clic,
   au lieu du CSV seul aujourd'hui.

## 🟡 Moyennes — petite extension d'une fonctionnalité existante

5. **Suivi de l'entretien récurrent** des équipements (chaudière, détecteurs de fumée, extincteur, VMC) avec rappel — sur le modèle
   des relances du CRM.
6. **Mode hors ligne (PWA) pour l'assistant ménage** (`docs/plan-assistant-menage.md`) : consulter les tâches et prendre des photos
   sans réseau, synchroniser au retour de connexion.
7. **Suivi de consommation d'énergie par logement** (Enedis Data Connect / GRDF ADICT, déjà repérés et écartés pour l'import de
   factures dans `docs/connecteurs-imports.md`) : remis sur la table ici comme fonctionnalité de **suivi de consommation** (repérer une
   fuite ou une anomalie entre deux séjours), pas comme moyen de récupérer des factures.

## 🔴 Plus gros chantiers — à ne considérer que si le besoin se confirme

8. **Notifications push mobile** (Web Push, gratuit, sans dépendre de Meta/WhatsApp) pour l'hôte et pour le ménage, en complément
   ou alternative à WhatsApp (`docs/roadmap-v4.md`).
9. **Alerte sur un mauvais avis** (recadré le 2026-09-22, deux vérifications faites). Lodgify gère déjà, tout seul, deux choses côté avis —
   **rien à construire pour l'envoi** :
   - la **demande d'avis** au voyageur après son départ (message automatique, comme les instructions d'accès/de départ déjà copiées) ;
   - la publication automatique de **l'avis de l'hôte sur le voyageur** (sur Airbnb) — poster son propre avis en premier incite le voyageur
     à en laisser un à son tour (réciprocité).

   À vérifier dans les réglages Lodgify si ces deux automatisations sont activées ; si oui, copier la règle de demande d'avis dans
   `message_rule` comme les autres. Ce qui resterait éventuellement à construire, c'est seulement la **surveillance** : être alerté quand
   le voyageur laisse un mauvais avis. **Non vérifié : je ne sais pas si l'API Lodgify expose le contenu ou la note de ces avis-là** —
   ils vivent sur Airbnb/Booking, pas forcément lisibles depuis Lodgify ; à vérifier avant de promettre cette fonctionnalité.

## Non retenu pour l'instant

- **Aspirateur robot à caméra comme preuve de dégradation** : écarté comme solution principale (voir `docs/plan-assistant-menage.md` §6) —
  coverage insuffisante (vue au ras du sol), moment de passage non garanti, images qui passent souvent par le cloud du fabricant.
