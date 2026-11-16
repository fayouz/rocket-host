<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">{{ t('daily.resAll.title') }}</h1>
    <p class="mb-4 text-sm text-muted">{{ t('daily.resAll.intro') }}</p>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('daily.common.searchGuest')" class="min-w-56 flex-1" />
      <USelect v-model="lgFilter" :items="lgItems" class="w-56" />
      <USelect v-model="filter" :items="filterItems" class="w-40" />
      <UButton color="neutral" variant="outline" square :icon="sortAsc ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-narrow-wide'"
               :title="sortAsc ? t('daily.common.oldestFirst') : t('daily.common.newestFirst')" @click="sortAsc = !sortAsc" />
    </div>
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <p v-if="pending" class="p-4 text-sm text-muted">{{ t('daily.common.loading') }}</p>
      <p v-else-if="!rows.length" class="p-4 text-sm text-muted">{{ all.length ? t('daily.common.noneFilter') : t('daily.common.nonePeriod') }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-muted">
            <tr class="border-b border-default">
              <th class="px-4 py-2 font-medium">{{ t('daily.resAll.property') }}</th><th class="px-4 py-2 font-medium">{{ t('daily.resAll.guest') }}</th><th class="px-4 py-2 font-medium">{{ t('daily.resAll.stay') }}</th>
              <th class="px-4 py-2 font-medium">{{ t('daily.resAll.state') }}</th><th class="px-4 py-2 font-medium">{{ t('daily.resAll.source') }}</th><th class="px-4 py-2 text-right font-medium">{{ t('daily.resAll.amount') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="b in rows" :key="`${b.lgId}-${b.id}`" class="cursor-pointer hover:bg-elevated" :class="{ 'opacity-60': !b.active }"
                @click="navigateTo(`/logements/${b.lgId}/reservations?booking=${b.id}`)">
              <td class="px-4 py-2"><span class="inline-flex items-center gap-1.5 whitespace-nowrap"><span class="inline-block size-2 rounded-full" :class="!b.hex && 'bg-muted'" :style="b.hex ? { backgroundColor: b.hex } : {}" />{{ b.lgName }}</span></td>
              <td class="px-4 py-2 font-medium">{{ b.guest }}</td>
              <td class="whitespace-nowrap px-4 py-2">{{ fr(b.arrival) }} → {{ fr(b.departure) }} · {{ t('daily.common.nights', { n: b.nights }, b.nights) }}</td>
              <td class="px-4 py-2">
                <UBadge v-if="!b.active" size="sm" color="error" variant="subtle" :label="b.status" />
                <UBadge v-else-if="phase(b) === 'now'" size="sm" color="success" :label="t('daily.common.now')" />
                <UBadge v-else-if="phase(b) === 'next'" size="sm" color="info" variant="subtle" :label="t('daily.common.next')" />
                <UBadge v-else size="sm" color="neutral" variant="subtle" :label="t('daily.common.pastOne')" />
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
const { t } = useI18n()
const { fmtLocale, num } = useLocaleFormat()
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
const lgItems = computed(() => [{ label: t('daily.dashboard.allLogements'), value: 'all' }, ...logements.value.map(l => ({ label: l.name, value: String(l.id) }))])
const filter = ref<'all' | 'now' | 'next' | 'past' | 'cancelled'>('all')
const filterItems = computed(() => [
  { label: t('daily.common.fAll'), value: 'all' }, { label: t('daily.common.now'), value: 'now' }, { label: t('daily.common.next'), value: 'next' },
  { label: t('daily.common.fPast'), value: 'past' }, { label: t('daily.common.fCancelled'), value: 'cancelled' },
])
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
const fr = (d: string) => new Date(d).toLocaleDateString(fmtLocale.value, { weekday: 'short', day: 'numeric', month: 'short' })
const eur = (n: number) => num(n, { maximumFractionDigits: 0 }) + ' €'
</script>
