# Écran TV sur une télévision Android — mise en place (à faire, pas encore fait)

Objectif : afficher en permanence la page `/tv/<jeton>` du logement (voir `docs/roadmap-v3.md`, item « Écran TV ») sur la
télévision, sans que le voyageur puisse en sortir. Le lien de chaque logement est disponible dans son éditeur de livret
(page « Livret d'accueil » du logement, carte « Écran TV »).

## Matériel nécessaire

Il faut un boîtier ou une TV sous **Android TV / Google TV complet** (pas un simple dongle Chromecast sans Google TV,
qui n'a ni écran d'accueil ni apps tierces installables). Exemples : Nvidia Shield, Xiaomi Mi Box, Chromecast avec
Google TV, TV Sony/TCL/Philips sous Android TV — correspond à la télé déjà en place.

## Solution retenue : Fully Kiosk Browser

App gratuite conçue pour ce cas exact (affichage fixe d'une page web, verrouillage de l'écran).

1. Installer **Downloader** (app officielle, disponible sur le Play Store TV).
2. Télécharger l'APK de Fully Kiosk Browser depuis `fully-kiosk.com` (pas toujours sur le Play Store TV).
3. Réglages de l'app :
   - **Start URL** : `https://app.loussahousing.fr/tv/<jeton-du-logement>`
   - **Start on boot** : activé
   - **Keep screen on** : activé
   - **Enable auto reload** : activé (reprend après une coupure réseau)
4. Définir Fully Kiosk comme **launcher par défaut** (Réglages Android TV > Applications > Application d'accueil), pour
   ne jamais retomber sur l'interface Android normale.

## Rendre la TV « managée » : mode Device Owner (gratuit)

Verrouillage complet (impossible de sortir de l'appli), redémarrage à distance, blocage de la réinitialisation d'usine —
sans abonnement, via ADB. **Condition : aucun compte Google ne doit être configuré sur la TV** (sinon réinitialisation
d'usine d'abord).

1. Réglages > À propos > cliquer 7 fois sur le numéro de build (active le mode développeur).
2. Réglages > Développeur > activer le débogage réseau (ADB sur Wi-Fi).
3. Depuis un ordinateur sur le même réseau, avec `adb` installé :

```bash
adb connect <ip-de-la-tv>:5555
adb install FullyKioskBrowser.apk
adb shell dpm set-device-owner com.ksmpartners.fullykiosk/.AdminReceiver
```

4. Dans Fully Kiosk, activer le Kiosk Mode complet une fois Device Owner actif.

## Option payante : Fully Cloud (gestion à distance, plusieurs TV)

Console en ligne (payante, à l'appareil) : captures d'écran, redémarrage, changement d'URL à distance, sans se
déplacer. Intéressant seulement à partir de 5+ logements ; pour Gaston et Le ponant, le mode Device Owner gratuit
suffit.

## Alternative sans rien installer

Ouvrir Chrome (ou le navigateur intégré) sur la TV et aller sur l'URL à la main, à chaque arrivée. Fonctionne partout,
mais rien n'empêche de fermer l'onglet — pas de verrouillage.

## À trancher avant de faire l'installation

- Sur quel(s) logement(s) commencer (Gaston, Le ponant, les deux) ?
- Device Owner tout de suite, ou d'abord tester sans verrouillage (ouverture manuelle) le temps de valider le contenu
  affiché ?
