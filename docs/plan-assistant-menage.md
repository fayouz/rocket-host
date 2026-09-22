# Plan — assistant de tâches pour le ménage (wizard)

Statut : **brouillon à fignoler** (2026-09-22). Rien n'est développé.

## 1. Objectif

Un parcours guidé, pas à pas, pour la personne qui fait le ménage : ses tâches du jour dans le bon ordre, un état des lieux avec photos, la vérification du stock — le tout en un seul endroit, sur son téléphone.

## 2. Ce qui existe déjà (à réutiliser, pas à refaire)

- **`cleaning_task`** : assignation et statut par réservation, synchronisés depuis Lodgify via le webhook n8n (`POST /api/cleaning-tasks`).
- **Fenêtre de ménage calculée** (`server/utils/timeline.ts`) : du check-out jusqu'au check-in suivant du logement, plafonnée à 2 jours (règle Lodgify vérifiée).
- **Stock** : niveaux OK/Bas/Vide par logement (`stock_level`), déjà modifiables par le rôle « ménage » (`PUT /api/stock/level`, limité à ses logements).
- **Lien secret par logement** (`property_token`, table déjà en place) : sert aujourd'hui à la page de stock sans compte (`/r/<token>`). Réutilisable tel quel pour l'accès sans compte à l'assistant.
- **Stockage de fichiers sécurisé** (`server/utils/explorer.ts` / `documents.ts`) : types vérifiés, contenu vérifié (magic bytes), noms générés — le modèle à suivre pour les photos.
- **Rôle « ménage »** construit cette session : compte, mot de passe, logements autorisés, journal d'audit.

## 3. Accès — les deux, comme demandé

- **Avec compte** (le rôle « ménage ») : usage régulier, traçable (qui a fait quoi), cohérent avec le reste de l'appli.
- **Sans compte, par lien secret** (`/m/<token>`, un token par logement — extension de `property_token`) : en secours, si la personne ne veut pas gérer de mot de passe sur son téléphone perso. Même contenu, mêmes actions, juste sans le nom d'un compte associé dans le journal (on y met « lien secret » à la place).
- Les deux mènent à la **même page** et au **même code** ; seule la façon de s'identifier change.

## 4. Le parcours (wizard)

1. **Liste des tâches du jour**, triées par échéance (fin de la fenêtre de ménage = avant le prochain check-in). Avec 2 logements aujourd'hui, l'ordre par échéance suffit ; si le nombre de logements grandit, une vraie optimisation d'itinéraire (distances) pourrait s'ajouter plus tard — pas nécessaire maintenant.
2. **Étape par tâche**, en plein écran, une seule à la fois, **dans cet ordre** :
   - infos du logement et de la fenêtre (heure limite, prochain voyageur) ;
   - **photos « avant »** : état laissé par le voyageur qui part, avant de toucher à quoi que ce soit (preuve contre ce voyageur-là — voir §6) ;
   - **checklist** (liste de points à vérifier — voir §5) ;
   - **vérification du stock** du logement, intégrée ici (réutilise `PUT /api/stock/level`) — plus besoin d'aller sur une page à part ;
   - **photos « après »** : logement prêt, juste avant de quitter les lieux (preuve pour le voyageur qui arrive — voir §6) ;
   - bouton « Terminé » → passe `cleaning_task.status` à fait, horodate, passe à la tâche suivante.
3. **Récapitulatif** en fin de journée (tâches faites, photos prises, stock à jour).

## 5. Checklist

- Une checklist **par logement** (pas une seule générique) : chaque logement a ses spécificités (machine à café à grains pour Le ponant, capsules pour Gaston…).
- Réglable par l'administrateur (Réglages > Logements, ou un onglet dédié) : liste de points à cocher (« Draps changés », « Salle de bain », « Poubelles descendues »…).
- Simple V1 : texte + case à cocher, pas de logique conditionnelle.

## 6. Prise de photos — preuve en cas de dégradation, avant ET après (précisé le 2026-09-22)

**But confirmé par le user : la sécurité en cas de dégradation.** Deux moments, deux voyageurs protégés :

