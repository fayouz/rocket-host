# Synchro des tâches de ménage Lodgify → LoussaHousing via n8n

Lodgify n'expose pas les tâches dans son API. Il envoie en revanche un e-mail de notification à chaque tâche.
n8n lit la boîte OVH, extrait la tâche et l'envoie à l'appli.

## Côté appli (déjà fait)

`POST /api/cleaning-tasks` — en-tête `Authorization: Bearer <WEBHOOK_TOKEN>` (valeur dans `.env`).

```json
{ "bookingId": 1000004, "assignee": "Prénom Nom", "status": "À compléter" }
```

Si le mail ne contient pas l'identifiant de réservation, envoyer le logement et le **jour du check-out** :

```json
{ "property": "Begles", "date": "2026-09-23", "assignee": "Marie Dupont", "status": "À compléter" }
```

Pour supprimer une tâche annulée : `{ "bookingId": 1000004, "deleted": true }`.

Réponses : `200` ok · `400` corps invalide · `401` jeton invalide · `404` réservation introuvable · `503` webhook désactivé.

## Workflow n8n à monter

1. **Email Trigger (IMAP)** : hôte OVH (souvent `ssl0.ovh.net`, port `993`, SSL), identifiant = adresse complète,
   dossier `INBOX`. Filtrer sur l'expéditeur Lodgify.
2. **Code** : extraire du mail le logement, la date de check-out, la personne assignée et l'état.
   *(à écrire une fois qu'on a un exemple d'objet/corps de mail de notification de tâche)*
3. **HTTP Request** : `POST http://app:3000/api/cleaning-tasks` (adresse interne Docker), en-tête `Authorization: Bearer <WEBHOOK_TOKEN>`, corps JSON ci-dessus.

## Hébergement

L'appli et n8n tournent ensemble grâce au `docker-compose.yml` du projet (voir `docs/deploiement.md`).
n8n appelle l'appli en interne : `POST http://app:3000/api/cleaning-tasks`.
