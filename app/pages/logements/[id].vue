<template>
  <div v-if="logement">
    <div class="mb-4 print:hidden">
      <h1 class="text-xl font-semibold">{{ logement.name }}</h1>
      <p class="text-sm text-muted">{{ logement.lodgifyName ? `Lodgify : ${logement.lodgifyName}` : 'Non associé à Lodgify' }}</p>
    </div>
    <UNavigationMenu orientation="horizontal" highlight :items="menu" class="mb-6 print:hidden" />
    <div class="min-w-0">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { can, refresh } = useAuth()
await refresh()
const { data: logement } = await useFetch(() => `/api/logements/${route.params.id}`)
if (!logement.value) throw createError({ statusCode: 404, statusMessage: 'Logement introuvable', fatal: true })
const menu = computed(() => {
  const base = `/logements/${route.params.id}`
  // Lettres = rôles autorisés (mêmes que la table des permissions du serveur, qui reste seule juge)
  return [
    ['AG', { label: 'Réservations', icon: 'i-lucide-calendar-days', to: `${base}/reservations` }],
    ['AG', { label: 'Serrures', icon: 'i-lucide-lock', to: `${base}/serrures` }],
    ['AG', { label: 'Timeline', icon: 'i-lucide-git-commit-vertical', to: `${base}/timeline` }],
    ['AGM', { label: 'Stock', icon: 'i-lucide-package', to: `${base}/stock` }],
    ['AG', { label: 'Domotique', icon: 'i-lucide-thermometer', to: `${base}/domotique` }],
    ['A', { label: 'QR code ménage', icon: 'i-lucide-qr-code', to: `${base}/qr` }],
    ['AG', { label: 'Livret Accueil', icon: 'i-lucide-book-heart', to: `${base}/livret` }],
    ['AGC', { label: 'Documents', icon: 'i-lucide-folder-open', to: `${base}/documents` }],
    ['AGC', { label: 'Bilan', icon: 'i-lucide-calculator', to: `${base}/bilan` }],
    ['A', { label: 'E-mails', icon: 'i-lucide-mail', to: `${base}/mails` }],
    ['A', { label: 'Contacts', icon: 'i-lucide-contact', to: `${base}/contacts` }],
  ].filter(([letters]) => can(letters as string)).map(([, item]) => item)
})
</script>
