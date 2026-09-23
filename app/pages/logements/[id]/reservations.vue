<template>
  <div v-if="data" class="flex flex-col gap-4 lg:h-[calc(100vh-11rem)] lg:flex-row">
    <!-- Colonne gauche : liste compacte, comme la boite de reception d'un client mail -->
    <div class="min-w-0 space-y-1 overflow-y-auto lg:w-80 lg:shrink-0 lg:border-r lg:border-default lg:pr-3">
      <h2 class="section-title !mt-0">Réservations</h2>
      <button
        v-for="b in data.items" :key="b.id" type="button" class="block w-full rounded-md p-2.5 text-left transition-colors"
        :class="[selected === b.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-elevated', { 'opacity-60': !b.active }]"
        @click="selected = b.id"
      >
        <div class="flex items-center justify-between gap-2">
          <b class="truncate text-sm">{{ b.guest }}</b>
          <UBadge v-if="phase(b) === 'now'" size="sm" color="success" label="En cours" />
          <UBadge v-else-if="phase(b) === 'next'" size="sm" color="info" variant="subtle" label="À venir" />
        </div>
        <p class="truncate text-xs text-muted">{{ fr(b.arrival) }} → {{ fr(b.departure) }} · {{ b.nights }} nuit{{ b.nights > 1 ? 's' : '' }}</p>
      </button>
      <p v-if="!data.items.length" class="text-sm text-muted">Aucune réservation sur cette période.</p>
    </div>

    <!-- Colonne droite : detail de la reservation selectionnee, comme le contenu d'un e-mail -->
    <div class="min-w-0 flex-1 space-y-4 overflow-y-auto">
      <template v-if="current">
        <UCard>
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">{{ current.guest }}</h3>
              <p class="text-sm text-muted">
                {{ fr(current.arrival) }}{{ current.checkIn ? ` à ${current.checkIn}` : '' }} → {{ fr(current.departure) }}{{ current.checkOut ? ` à ${current.checkOut}` : '' }}
                · {{ current.nights }} nuit{{ current.nights > 1 ? 's' : '' }}<template v-if="current.total"> · {{ eur(current.total) }}</template>
              </p>
            </div>
            <div class="flex flex-wrap justify-end gap-1">
              <UBadge v-if="phase(current) === 'now'" color="success" label="En cours" />
              <UBadge v-else-if="phase(current) === 'next'" color="info" variant="subtle" label="À venir" />
              <UBadge :color="statusColor(current.status)" variant="subtle" :label="current.status" />
              <PlatformBadge :source="current.source" />
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge v-if="current.code" :color="current.code === 'created' ? 'success' : current.code === 'error' ? 'error' : 'neutral'" variant="subtle"
                    :label="current.code === 'created' ? 'Code créé sur Nuki' : current.code === 'error' ? 'Erreur de création du code' : 'Code prévu'" />
            <UButton v-if="current.mails" size="xs" color="neutral" variant="soft" icon="i-lucide-mail" :label="`${current.mails} e-mail${current.mails > 1 ? 's' : ''}`" :to="`/mail?booking=${current.id}`" title="E-mails rattachés à cette réservation" />
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
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
      </template>
      <UCard v-else><p class="text-sm text-muted">Sélectionne une réservation dans la liste.</p></UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const [{ data }, { data: livretData }] = await Promise.all([
  useFetch(() => `/api/logements/${route.params.id}/reservations`),
  // Aperçu du livret (welcomescreen), en encart : même token que l'onglet Livret Accueil.
  useFetch(() => `/api/logements/${route.params.id}/livret`),
])
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const today = new Date().toISOString().slice(0, 10)
const phase = (b: { active: boolean; arrival: string; departure: string }) =>
  !b.active ? 'other' : b.arrival <= today && b.departure > today ? 'now' : b.arrival > today ? 'next' : 'past'
// Reservation selectionnee (colonne de droite) : par defaut celle en cours, sinon la premiere de la liste (la plus recente/proche)
const selected = ref<number | null>(null)
watchEffect(() => {
  if (selected.value !== null && data.value?.items.some(b => b.id === selected.value)) return
  const items = data.value?.items ?? []
  selected.value = (items.find(b => phase(b) === 'now') ?? items[0])?.id ?? null
})
const current = computed(() => data.value?.items.find(b => b.id === selected.value) ?? null)
const statusColor = (s: string) => /book/i.test(s) ? 'success' : /declin|cancel/i.test(s) ? 'error' : 'info'
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const eur = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
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
