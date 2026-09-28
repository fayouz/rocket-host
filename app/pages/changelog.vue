<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <div class="space-y-2 text-center">
      <UBadge color="primary" variant="subtle" label="Nouveautés" />
      <h1 class="text-3xl font-bold">Ce qui a changé</h1>
      <p class="text-muted">L'historique des évolutions de Rocket Host, dans l'ordre.</p>
    </div>

    <UTimeline
      :items="entries" size="lg" :ui="{ description: 'mt-2' }"
    >
      <template #title="{ item }">
        <span class="text-lg font-semibold">{{ item.title }}</span>
      </template>
      <template #description="{ item }">
        <ul class="list-disc space-y-1 pl-4 text-sm text-muted marker:text-dimmed">
          <li v-for="(line, i) in item.points" :key="i">{{ line }}</li>
        </ul>
      </template>
    </UTimeline>
  </div>
</template>

<script setup lang="ts">
// Historique manuel des evolutions notables (pas genere depuis git/GitHub : depot prive, messages de commit trop
// granulaires pour etre lus tels quels). A completer a chaque nouvelle fonctionnalite marquante.
interface Entry { date: string; title: string; icon: string; points: string[] }
const entries: Entry[] = [
  {
    date: '29 sept. 2026',
    title: 'Menu réorganisé par tâche',
    icon: 'i-lucide-list-tree',
    points: [
      'Nouveau groupe « Au quotidien » : Réservations, Ménage & linge, Accès & serrures, Stock & courses, Écrans & livret — les mêmes pages qu\'avant, regroupées par ce qu\'on fait plutôt que par brique logicielle',
      'Ménage voit maintenant directement Ménage & linge et Stock & courses dans le menu (plus seulement via Logements)',
      '« Administration » repliée par défaut en un seul sous-menu (connexions, utilisateurs, imports, aide…) pour les admins',
      'Doublons supprimés : Documents et Mon compte n\'apparaissent plus qu\'une fois (Mon compte reste dans le menu utilisateur)',
      'Pastilles d\'état des briques (PMS, Place, Mailer, Cloud) en bas de la sidebar, vers Connexions',
    ],
  },
  {
    date: '28 sept. 2026',
    title: 'Secrets et connexions dans l\'appli',
    icon: 'i-lucide-key-round',
    points: [
      'Nouvelle page Administration › Connexions : adresses et jetons de Rocket PMS, Place, Clean, Stock et Cast, mot de passe de la boîte e-mail, clés Homey, Lodgify, Nuki, jeton du webhook et secrets des connecteurs',
      'Plus besoin de modifier .env ni de redémarrer : les secrets sont chiffrés en base (AES-256-GCM) avec une seule clé maître gardée sur le serveur',
      'Jamais réaffichés : seuls les 4 derniers caractères apparaissent (« ••••1234 »), avec « Remplacer » et « Effacer » ; chaque modification est notée dans le journal d\'audit (sans la valeur)',
      'Migration sans coupure : les anciennes valeurs de .env restent lues tant qu\'elles ne sont pas importées (npm run secrets:import-env)',
    ],
  },
  {
    date: '28 sept. 2026',
    title: 'Tableau de bord intelligent',
    icon: 'i-lucide-layout-dashboard',
    points: [
      'Accueil inchangé, enrichi de cartes quand Rocket PMS est branché : arrivées à préparer d\'aujourd\'hui et demain croisés avec le ménage (Rocket Clean), le linge, les accès (Rocket Place), l\'écran TV (Rocket Cast) et le paiement',
      'Alertes croisées triées par urgence : ménage non terminé moins de 2 h avant l\'arrivée, accès non envoyé, écran hors ligne, départ sans ménage, stock bas, linge manquant, réservation modifiée, brique injoignable',
      'Finances du mois en contexte : revenus et occupation par logement et par canal, coût des ménages, consommation du stock, prévision sur 30 jours',
      'Chaque brique est facultative (ROCKET_PLACE_URL, ROCKET_CLEAN_URL, ROCKET_STOCK_URL, ROCKET_CAST_URL) : une brique en panne n\'empêche jamais l\'affichage ; rafraîchissement toutes les 5 minutes',
    ],
  },
  {
    date: '28 sept. 2026',
    title: 'Renommé en Rocket Host',
    icon: 'i-lucide-tag',
    points: [
      'L\'application s\'appelle désormais Rocket Host (titre, menu, pages de connexion, e-mails, documentation, API)',
      'LoussaHousing reste le nom de l\'activité et des données : c\'est le premier client de Rocket Host',
      'Dépôt GitHub renommé fayouz/rocket-host ; identifiant client Rocket Auth « loussahousing » et variables d\'environnement inchangés',
    ],
  },
  {
    date: '28 sept. 2026',
    title: 'Connexion unique avec Rocket Auth',
    icon: 'i-lucide-rocket',
    points: [
      'Bouton « Se connecter avec Rocket Auth » sur la page de connexion (OpenID Connect, code + PKCE), actif seulement si ROCKET_AUTH_URL est renseigné',
      'Compte associé par adresse e-mail (création facultative), rôle administrateur et autres rôles d\'après les groupes Rocket Auth',
      'Déconnexion aussi chez Rocket Auth ; une déconnexion faite ailleurs dans la suite ferme les sessions Rocket Host (back-channel logout)',
      'Sélecteur des applications de la suite Rocket dans l\'en-tête ; connexion locale gardée pendant la transition (ROCKET_LOCAL_LOGIN)',
    ],
  },
  {
    date: '28 sept. 2026',
    title: 'Menu Administration rangé par brique',
    icon: 'i-lucide-layout-list',
    points: [
      'Le menu Administration est regroupé par brique : Rocket PMS, Rocket Place, Rocket Mailer, Rocket Cloud, puis Rocket Host (local)',
      'Chaque brique affiche son état (connecté, via PMS, démo, off, local)',
      'Quand Rocket PMS est branché, les pages locales remplacées (lieux, stock, livret, e-mail) indiquent « géré dans Rocket PMS/Place », avec un lien si PMS_FRONT_URL / PLACE_FRONT_URL sont renseignés',
      'Aucune page supprimée ; le journal d\'audit a son propre lien',
    ],
  },
  {
    date: '28 sept. 2026',
    title: 'Rocket PMS : livret, e-mails, bilan et ménages',
    icon: 'i-lucide-rocket',
    points: [
      'Quand Rocket PMS est branché, chaque réservation affiche son lien de livret personnalisé (copier, QR code) et un bouton « Envoyer le livret » (messagerie Lodgify ou e-mail), toujours après confirmation',
      'Les e-mails échangés avec le voyageur (Rocket Mailer) apparaissent dans la réservation, avec un formulaire pour lui écrire (envoi uniquement au clic)',
      'L\'onglet Livret montre le lien de l\'écran TV, les visites et renvoie vers l\'éditeur Rocket PMS',
      'L\'onglet Bilan utilise le bilan calculé par Rocket PMS (export CSV, liste des dépenses et recettes)',
      'L\'onglet Timeline liste les ménages planifiés dans Rocket Place après chaque départ (lecture seule)',
      'Sans PMS_API_URL dans .env, rien ne change',
    ],
  },
  {
    date: '27 sept. 2026',
    title: 'Premier pas vers Rocket PMS',
    icon: 'i-lucide-server',
    points: [
      'L\'appli sait maintenant parler à Rocket PMS (fayouz/rocket-pms) : logements et réservations peuvent venir de là plutôt que de Lodgify en direct',
      'Débranché tant que PMS_API_URL n\'est pas renseigné dans .env : rien ne change pour l\'instant',
      'État de la connexion visible dans Réglages > Plugins',
    ],
  },
  {
    date: '23 sept. 2026',
    title: 'Pages personnalisées et manuel',
    icon: 'i-lucide-layout-grid',
    points: [
      'Le livret et l\'écran TV s\'organisent maintenant en pages nommées par l\'hôte, chacune regroupant un ou plusieurs widgets (avant : un widget = un onglet)',
      'Chaque page peut avoir son propre fond d\'écran en mode « Onglets »',
      'Le mot de bienvenue accepte le repère {{guest}}, remplacé par le prénom du voyageur en cours de séjour',
      'Nouveau manuel (/docs) et page Nouveautés pour suivre les évolutions de l\'application',
    ],
  },
  {
    date: '23 sept. 2026',
    title: 'Carrousel du livret et de l\'écran TV',
    icon: 'i-lucide-gallery-horizontal',
    points: [
      'Le livret mobile et l\'écran TV peuvent afficher un carrousel balayable (avec barre de menu par icônes) au lieu d\'une simple liste, au choix dans les réglages',
      'Aperçu en direct du livret ajouté sur la page Réservations de chaque logement',
      'Les aperçus (livret, écran TV) se rafraîchissent automatiquement après un changement, sans clic manuel',
    ],
  },
  {
    date: '23 sept. 2026',
    title: 'Livret Accueil réorganisé',
    icon: 'i-lucide-book-heart',
    points: [
      'Onglets Livret Accueil / Règlement intérieur / Écran TV regroupés sur une seule page',
      'Fond d\'écran personnalisé (upload ou banque d\'images libres), mise en page en 1 ou 2 colonnes, widgets à activer/réordonner',
      'Domotique Homey mise à disposition du voyageur directement dans le livret',
      'Correctif de sécurité : le lien d\'aperçu n\'était plus bloqué par les en-têtes de sécurité en production',
    ],
  },
  {
    date: '22 sept. 2026',
    title: 'Comptes et accès',
    icon: 'i-lucide-shield-check',
    points: [
      'Connexion par identifiant/mot de passe, rôles par logement, mot de passe oublié',
      'Le mot de passe partagé au niveau du serveur (Traefik) est retiré : l\'application gère seule ses accès',
    ],
  },
  {
    date: '21 sept. 2026',
    title: 'Lancement V2',
    icon: 'i-lucide-rocket',
    points: [
      'Tableau de bord hôte : arrivées, départs, ménages et stock du jour',
      'E-mails classés par logement et par réservation, avec suggestions de rattachement',
      'Explorateur de documents avec étiquettes, imports Lodgify/Nuki',
      'Domotique Homey en lecture seule (température, ouvrants, etc.)',
    ],
  },
]
</script>
