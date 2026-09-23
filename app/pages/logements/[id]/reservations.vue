<template>
  <div v-if="data" class="grid gap-4 lg:grid-cols-3">
    <div class="space-y-2 lg:col-span-2">
      <h2 class="section-title !mt-0">Réservations</h2>
      <UCard v-for="b in data.items" :key="b.id" :class="{ 'opacity-60': !b.active }">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <b>{{ b.guest }}</b>
          <div class="flex flex-wrap gap-1">
            <UBadge v-if="phase(b) === 'now'" color="success" label="En cours" />
            <UBadge v-else-if="phase(b) === 'next'" color="info" variant="subtle" label="À venir" />
            <UBadge :color="statusColor(b.status)" variant="subtle" :label="b.status" />
            <PlatformBadge :source="b.source" />
            <UButton v-if="b.mails" size="xs" color="neutral" variant="soft" icon="i-lucide-mail" :label="String(b.mails)" :to="`/mail?booking=${b.id}`" title="E-mails rattachés à cette réservation" />
          </div>
        </div>
        <p class="text-sm text-muted">
          {{ fr(b.arrival) }}{{ b.checkIn ? ` à ${b.checkIn}` : '' }} → {{ fr(b.departure) }}{{ b.checkOut ? ` à ${b.checkOut}` : '' }}
          · {{ b.nights }} nuit{{ b.nights > 1 ? 's' : '' }}<template v-if="b.total"> · {{ eur(b.total) }}</template>
        </p>
        <p v-if="b.code" class="mt-1 text-sm">
          <UBadge :color="b.code === 'created' ? 'success' : b.code === 'error' ? 'error' : 'neutral'" variant="subtle"
                  :label="b.code === 'created' ? 'Code créé sur Nuki' : b.code === 'error' ? 'Erreur de création du code' : 'Code prévu'" />
        </p>
      </UCard>
      <UCard v-if="!data.items.length"><p class="text-sm text-muted">Aucune réservation sur cette période.</p></UCard>
    </div>

    <div class="lg:col-span-1">
      <UCard class="lg:sticky lg:top-4" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header><b>Aperçu du livret</b></template>
        <div v-if="livretLink" class="livret-preview-frame overflow-hidden bg-black">
          <iframe :src="livretPreviewLink" class="livret-preview-iframe" title="Aperçu du livret" />
        </div>
        <p v-else class="p-4 text-sm text-muted">Livret pas encore configuré pour ce logement.</p>
        <div v-if="livretLink" class="flex flex-wrap gap-2 p-3">
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-refresh-cw" label="Rafraîchir" @click="livretPreviewKey++" />
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-eye" label="Ouvrir" :to="livretLink" external target="_blank" />
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(() => `/api/logements/${route.params.id}/reservations`)
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const today = new Date().toISOString().slice(0, 10)
const phase = (b: { active: boolean; arrival: string; departure: string }) =>
  !b.active ? 'other' : b.arrival <= today && b.departure > today ? 'now' : b.arrival > today ? 'next' : 'past'
const statusColor = (s: string) => /book/i.test(s) ? 'success' : /declin|cancel/i.test(s) ? 'error' : 'info'
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const eur = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'

// Aperçu du livret (welcomescreen), en encart : même token que l'onglet Livret Accueil.
const { data: livretData } = await useFetch(() => `/api/logements/${route.params.id}/livret`)
const origin = useRequestURL().origin
const livretLink = computed(() => livretData.value?.token ? `${origin}/g/${livretData.value.token}` : '')
const livretPreviewKey = ref(0)
const livretPreviewLink = computed(() => livretPreviewKey.value ? `${livretLink.value}?v=${livretPreviewKey.value}` : livretLink.value)
</script>

<style scoped>
/* Aperçu réduit du livret mobile (format téléphone, 375x660 mis à l'échelle) — même dimensions que l'onglet Livret Accueil */
.livret-preview-frame {
  width: 100%;
  aspect-ratio: 260 / 460;
  max-width: 260px;
  margin: 0 auto;
}
.livret-preview-iframe {
  width: 375px;
  height: 660px;
  border: 0;
  transform: scale(0.6933);
  transform-origin: top left;
}
</style>
