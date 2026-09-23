# Écran TV (Welcome Screen) sur une télévision Android — plan de mise en place

Rien n'est fait pour l'instant : ce document est le plan à suivre, logement par logement, pas encore exécuté.

**Objectif** : afficher en permanence la page `/tv/<jeton>` du logement (voir `docs/roadmap-v3.md`, item « Écran TV »)
sur la télévision, sans que le voyageur puisse en sortir, tout en lui laissant l'accès à quelques apps de streaming
choisies. Le lien de chaque logement est dans son éditeur de livret (page « Livret d'accueil » du logement, carte
« Écran TV »).

## Matériel requis

Boîtier ou TV sous **Android TV / Google TV complet** (pas un simple dongle Chromecast sans Google TV, qui n'a ni
écran d'accueil ni apps tierces installables). Les TV déjà en place dans les logements sont compatibles.

## Étape 1 — Choisir le logement pilote

À trancher : commencer par **Gaston** ou **Le ponant** ? Recommandé : un seul logement d'abord, valider toute la
chaîne (contenu affiché, verrouillage, apps disponibles) avant de dupliquer sur l'autre.

## Étape 2 — Installer Fully Kiosk Browser

App gratuite conçue pour ce cas exact (affichage fixe d'une page web, verrouillage de l'écran).

1. Installer **Downloader** sur la TV (app officielle, disponible sur le Play Store TV).
2. Avec Downloader, télécharger l'APK de Fully Kiosk Browser depuis `fully-kiosk.com` (pas toujours listé sur le
   Play Store TV).
3. Réglages de l'app :
   - **Start URL** : `https://app.loussahousing.fr/tv/<jeton-du-logement>`
   - **Start on boot** : activé
   - **Keep screen on** : activé
   - **Enable auto reload** : activé (reprend après une coupure réseau)

## Étape 3 — Tester sans verrouillage

Avant de verrouiller quoi que ce soit : laisser tourner quelques jours, vérifier que le contenu du livret (météo,
Wi-Fi, voyageur du jour, image de fond) s'affiche bien et se met à jour, et ajuster le contenu depuis l'éditeur si
besoin. Le verrouillage (étape 5) rendra les TV plus contraignantes à corriger en cas de souci.

## Étape 4 — Donner accès à certaines apps (optionnel)

Fully Kiosk propose un mode **Universal Launcher** : au lieu de verrouiller sur une seule page, il affiche un écran
d'accueil simplifié avec les icônes des apps choisies (ex. Netflix, YouTube, Disney+), en plus du bouton retour vers
le livret.

- **Kiosk Mode > Start Launcher on Boot**, avec **Universal Launcher** activé.
- **App Whitelist** : liste des apps autorisées (une par ligne, par nom de paquet Android — ex.
  `com.netflix.mediaclient`).

**À trancher avant d'activer** : si un service de streaming est proposé, il faut soit un compte dédié et vierge par
logement (pas celui d'un précédent voyageur), soit accepter que chaque voyageur se déconnecte/reconnecte lui-même.
Sans compte configuré, l'app reste accessible mais demandera une connexion à chaque voyageur.

## Étape 5 — Verrouiller la TV : mode Device Owner (gratuit)

Verrouillage complet (impossible de sortir de l'app ou d'atteindre les réglages Android), redémarrage à distance,
blocage de la réinitialisation d'usine — sans abonnement, via ADB.

**Condition impérative** : aucun compte Google ne doit être configuré sur la TV avant cette étape (sinon
réinitialisation d'usine d'abord, ce qui effacerait aussi les comptes de streaming posés à l'étape 4 — à faire donc
dans l'ordre : Device Owner *avant* de connecter les comptes de streaming, ou repartir d'une TV vierge).

1. Réglages > À propos > cliquer 7 fois sur le numéro de build (active le mode développeur).
2. Réglages > Développeur > activer le débogage réseau (ADB sur Wi-Fi).
3. Depuis un ordinateur sur le même réseau, avec `adb` installé :

```bash
adb connect <ip-de-la-tv>:5555
adb install FullyKioskBrowser.apk
adb shell dpm set-device-owner com.ksmpartners.fullykiosk/.AdminReceiver
```

4. Dans Fully Kiosk, activer le Kiosk Mode complet une fois Device Owner actif.

## Étape 6 — Administration à distance (optionnel)

Fully Kiosk expose une **API REST locale** (HTTP, protégée par mot de passe, sur le réseau local uniquement) :

- `loadUrl` — changer l'URL affichée à distance (utile après régénération du lien du livret)
- `restartApp` / `reboot` / `screenOn` / `screenOff`
- `getDeviceInfo` — état, batterie, IP, version
- `screenshot` — capture d'écran à distance

Piste future (pas construite) : un bouton « Recharger l'écran TV » dans l'éditeur du livret, qui appellerait cette
API en HTTP direct depuis le serveur Nuxt vers l'IP locale de la TV (serveur et TV sont sur le même réseau local à
Béglès, donc faisable). Utile surtout si le lien est régénéré : évite de devoir retaper l'URL à la main sur chaque
TV.

Pour gérer plusieurs TV depuis un tableau de bord unique (captures d'écran, redémarrage, changement d'URL à
distance, sans se déplacer) : **Fully Cloud**, payant à l'appareil. Intéressant seulement à partir de 5+ logements ;
pour Gaston et Le ponant, l'API locale (gratuite) suffit si le bouton ci-dessus est construit un jour.

## Étape 7 — Dupliquer sur le second logement

Une fois la chaîne validée sur le logement pilote (étapes 2 à 6), répéter à l'identique sur l'autre logement avec
son propre lien `/tv/<jeton>`.

## Alternative sans rien installer

Ouvrir Chrome (ou le navigateur intégré) sur la TV et aller sur l'URL à la main, à chaque arrivée. Fonctionne
partout, mais rien n'empêche de fermer l'onglet — pas de verrouillage, pas d'apps disponibles en plus.

## Résumé des décisions encore ouvertes

- Logement pilote : Gaston ou Le ponant ?
- Apps de streaming à proposer (étape 4) — et comment gérer les comptes entre deux voyageurs ?
- Construire le bouton « Recharger l'écran TV » dans l'appli (étape 6) maintenant, ou plus tard ?
