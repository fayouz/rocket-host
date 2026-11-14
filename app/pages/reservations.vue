<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">Réservations · tous les logements</h1>
    <p class="mb-4 text-sm text-muted">Les 60 derniers jours et toutes les réservations à venir de tes logements. Clique sur une ligne pour ouvrir la réservation (conversation, code, livret) dans son logement.</p>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Rechercher un voyageur…" class="min-w-56 flex-1" />
      <USelect v-model="lgFilter" :items="lgItems" class="w-56" />
      <USelect v-model="filter" :items="filterItems" class="w-40" />
      <UButton color="neutral" variant="outline" square :icon="sortAsc ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-narrow-wide'"
               :title="sortAsc ? 'Plus anciennes en premier' : 'Plus récentes en premier'" @click="sortAsc = !sortAsc" />
    </div>
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <p v-if="pending" class="p-4 text-sm text-muted">Chargement…</p>
      <p v-else-if="!rows.length" class="p-4 text-sm text-muted">Aucune réservation{{ all.length ? ' pour ce filtre' : ' sur cette période' }}.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-muted">
            <tr class="border-b border-default">
              <th class="px-4 py-2 font-medium">Logement</th><th class="px-4 py-2 font-medium">Voyageur</th><th class="px-4 py-2 font-medium">Séjour</th>
              <th class="px-4 py-2 font-medium">État</th><th class="px-4 py-2 font-medium">Source</th><th class="px-4 py-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="b in rows" :key="`${b.lgId}-${b.id}`" class="cursor-pointer hover:bg-elevated" :class="{ 'opacity-60': !b.active }"
                @click="navigateTo(`/logements/${b.lgId}/reservations?booking=${b.id}`)">
              <td class="px-4 py-2"><span class="inline-flex items-center gap-1.5 whitespace-nowrap"><span class="inline-block size-2 rounded-full" :class="!b.hex && 'bg-muted'" :style="b.hex ? { backgroundColor: b.hex } : {}" />{{ b.lgName }}</span></td>
              <td class="px-4 py-2 font-medium">{{ b.guest }}</td>
              <td class="whitespace-nowrap px-4 py-2">{{ fr(b.arrival) }} → {{ fr(b.departure) }} · {{ b.nights }} nuit{{ b.nights > 1 ? 's' : '' }}</td>
              <td class="px-4 py-2">
                <UBadge v-if="!b.active" size="sm" color="error" variant="subtle" :label="b.status" />
                <UBadge v-else-if="phase(b) === 'now'" size="sm" color="success" label="En cours" />
                <UBadge v-else-if="phase(b) === 'next'" size="sm" color="info" variant="subtle" label="À venir" />
                <UBadge v-else size="sm" color="neutral" variant="subtle" label="Passée" />
              </td>
              <td class="px-4 py-2"><PlatformBadge :source="b.source" /></td>
              <td class="whitespace-nowrap px-4 py-2 text-right">{{ b.total ? eur(b.total) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
// Vue « Tous les logements » des réservations : réutilise l'API par logement (/api/logements/:id/reservations),
// appelée pour chaque logement autorisé (la liste /api/logements est déjà filtrée), puis fusionnée.
interface Booking { id: number; guest: string; source: string; status: string; arrival: string; departure: string; nights: number; total: number; active: boolean }
const { logements } = useLogementChoice()
const demo = useState('demo')
const fetchWithSession = useRequestFetch() // rendu serveur : transmet le cookie de session
const { data, pending } = await useAsyncData('reservations-all', async () => {
  const lists = await Promise.all(logements.value.map(l => fetchWithSession<{ demo?: boolean; items: Booking[] }>(`/api/logements/${l.id}/reservations`).catch(() => null)))
  if (lists.some(r => r?.demo)) demo.value = true
  return logements.value.flatMap((l, i) => (lists[i]?.items ?? []).map(b => ({ ...b, lgId: l.id, lgName: l.name, hex: logementColorHex(l.color) })))
}, { watch: [() => logements.value.length] })
const all = computed(() => data.value ?? [])

const today = new Date().toISOString().slice(0, 10)
const phase = (b: Booking) => !b.active ? 'other' : b.arrival <= today && b.departure > today ? 'now' : b.arrival > today ? 'next' : 'past'
const search = ref('')
const lgFilter = ref('all')
const lgItems = computed(() => [{ label: 'Tous les logements', value: 'all' }, ...logements.value.map(l => ({ label: l.name, value: String(l.id) }))])
const filter = ref<'all' | 'now' | 'next' | 'past' | 'cancelled'>('all')
const filterItems = [
  { label: 'Toutes', value: 'all' }, { label: 'En cours', value: 'now' }, { label: 'À venir', value: 'next' },
  { label: 'Passées', value: 'past' }, { label: 'Annulées', value: 'cancelled' },
]
const sortAsc = ref(false)
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return all.value.filter((b) => {
    if (lgFilter.value !== 'all' && String(b.lgId) !== lgFilter.value) return false
    if (q && !b.guest.toLowerCase().includes(q)) return false
    if (filter.value === 'cancelled') return !b.active
    if (filter.value !== 'all') return b.active && phase(b) === filter.value
    return true
  }).sort((a, b) => sortAsc.value ? a.arrival.localeCompare(b.arrival) : b.arrival.localeCompare(a.arrival))
})
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const eur = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
</script>
