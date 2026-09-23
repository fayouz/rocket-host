<template>
  <div v-if="data" class="space-y-6">
    <!-- En-tete : salutation + statut + actions rapides -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Bonjour{{ user?.displayName ? `, ${user.displayName.split(' ')[0]}` : '' }} 👋</h1>
        <p class="text-muted">Voici l'état de tes logements aujourd'hui.</p>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-success" /> Système opérationnel</span>
          <span class="hidden sm:inline">·</span>
          <span>Dernière synchro {{ timeAgo(data.syncedAt) }}</span>
          <span class="hidden sm:inline">·</span>
          <span class="capitalize">{{ nowLabel }}</span>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <USelectMenu
          v-model="selectedLogements" :items="logementItems" multiple value-key="value" :placeholder="filterLabel"
          icon="i-lucide-building-2" class="w-56"
        >
          <template #default>
            <span class="truncate">{{ filterLabel }}</span>
          </template>
        </USelectMenu>
        <UDropdownMenu :items="quickActions" :content="{ align: 'end' }">
          <UButton color="neutral" variant="outline" icon="i-lucide-zap" label="Actions rapides" trailing-icon="i-lucide-chevron-down" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- KPI du jour -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="grid grid-cols-2 divide-y divide-default sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        <div v-for="k in kpis" :key="k.label" class="space-y-2 p-4">
          <div class="flex items-center gap-2">
            <span class="flex size-8 items-center justify-center rounded-full" :style="{ backgroundColor: `color-mix(in oklab, ${k.color} 15%, transparent)` }">
              <UIcon :name="k.icon" class="size-4" :style="{ color: k.color }" />
            </span>
            <p class="text-xs font-medium uppercase tracking-wide text-muted">{{ k.label }}</p>
          </div>
          <div class="flex items-baseline gap-2">
            <p class="text-2xl font-bold">{{ k.value }}</p>
            <UBadge v-if="k.trend !== undefined && k.trend !== null" size="sm" :color="k.trend >= 0 ? 'success' : 'error'" variant="subtle" class="rounded-full">
              {{ k.trend >= 0 ? '+' : '' }}{{ k.trend }}%
            </UBadge>
          </div>
        </div>
      </div>
    </UCard>

    <div v-if="revenueByMonth.length" class="grid gap-6 lg:grid-cols-2">
      <UCard>
        <template #header>
          <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-euro" class="size-3.5" /> Revenus des 6 derniers mois</p>
          <p class="mt-1 text-2xl font-bold">{{ eur(revenueThisMonth) }}</p>
        </template>
        <AreaChart :series="[{ label: 'Revenus', color: 'var(--ui-primary)', data: revenueByMonth.map(m => m.value), fill: true }]" :labels="revenueByMonth.map(m => m.label)" :height="180" />
      </UCard>
      <UCard>
        <template #header>
          <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-scale" class="size-3.5" /> Revenus vs charges</p>
          <p class="mt-1 text-2xl font-bold">{{ eur(revenueThisMonth - chargesThisMonth) }} <span class="text-sm font-normal text-muted">de marge ce mois</span></p>
        </template>
        <AreaChart :series="revenueVsCharges" :labels="revenueByMonth.map(m => m.label)" :height="180" />
      </UCard>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
    <!-- Colonne gauche (2/3) : vue d'ensemble (turnover, stock, serrures) + la journee (arrivees, departs, prochaines) -->
    <div class="min-w-0 space-y-2 lg:col-span-2">
      <h2 class="section-title !mt-0">Vue d'ensemble</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <TurnoverWidget :properties="selectedPropertyIds" />
        <StockWidget :properties="selectedPropertyIds" />
        <LocksWidget :properties="selectedPropertyIds" />
      </div>

      <h2 class="section-title">La journée</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <UCard v-for="s in sections" :key="s.title" :ui="{ root: 'flex aspect-square flex-col', body: 'min-h-0 flex-1 overflow-y-auto' }">
          <template #header>
            <h3 class="flex items-center gap-1.5 font-semibold"><UIcon :name="s.icon" class="size-4 text-muted" /> {{ s.title }}</h3>
          </template>
          <p v-if="!s.items.length" class="text-sm text-muted">Aucune</p>
          <ul v-else class="space-y-3">
            <li v-for="b in s.items" :key="b.id" class="text-sm">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="flex items-center gap-1.5 font-medium"><LogementDot :property-id="b.propertyId" /> {{ b.property }}</span>
                <PlatformBadge :source="b.source" />
              </div>
              <p class="text-muted">{{ b.guest }} · {{ fr(b.arrival) }} → {{ fr(b.departure) }}</p>
            </li>
          </ul>
        </UCard>
      </div>
    </div>

    <!-- Colonne droite (1/3) : contacts et timeline de tous les logements, memes rangee que la vue d'ensemble -->
    <aside class="min-w-0 space-y-4 lg:col-span-1">
      <ContactsWidget />
      <UCard v-if="tl">
        <template #header>
          <div>
            <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-history" class="size-4 text-muted" /> Timeline · tous les logements</h3>
            <p class="text-sm text-muted">Hier et les 7 prochains jours : séjours, codes, ménages, messages et réassort.</p>
          </div>
        </template>
        <div ref="tlBox" class="relative lg:max-h-[34rem] lg:overflow-y-auto lg:pr-2">
          <EventTimeline :events="events" :now="tl.now" />
        </div>
      </UCard>
    </aside>
    </div>

    <UCard v-if="occupancyByMonth.length">
      <template #header>
        <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-percent" class="size-3.5" /> Taux d'occupation des 6 derniers mois</p>
        <p class="mt-1 text-2xl font-bold">{{ occupancyThisMonth }} % <span class="text-sm font-normal text-muted">ce mois-ci</span></p>
      </template>
      <AreaChart
        :series="[{ label: 'Occupation', color: 'var(--ui-secondary)', data: occupancyByMonth.map(m => m.value), fill: true }]"
        :labels="occupancyByMonth.map(m => m.label)" :height="160"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { user, can } = useAuth()
const nowLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const quickActions = computed(() => [[
  can('A') && { label: 'Nouvel utilisateur', icon: 'i-lucide-user-plus', to: '/settings/utilisateurs' },
  can('AGC') && { label: 'Nouveau document', icon: 'i-lucide-file-plus', to: '/documents' },
  can('A') && { label: 'Nouveau contact', icon: 'i-lucide-contact', to: '/contacts' },
].filter(Boolean)])

// Filtre "logements" a cote d'Actions rapides : recalcule le tableau de bord sur le perimetre choisi (vide = tous).
// On selectionne par id de logement (plus lisible), et on convertit en id Lodgify (propertyId) pour filtrer les
// donnees Lodgify/DB cote serveur (?properties=..., voir server/utils/scope.ts#effectivePropertyIds).
const { data: lg } = await useFetch('/api/logements', { key: 'logements' })
const selectedLogements = ref<number[]>([])
const logementItems = computed(() => (lg.value?.logements ?? []).map(l => ({ label: l.name, value: l.id })))
const filterLabel = computed(() => !selectedLogements.value.length ? 'Tous les logements' : selectedLogements.value.length === 1 ? logementItems.value.find(i => i.value === selectedLogements.value[0])?.label ?? '1 logement' : `${selectedLogements.value.length} logements`)
const selectedPropertyIds = computed(() => (lg.value?.logements ?? []).filter(l => selectedLogements.value.includes(l.id) && l.lodgifyPropertyId !== null).map(l => l.lodgifyPropertyId as number))
const propertiesQuery = computed(() => selectedPropertyIds.value.length ? selectedPropertyIds.value.join(',') : undefined)

const { data } = await useFetch('/api/today', { query: { properties: propertiesQuery } })
const { data: tl } = await useFetch('/api/timeline', { query: { past: 1, future: 7, properties: propertiesQuery } })
const events = computed(() => (tl.value?.properties ?? []).flatMap(p => p.events.map(e => ({ ...e, property: p.name, propertyId: p.id }))).sort((a, b) => a.at.localeCompare(b.at)))
// Colonne timeline : au chargement, fait defiler jusqu'au dernier evenement passe (le "maintenant")
const tlBox = ref<HTMLElement | null>(null)
onMounted(() => setTimeout(() => {
  const box = tlBox.value
  if (!box || box.scrollHeight <= box.clientHeight) return // petit ecran : pas de cadre defilant
  const last = events.value.filter(e => e.at <= tl.value!.now).length - 1
  // On garde un evenement passe au-dessus du "maintenant" pour le contexte
  const item = box.querySelectorAll('[data-slot="item"]')[Math.max(0, last - 1)] as HTMLElement | undefined
  if (item) box.scrollTop = Math.max(0, item.offsetTop - 8)
}, 150))
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const sections = computed(() => data.value ? [
  { title: 'Arrivées', icon: 'i-lucide-log-in', items: data.value.arrivals },
  { title: 'Départs', icon: 'i-lucide-log-out', items: data.value.departures },
  { title: 'Prochaines arrivées', icon: 'i-lucide-calendar-clock', items: data.value.upcoming },
] : [])

