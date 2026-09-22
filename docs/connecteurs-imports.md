# Connecteurs d'import : Free, TotalEnergies, assurances, banques

Demande (2026-09-21) : ajouter des connecteurs pour récupérer factures et relevés. Ordre voulu : **API officielle, sinon rapports reçus par e-mail, sinon scraping avec n8n**.
Recherche faite le 2026-09-21 (sources en bas). Tout ce qui est importé passe par le circuit existant (`docs/imports-n8n.md`) : lecture IMAP + règles, ou n8n → `POST /api/import/documents` / `transactions`.

## Résultats par fournisseur

| Fournisseur | API officielle (particulier) | Rapport par e-mail | Voie recommandée |
|---|---|---|---|
| **Free / Freebox** | Aucune trouvée (des utilisateurs en demandent une sur les forums) | L'e-mail est une **notification sans PDF** : la facture est à télécharger dans l'espace abonné (changement annoncé en 2021, à revérifier sur un vrai e-mail) | Règle IMAP sur l'e-mail de notification → crée une **tâche « facture à récupérer »** ; téléchargement manuel dans l'explorateur. Scraping n8n seulement en dernier recours (voir plus bas) |
| **TotalEnergies** | Aucune pour les particuliers (les API relevées visent entreprises et collectivités) | Facture électronique envoyée chaque mois ou tous les deux mois ; **non vérifié** : PDF joint ou simple lien. PDF téléchargeables 5 ans dans l'espace client | Règle IMAP si le PDF est joint (à tester sur un vrai e-mail : compte et format seulement) |
| **Consommation d'énergie** (en complément) | **Enedis Data Connect** (Linky) et **GRDF ADICT** (gaz) : gratuits, avec consentement du titulaire, mais délai de mise en place de plusieurs semaines. Ils donnent la **consommation**, pas les factures | — | Idée à part (suivi de consommation par logement), pas un import de factures |
| **Assurances** | Non recherché (dépend de l'assureur) | Généralement facture / avis d'échéance en pièce jointe | Règle IMAP par assureur. **Il faut connaître les assureurs** |
| **Banques** | **DSP2 / agrégateurs** : Powens (B2B, tarif sur devis, bac à sable gratuit) ; GoCardless Bank Account Data : **offre gratuite fermée** aux nouveaux comptes depuis mi-2025 ; **Enable Banking : accès gratuit « production restreinte » à ses propres comptes** (comptes à lier soi-même dans leur portail). Bridge : tarification non vérifiée | Relevés PDF par e-mail selon la banque | **1) export CSV/OFX déposé à la main ou par e-mail** (fiable, gratuit) ; **2) Enable Banking** si on veut de l'automatique ; jamais de scraping |
| **Indy (indy.fr, compta)** | **Aucune trouvée pour ce plan.** Le suivi indépendant des API ne relève qu'un accès par formulaire de contact, sans documentation publique (recherche 2026-09-22 ; à ne pas confondre avec weareindy.com, un autre produit du même nom). | Non vérifié (Indy peut envoyer des documents comptables par e-mail — à confirmer sur un vrai e-mail) | Comme Free/TotalEnergies : règle IMAP si un PDF est joint, sinon dépôt manuel dans l'explorateur |

## Scraping avec n8n : ce qu'il faut savoir avant de choisir

