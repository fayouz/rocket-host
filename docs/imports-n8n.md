# Import de factures et de relevés (n8n, IMAP)

Tout ce qui arrive de l'extérieur (workflow n8n, lecture IMAP) passe par le même circuit : **documents** (fichiers) et **lignes de relevé**
(commissions, taxes de séjour, reversements). Une **source** = un identifiant court par plateforme : `airbnb`, `booking`, `lodgify`…

Ce qui est importé sans logement reconnu va dans **Réglages > Imports > À classer** ; le bilan d'un logement ne compte que ce qui lui est affecté.

## Voie 1 : e-mail lu par l'appli (Réglages > E-mail (IMAP))

1. Mets `IMAP_PASSWORD=…` dans `.env` (jamais dans l'appli), redémarre.
2. Renseigne serveur, identifiant, dossier, puis **Tester la connexion** (ne lit aucun message).
3. Crée des règles « expéditeur contient X » → source, catégorie, logement. Seuls ces e-mails sont ouverts ; la boîte est lue en lecture seule.
4. Active le relevé automatique (toutes les N minutes) ou clique **Relever maintenant**.

Les pièces jointes utiles (PDF, images, tableurs) sont importées avec l'identifiant `<Message-ID>#<nom du fichier>` : un même e-mail ne crée jamais deux documents.
Une facture qui n'arrive que sous forme de **lien** (« votre facture est disponible ») n'est pas récupérable ainsi.

## Voie 2 : workflow n8n dédié (plateformes sans API)

Le workflow récupère/prépare le fichier ou les lignes, puis appelle l'appli avec `Authorization: Bearer <WEBHOOK_TOKEN>`
(en Docker, adresse interne `http://app:3000`, sans passer par Traefik).

### Document : `POST /api/import/documents` (multipart/form-data)

| Champ | |
|---|---|
| `file` | requis (pdf, png, jpg, webp, csv, txt, xlsx, docx ; 15 Mo max) |
| `source` | requis, ex. `airbnb` (2 à 30 caractères : a-z, 0-9, `-`, `_`) |
| `externalId` | recommandé : identifiant stable (n° de facture…). Même `source` + `externalId` = doublon ignoré |
| `logementId` / `lodgifyPropertyId` / `property` | logement cible ; `property` = nom (« Gaston », « Le ponant »…). Sinon ou si inconnu : **à classer** |
| `category` | clé de catégorie (défaut `autre_doc`), voir plus bas |
| `date` | AAAA-MM-JJ (défaut : aujourd'hui) |
| `title`, `amount`, `note` | facultatifs |

```bash
curl -X POST http://app:3000/api/import/documents \
  -H "Authorization: Bearer $WEBHOOK_TOKEN" \
  -F source=airbnb -F externalId=INV-2026-03 -F property=Gaston \
  -F category=frais_plateformes -F date=2026-03-31 -F amount=45,10 \
  -F file=@facture.pdf
# -> {"ok":true,"duplicate":false,"id":12,"logementId":1,"toClassify":false}
```

Un contenu identique déjà importé est aussi reconnu comme doublon (même si l'`externalId` diffère).

### Relevé : `POST /api/import/transactions` (JSON, 2000 lignes max)

```json
{ "source": "airbnb", "items": [
  { "externalId": "TX-1001", "date": "2026-03-05", "kind": "fee", "amount": 30.0, "property": "Gaston", "label": "Frais de service", "bookingRef": "HMABC123" },
  { "externalId": "TX-1002", "date": "2026-03-05", "kind": "payout", "amount": 612.4, "property": "Gaston" }
] }
```

`kind` : `payout` (reversement reçu), `fee` (commission / frais de service, **compté dans les charges du bilan**), `tourist_tax` (taxe de séjour collectée, indicatif),
`refund` (remboursement, indicatif), `other`. `amount` toujours **positif**. Réponse : `{ inserted, duplicates, invalid: [{ index, reason }] }` ; une ligne invalide ne bloque pas les autres.
Si des lignes `fee` existent pour un logement et une année, elles **remplacent** dans le bilan les montants des documents de catégorie « Frais de plateformes » (même dépense, pas de double compte).

### Catégories (`category`)

Charges : `taxe_fonciere`, `assurance`, `copropriete`, `travaux`, `energie`, `abonnements`, `menage_linge`, `consommables`, `frais_plateformes`, `comptabilite`, `autre_charge`.
Recette hors Lodgify : `autre_recette`. Justificatifs (sans effet sur le bilan) : `reversement`, `bail_contrat`, `diagnostic`, `autre_doc`.

### Squelette de workflow n8n

1. **Déclencheur** : planifié (chaque mois) ou e-mail.
2. **Récupération** : télécharge le fichier / prépare les lignes (propre à chaque plateforme).
3. **HTTP Request** : `POST http://app:3000/api/import/documents` (Body : Form-Data, champs ci-dessus, `file` en binaire) ou `/api/import/transactions` (JSON).
4. En cas de réponse ≠ 200, laisse l'erreur remonter dans n8n ; le résultat de chaque import est aussi dans **Imports > Journal**.

> Les formats de relevé de chaque plateforme ne sont pas connus d'avance : chaque workflow doit être écrit et testé avec un vrai fichier exporté.
> Ne pas automatiser la connexion aux comptes des plateformes (conditions d'utilisation, double authentification) : télécharger l'export à la main ou le recevoir par e-mail.
