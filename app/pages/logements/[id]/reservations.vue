<template>
  <div v-if="data" class="flex flex-col gap-4 lg:h-[calc(100vh-11rem)] lg:flex-row">
    <!-- Colonne gauche : liste compacte, comme la boite de reception d'un client mail -->
    <div class="min-w-0 space-y-1 overflow-y-auto lg:w-80 lg:shrink-0 lg:border-r lg:border-default lg:pr-3">
      <h2 class="section-title !mt-0">Réservations</h2>
      <div class="mb-2 space-y-2">
        <UInput v-model="search" icon="i-lucide-search" placeholder="Rechercher un voyageur…" size="sm" class="w-full" />
        <div class="flex items-center gap-1.5">
          <USelect v-model="filter" :items="filterItems" size="sm" class="flex-1" />
          <UButton
            size="sm" color="neutral" variant="outline" square :icon="sortAsc ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-narrow-wide'"
            :title="sortAsc ? 'Plus anciennes en premier' : 'Plus récentes en premier'" @click="sortAsc = !sortAsc"
          />
        </div>
      </div>
      <button
        v-for="b in filteredItems" :key="b.id" type="button" class="block w-full rounded-md p-2.5 text-left transition-colors"
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
      <p v-if="!filteredItems.length" class="text-sm text-muted">Aucune réservation{{ data.items.length ? ' pour ce filtre' : ' sur cette période' }}.</p>
    </div>

    <!-- Colonne droite : detail de la reservation selectionnee (2/3), comme le contenu d'un e-mail, + apercu du livret (1/3) -->
    <div v-if="current" class="grid min-w-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-3">
      <UCard class="lg:col-span-2">
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

        <h4 class="mt-6 mb-3 flex items-center gap-1.5 text-sm font-semibold"><UIcon name="i-lucide-messages-square" class="size-4 text-muted" /> Conversation</h4>
        <p v-if="convStatus === 'pending'" class="text-sm text-muted">Chargement…</p>
        <p v-else-if="convError" class="text-sm text-muted">Conversation indisponible pour le moment.</p>
        <p v-else-if="!conv?.messages.length" class="text-sm text-muted">Aucun message.</p>
        <div v-else class="space-y-3">
          <div v-for="m in conv.messages" :key="m.id" class="flex" :class="m.from === 'host' ? 'justify-end' : 'justify-start'">
            <div class="max-w-[85%] rounded-lg px-3 py-2 text-sm" :class="m.from === 'host' ? 'bg-primary/10' : 'bg-elevated'">
              <p class="mb-1 text-xs text-muted">
                {{ m.from === 'host' ? 'Toi' : current.guest }} · {{ when(m.at) }}<template v-if="m.from === 'host' && m.status"> · {{ m.status === 'Delivered' ? 'Délivré' : m.status }}</template>
              </p>
              <p v-if="m.from === 'host' && m.subject" class="mb-1 font-medium">{{ m.subject }}</p>
              <p class="whitespace-pre-line">{{ m.text }}</p>
            </div>
          </div>
        </div>
      </UCard>

      <UCard class="lg:col-span-1" :ui="{ body: 'p-0 sm:p-0' }">
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
    <UCard v-else class="min-w-0 flex-1"><p class="text-sm text-muted">Sélectionne une réservation dans la liste.</p></UCard>
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
// Classement et filtre de la liste (colonne de gauche) : recherche par voyageur, filtre par etat, ordre par date d'arrivee
const search = ref('')
const filter = ref<'all' | 'now' | 'next' | 'past' | 'cancelled'>('all')
const filterItems = [
  { label: 'Toutes', value: 'all' },
  { label: 'En cours', value: 'now' },
  { label: 'À venir', value: 'next' },
  { label: 'Passées', value: 'past' },
  { label: 'Annulées', value: 'cancelled' },
]
const sortAsc = ref(false) // par defaut : les plus recentes en premier (meme ordre que l'API)
const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  const items = (data.value?.items ?? []).filter((b) => {
    if (q && !b.guest.toLowerCase().includes(q)) return false
    if (filter.value === 'cancelled') return !b.active
    if (filter.value !== 'all') return b.active && phase(b) === filter.value
    return true
  })
  return [...items].sort((a, b) => sortAsc.value ? a.arrival.localeCompare(b.arrival) : b.arrival.localeCompare(a.arrival))
})
// Reservation selectionnee (colonne de droite) : par defaut celle en cours, sinon la premiere de la liste filtree (la plus recente/proche)
const selected = ref<number | null>(null)
watchEffect(() => {
  if (selected.value !== null && filteredItems.value.some(b => b.id === selected.value)) return
  const items = filteredItems.value
  selected.value = (items.find(b => phase(b) === 'now') ?? items[0])?.id ?? null
})
const current = computed(() => data.value?.items.find(b => b.id === selected.value) ?? null)
// Fil de conversation Lodgify de la reservation selectionnee (charge a la selection, cote client)
const { data: conv, status: convStatus, error: convError } = useFetch(
  () => `/api/logements/${route.params.id}/reservations/${selected.value}/conversation`,
  { server: false, immediate: !!selected.value, watch: [selected] },
)
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