- **Banques : à exclure.** La DSP2 impose l'authentification forte (code sur téléphone, renouvelée régulièrement) et vise justement à mettre fin au scraping bancaire ; un robot avec identifiants stockés est fragile, contraire aux conditions de la banque et risqué pour ta sécurité.
- **Free, TotalEnergies, assureurs** : techniquement possible (connexion à l'espace client, téléchargement du PDF), mais **fragile** (le site change, captcha, code de vérification par SMS), souvent **contraire aux conditions d'utilisation**, et il faut stocker des identifiants. Si tu le choisis : identifiants **uniquement dans les identifiants n8n** (jamais dans l'appli ni dans git), un workflow par fournisseur, alerte en cas d'échec.
- Rappel de la règle posée plus tôt : « jamais de connexion automatique aux comptes des plateformes » (`docs/imports-n8n.md`). Le scraping serait donc une **exception décidée par toi, fournisseur par fournisseur**, pas un défaut.

## Réglages > Connecteurs (à construire)

Nouvelle page dans Réglages, au-dessus des circuits existants (Imports, E-mail IMAP) : elle ne les remplace pas, elle les pilote par fournisseur.

- **Catalogue de modèles** : Free, TotalEnergies, Assurance (au choix), Banque (CSV), Autre. Chaque connecteur = un nom, un **mode** (e-mail / fichier CSV-OFX / n8n / manuel), un **logement** (ou « tous »), une **catégorie** de charge, une **fréquence attendue** (mensuelle, annuelle).
- **Mode e-mail** : crée et tient à jour la règle IMAP correspondante (expéditeur → source, catégorie, logement) ; aperçu avant activation.
- **Mode fichier bancaire** : import CSV/OFX (glisser-déposer), rapprochement des lignes avec les charges, dédoublonnage ; lignes non reconnues envoyées dans « À classer ».
- **Mode n8n** : affiche l'adresse et le jeton à utiliser, l'identifiant de source, le dernier passage ; **aucun identifiant de fournisseur dans l'appli**.
- **État de chaque connecteur** : dernier import, nombre de documents, **alerte « facture attendue non reçue »** (ex. rien de TotalEnergies depuis 45 jours), bouton activer/désactiver.
- **Facture « à récupérer »** (cas Free) : tâche créée à la réception de la notification, avec lien vers l'espace abonné, fermée quand le fichier est déposé.

## À trancher avant de construire

1. Quels **assureurs** exactement (habitation, PNO, RC…) et quelle **banque** ? Les modes dépendent de ces réponses.
1b. **Indy (comptabilité)** : à ajouter au même circuit qu'un fournisseur (règle IMAP) une fois confirmé le format de ses documents envoyés par e-mail.
2. Free : **Freebox** (internet des logements) ou mobile ? Un abonnement par logement ?
3. Banque : export **CSV/OFX manuel** (gratuit, simple) ou automatisation via **Enable Banking** (gratuit, mais 1 à 2 heures de mise en place et consentement bancaire à renouveler) ?
4. Scraping n8n : exclu, ou accepté pour Free / TotalEnergies seulement, à tes risques ?
5. Suivi de consommation Enedis / GRDF : intéressant, ou hors sujet pour l'instant ?

## Sources

- Free : [forum Free-réseau, API factures](https://forum.free-reseau.fr/topic/13097-api-pour-t%C3%A9l%C3%A9chargement-de-factures/) ; [Univers Freebox, e-mail sans PDF](https://www.universfreebox.com/article/61841/du-changement-pour-les-abonnes-freebox-et-la-reception-de-leurs-factures)
- TotalEnergies : [FAQ facture par e-mail](https://www.totalenergies.fr/particuliers/aide-et-contacts/faq?question=prefere-recevoir-factures-e-mail-comment-faire) ; [Une facture, un paiement](https://www.totalenergies.fr/particuliers/aide-et-contacts/une-facture-un-paiement)
- Énergie : [API GRDF ADICT](https://www.data.gouv.fr/dataservices/api-grdf-adict) ; [Enedis Data Connect (retour d'expérience)](https://github.com/consometers/data-connect)
- Banques : [Powens](https://www.powens.com/fr/produits/transactions/) ; [fin de l'offre gratuite Nordigen / GoCardless](https://dev.to/johnfrandsen/self-hosted-bank-account-aggregation-in-2026-after-the-nordigen-free-tier-shutdown-3mdo) ; [Enable Banking, FAQ](https://enablebanking.com/docs/faq/) ; [comparatif des API bancaires gratuites](https://www.openbankingtracker.com/guides/free-open-banking-apis) ; [DSP2 et fin du web scraping](https://www.village-justice.com/articles/dsp2-encadrement-acces-aux-donnees-clients-des-banques-par-les-fintech,26594.html)
