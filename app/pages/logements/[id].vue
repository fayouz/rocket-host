<template>
  <div v-if="logement">
    <div class="mb-4 print:hidden">
      <h1 class="text-xl font-semibold">{{ logement.name }}</h1>
      <p class="text-sm text-muted">{{ logement.lodgifyName ? `Lodgify : ${logement.lodgifyName}` : 'Non associé à Lodgify' }}</p>
    </div>
    <div class="grid gap-6 md:grid-cols-[13rem_1fr]">
      <UNavigationMenu orientation="vertical" :items="menu" class="self-start print:hidden" />
      <div class="min-w-0">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data: logement } = await useFetch(() => `/api/logements/${route.params.id}`)
if (!logement.value) throw createError({ statusCode: 404, statusMessage: 'Logement introuvable', fatal: true })
const menu = computed(() => {
  const base = `/logements/${route.params.id}`
  return [
    { label: 'Réservations', icon: 'i-lucide-calendar-days', to: `${base}/reservations` },
    { label: 'Serrures', icon: 'i-lucide-lock', to: `${base}/serrures` },
    { label: 'Codes', icon: 'i-lucide-key-round', to: `${base}/codes` },
    { label: 'Timeline', icon: 'i-lucide-git-commit-vertical', to: `${base}/timeline` },
    { label: 'Stock', icon: 'i-lucide-package', to: `${base}/stock` },
    { label: 'QR code ménage', icon: 'i-lucide-qr-code', to: `${base}/qr` },
    { label: 'Documents', icon: 'i-lucide-folder-open', to: `${base}/documents` },
    { label: 'Bilan', icon: 'i-lucide-calculator', to: `${base}/bilan` },
    { label: 'Contacts', icon: 'i-lucide-contact', to: `${base}/contacts` },
  ]
})
</script>