- **« Avant »** (dès l'arrivée sur place, rien touché) : l'état laissé par le voyageur **qui part** — preuve à utiliser contre lui en cas de dégât.
- **« Après »** (juste avant de partir, ménage et checklist terminés) : l'état livré au voyageur **qui arrive** — preuve que le logement était en bon état à son arrivée, pour te protéger si *lui* cause un dégât et prétend ensuite que « c'était déjà comme ça ».

Une même tâche de ménage encadre donc **deux réservations différentes** (celle qui vient de finir, celle qui commence) : les photos « avant » valent pour la première, les photos « après » pour la seconde.

- **Les deux moments sont obligatoires**, pas seulement l'un des deux : c'est la paire qui a de la valeur, un dossier sans photos « après » laisse un trou pour le voyageur suivant.
- Quelques photos ciblées suffisent à chaque fois (literie, électroménager, mobilier, murs) — pas besoin de tout photographier.
- Une case « Rien à signaler » vs « Dégât constaté » (avec note libre et photos supplémentaires) à l'étape « avant », pour accélérer le cas normal.
- Chaque photo est rattachée à une **réservation** et horodatée automatiquement : « avant » → la réservation de la tâche de ménage (`booking_id`, le voyageur qui vient de partir) ; « après » → la réservation suivante sur ce logement, à déterminer à partir des réservations Lodgify au moment de la prise (pas encore de lien direct en base, à calculer comme la fenêtre de ménage). Pas besoin de géolocalisation, la combinaison réservation + horodatage suffit.
- Stockage : même mécanisme que les documents (`server/utils/explorer.ts`) — types image uniquement (jpg/png/webp), contenu vérifié, taille limitée, nom de fichier généré, jamais le nom donné par le téléphone.
- Nouvelle table `cleaning_photo` (cleaning_task_id (= booking_id sortant), file_path, moment: `avant` \| `après`, degat: bool, note?, created_at, created_by — compte ou « lien secret »).
- **Visibilité : toi seul** (administrateur) — cohérent avec un usage de preuve/litige, pas un usage d'équipe courant. Pas dans la Timeline partagée ; un onglet dédié par réservation ou par logement, réservé au rôle admin.
- Piste pour plus tard, non retenue pour l'instant faute de champ disponible aujourd'hui : rattacher directement à une éventuelle protection dégâts Lodgify/Airbnb si l'API l'expose un jour (non vérifié, l'appli ne lit pas ce champ actuellement).
- Prise directe depuis le téléphone (`<input type="file" accept="image/*" capture>`), pas d'obligation de passer par la pellicule.
- **Aspirateur robot à caméra (idée écartée comme solution principale, 2026-09-22)** : coverage insuffisante (vue au ras du sol, ne voit ni murs, ni literie, ni électroménager, ni salle de bain — justement ce qui se dégrade), moment de passage non garanti sans déclenchement précis (possible via Homey, à construire), et les images passent souvent par le cloud du fabricant (Roborock, Ecovacs…), hors de notre contrôle. Complément possible pour un indice de propreté du sol, ne remplace pas les photos ciblées prises à la main.

## 7. Modèle de données (ajouts)

- `cleaning_photo` : voir §6.
- `cleaning_checklist_item` : logement_id, libellé, ordre — la checklist réglable par logement.
- `cleaning_checklist_done` : booking_id, checklist_item_id, coché à (pour retrouver ce qui a été fait à quelle tâche).
- Pas de nouvelle table pour l'ordre des tâches : calculé à la volée à partir de la fenêtre de ménage existante.

## 8. Garde-fous

- Le lien secret par logement (`/m/<token>`) ne donne accès **qu'aux tâches et au stock de ce logement**, jamais aux autres pages de l'appli (mêmes principes que `/r/<token>` aujourd'hui).
- Régénérer le lien secret (comme pour le stock) invalide l'ancien — utile si le téléphone d'une personne change ou si elle quitte.
- Les photos sont des données potentiellement sensibles (intérieur d'un logement, parfois des personnes visibles) : jamais dans git, accès aux mêmes règles que les documents (comptable exclu, par exemple).
- Taille et nombre de photos limités par tâche (éviter qu'une tâche remplisse le disque).

## 9. Étapes

| # | Étape | Contenu |
|---|---|---|
| 1 | Lecture seule | Liste des tâches du jour, triées, sans action possible — vérifier que l'ordre et les fenêtres sont justes |
| 2 | Checklist réglable | Réglages : ajouter/modifier la checklist par logement |
| 3 | Wizard complet | Parcours pas à pas, checklist cochable, bouton « Terminé » |
| 4 | Photos | Prise et stockage, affichage dans la Timeline |
| 5 | Stock intégré | Vérification du stock directement dans le wizard |
| 6 | Accès double | Compte « ménage » + lien secret `/m/<token>`, même contenu |

## 10. À trancher avant de construire

1. La checklist est-elle la même pour toutes les tâches d'un logement, ou peut-elle varier (ménage simple vs grand ménage) ?
2. ~~Photos avant seulement~~ **Réponse : avant ET après, les deux obligatoires** (§6). Reste à trancher : combien de photos minimum à chaque moment — une par zone sensible définie à l'avance, ou libre selon ce que voit la personne ?
3. ~~Qui voit les photos ensuite~~ **Réponse : toi seul** (photos = preuve en cas de dégradation, pas un usage d'équipe).
4. Une tâche en retard (fenêtre dépassée) : simple mise en évidence, ou alerte envoyée quelque part (e-mail, WhatsApp — cf. `docs/roadmap-v4.md`) ?
5. Un dégât constaté : juste consigné dans l'appli, ou doit-il aussi déclencher quelque chose (te prévenir tout de suite, ouvrir une fiche dans le mini CRM pour en garder trace) ?
