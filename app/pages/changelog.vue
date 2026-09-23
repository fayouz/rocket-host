<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <div class="space-y-2 text-center">
      <UBadge color="primary" variant="subtle" label="Nouveautés" />
      <h1 class="text-3xl font-bold">Ce qui a changé</h1>
      <p class="text-muted">L'historique des évolutions de LoussaHousing, dans l'ordre.</p>
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