// KPI et graphe (revenus/occupation) : reservés au role admin cote serveur (/api/profit, /api/stock) — la requete
// echoue silencieusement pour les autres roles (comme StockWidget), les cartes correspondantes restent simplement
// masquees (v-if="profit"/"stock" dans le template) plutot que d'afficher une erreur genante sur le tableau de bord.
const { data: profit } = await useFetch('/api/profit', { query: { properties: propertiesQuery } })
const { data: stock } = await useFetch('/api/stock', { query: { properties: propertiesQuery } })
const eur = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €'
const months = computed(() => profit.value?.months ?? [])
function monthTotal(m: { byProperty: { revenue: number; nights: number; occupancy: number }[] } | undefined) {
  if (!m) return { revenue: 0, occupancy: 0 }
  const revenue = m.byProperty.reduce((s, p) => s + p.revenue, 0)
  const occupancy = m.byProperty.length ? Math.round(m.byProperty.reduce((s, p) => s + p.occupancy, 0) / m.byProperty.length) : 0
  return { revenue, occupancy }
}
const revenueThisMonth = computed(() => monthTotal(months.value.at(-1)).revenue)
const chargesThisMonth = computed(() => months.value.at(-1)?.charges ?? 0)
const occupancyThisMonth = computed(() => monthTotal(months.value.at(-1)).occupancy)
const revenueTrend = computed(() => {
  const prev = monthTotal(months.value.at(-2)).revenue
  if (!prev) return null
  return Math.round(100 * (revenueThisMonth.value - prev) / prev)
})
const monthLabel = (m: string) => new Date(`${m}-01`).toLocaleDateString('fr-FR', { month: 'short' })
const revenueByMonth = computed(() => months.value.slice(-6).map(m => ({ label: monthLabel(m.month), value: monthTotal(m).revenue })))
const revenueVsCharges = computed(() => {
  const last6 = months.value.slice(-6)
  return [
    { label: 'Revenus', color: 'var(--ui-primary)', data: last6.map(m => monthTotal(m).revenue), fill: true },
    { label: 'Charges', color: 'var(--ui-error)', data: last6.map(m => m.charges) },
  ]
})
const occupancyByMonth = computed(() => months.value.slice(-6).map(m => ({ label: monthLabel(m.month), value: monthTotal(m).occupancy })))

// Cartes KPI : les 2 premieres toujours visibles (role AG), les suivantes seulement si les donnees admin ont pu
// etre chargees (profit/stock nuls pour un role sans acces, voir le commentaire au-dessus des deux useFetch).
const kpis = computed(() => [
  { label: 'Ménages aujourd\'hui', value: String(data.value?.turnovers.length ?? 0), icon: 'i-lucide-sparkles', color: 'var(--ui-warning)' },
  { label: 'Arrivées (7 j)', value: String(data.value?.arrivalsNext7 ?? 0), icon: 'i-lucide-calendar-check', color: 'var(--ui-info)' },
  profit.value && { label: 'Revenus ce mois', value: eur(revenueThisMonth.value), icon: 'i-lucide-euro', color: 'var(--ui-primary)', trend: revenueTrend.value },
  profit.value && { label: 'Occupation ce mois', value: `${occupancyThisMonth.value} %`, icon: 'i-lucide-percent', color: 'var(--ui-secondary)' },
  stock.value && { label: 'À racheter', value: String(stock.value.shopping.length), icon: 'i-lucide-shopping-cart', color: 'var(--ui-error)' },
].filter((k): k is { label: string; value: string; icon: string; color: string; trend?: number | null } => !!k))
</script>
