# E-mails : lecture, envoi, dossiers et rangement

Écran **E-mails** de l'appli, branché sur ta boîte par IMAP (lecture) et SMTP (envoi). Réglages : **Réglages > E-mail (IMAP)**.
Le mot de passe est dans `.env` (`IMAP_PASSWORD`, aussi utilisé pour l'envoi) : jamais en base, jamais renvoyé au navigateur.

## Ce que l'appli lit et écrit dans ta boîte

| Action | Écrit dans la boîte ? |
|---|---|
| Synchronisation, lecture d'un message, téléchargement d'une pièce jointe | Non (lecture seule, rien marqué lu) |
| **Nouveau message / Répondre** (bouton « Envoyer ») | Envoi SMTP + une **copie dans « Envoyés »** |
| **Nouveau dossier** | Crée le dossier dans la boîte |
| **Ranger la réception** (aperçu, puis « Ranger maintenant » ou automatique) | Copie vers le dossier cible + **déplace l'original** dans « Traité » (ou « Archive », au choix) |

Rien n'est jamais supprimé. Chaque écriture vient d'un clic de l'utilisateur, sauf le rangement automatique, **désactivé par défaut**.

## Rangement des e-mails reçus

Pour un e-mail de la **réception** qui correspond à une règle : une **copie** va dans chaque dossier cible et l'**original** est déplacé dans le dossier « traité » (`Traité` par défaut, ou `Archive`).
Un e-mail qui ne correspond à rien reste dans la réception, intact.

| Dossier cible | Quand |
|---|---|
| `Logements/<nom du logement>` | e-mail rattaché à une réservation de ce logement, ou à un contact lié à ce logement |
| `Comptabilité` | e-mail d'un contact de type comptable, banque, assurance, syndic ou fournisseur ; ou objet évoquant une facture / un reçu / une taxe / la TVA / un bilan **avec pièce jointe** |
| dossier libre | règle « l'expéditeur contient… / l'objet contient… » (une règle vide ne range jamais rien) |

- Les dossiers `Logements`, `Logements/<logement>` et `Comptabilité` sont créés au premier rangement, s'ils manquent.
- **Aperçu obligatoire d'abord** : l'écran « Ranger la réception » liste ce qui serait rangé avant toute écriture. 50 messages au plus par passage.
- Sécurité : le déplacement n'efface que le message concerné (`MOVE`, ou `UIDPLUS` en secours) ; sans l'un ni l'autre, le rangement est refusé.
- Les e-mails du **Spam** ne sont jamais associés ni rangés.

## Rattachement automatique aux réservations et contacts

E-mail du voyageur (100 %), numéro de réservation `#B…` (95 %), nom du voyageur pendant son séjour (70 %) ; contact par adresse exacte (100 %) ou domaine professionnel (60 %).
Le bouton **« Relancer l'association »** recalcule tout ; les rattachements manuels et les retraits sont conservés.

## Envoi : protections

- L'adresse d'envoi est celle de la boîte ; destinataires validés (20 au plus), objet sur une seule ligne, 100 000 caractères, pièces jointes 15 Mo.
- Une protection **contre les requêtes venant d'un autre site** (CSRF) refuse toute écriture dont l'origine n'est pas l'appli elle-même. Elle ne gêne pas les workflows n8n (appels de serveur à serveur).
- « Tester l'envoi » vérifie la connexion et l'identification SMTP **sans envoyer de message**.
