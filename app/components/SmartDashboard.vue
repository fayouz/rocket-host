<template>
  <div class="space-y-6">
    <!-- En-tete -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Bonjour{{ user?.displayName ? `, ${user.displayName.split(' ')[0]}` : '' }} 👋</h1>
        <p class="text-muted">Tes briques Rocket, croisées en un coup d'œil.</p>
        <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <UBadge
            v-for="b in brickList" :key="b.key" size="sm" variant="subtle" :color="b.ok ? 'success' : 'error'"
            :icon="b.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" :label="b.name" :title="b.error || (b.ms !== null ? `${b.ms} ms` : '')"
          />
          <span class="ml-1 text-muted">Mis à jour {{ updatedLabel }} · rafraîchi toutes les 5 min</span>
        </div>
      </div>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" label="Rafraîchir" :loading="pending" @click="refresh()" />
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Tableau de bord indisponible" :description="error.statusMessage || String(error)" />

    <template v-if="d">
      <!-- Alertes croisees -->
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-siren" class="size-4" /> Alertes croisées
              <UBadge v-if="d.alerts.length" size="sm" :color="d.alerts[0]!.level === 'critical' ? 'error' : 'warning'" variant="subtle" :label="String(d.alerts.length)" />
            </p>
            <span class="text-xs text-muted">triées par urgence</span>
          </div>
        </template>
        <p v-if="!d.alerts.length" class="flex items-center gap-2 p-4 text-sm text-muted"><UIcon name="i-lucide-party-popper" class="size-4 text-success" /> Rien à signaler : tout est prêt.</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="(a, i) in d.alerts" :key="i">
            <NuxtLink :to="a.link" class="flex items-start gap-3 px-4 py-2.5 hover:bg-elevated/50">
              <UIcon :name="LEVEL[a.level].icon" class="mt-0.5 size-4 shrink-0" :class="LEVEL[a.level].text" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{{ a.title }}</p>
                <p class="truncate text-xs text-muted">{{ a.detail }}</p>
              </div>
              <UBadge size="sm" color="neutral" variant="outline" :label="d.bricks[a.brick].name" class="shrink-0" />
            </NuxtLink>
          </li>
        </ul>
      </UCard>

      <!-- Aujourd'hui et demain -->
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-log-in" class="size-4" /> Arrivées aujourd'hui et demain</p>
            <SourceTags :keys="['pms', ...(d.columns.cleaning || d.columns.linen ? ['clean'] : []), ...(d.bricks.place.configured ? ['place'] : []), ...(d.columns.screen ? ['cast'] : []), ...(d.bricks.stock.configured ? ['stock'] : [])]" :bricks="d.bricks" />
          </div>
        </template>
        <p v-if="!d.arrivals.length" class="p-4 text-sm text-muted">Aucune arrivée aujourd'hui ni demain.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr class="border-b border-default">
                <th class="px-4 py-2">Logement</th><th class="px-2 py-2">Voyageur</th><th class="px-2 py-2">Heure</th>
                <th v-if="d.columns.cleaning" class="px-2 py-2">Ménage</th>
                <th v-if="d.columns.linen" class="px-2 py-2">Linge</th>
                <th v-if="d.columns.access" class="px-2 py-2">Accès</th>
                <th v-if="d.columns.screen" class="px-2 py-2">Écran</th>
                <th v-if="d.columns.payment" class="px-2 py-2">Paiement</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="a in d.arrivals" :key="a.key">
                <td class="px-4 py-2">
                  <NuxtLink :to="a.propertyId ? `/logements/${a.propertyId}/reservations` : '/logements'" class="flex items-center gap-2 font-medium hover:underline">
                    <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: a.color || 'var(--ui-primary)' }" />{{ a.propertyName }}
                  </NuxtLink>
                </td>
                <td class="px-2 py-2">{{ a.guest || '—' }} <span class="text-xs text-muted">· {{ a.source }}</span></td>
                <td class="whitespace-nowrap px-2 py-2"><UBadge size="sm" :color="a.day === 'today' ? 'primary' : 'neutral'" variant="subtle" :label="a.day === 'today' ? 'auj.' : 'demain'" /> {{ a.time }}</td>
                <td v-if="d.columns.cleaning" class="px-2 py-2"><Pill v-bind="CLEAN[a.cleaning?.status ?? 'none']" :title="a.cleaning?.label" /></td>
                <td v-if="d.columns.linen" class="px-2 py-2"><Pill v-bind="LINEN[a.linen ?? 'unknown']" /></td>
                <td v-if="d.columns.access" class="px-2 py-2"><Pill v-if="a.access" v-bind="ACCESS[a.access.status]" :title="a.access.detail" /></td>
                <td v-if="d.columns.screen" class="px-2 py-2"><Pill v-if="a.screen" v-bind="SCREEN[a.screen.status]" :title="a.screen.name" /></td>
                <td v-if="d.columns.payment" class="whitespace-nowrap px-2 py-2">
                  <template v-if="a.payment"><Pill v-if="a.payment.due > 0" color="warning" icon="i-lucide-hourglass" :label="`${eur(a.payment.due)} dû`" /><Pill v-else color="success" icon="i-lucide-check" label="payé" /></template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-log-out" class="size-4" /> Départs aujourd'hui et demain</p>
            <SourceTags :keys="['pms', ...(d.columns.cleaning ? ['clean'] : [])]" :bricks="d.bricks" />
          </div>
        </template>
        <p v-if="!d.departures.length" class="p-4 text-sm text-muted">Aucun départ aujourd'hui ni demain.</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="x in d.departures" :key="x.key" class="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <UBadge size="sm" :color="x.day === 'today' ? 'primary' : 'neutral'" variant="subtle" :label="x.day === 'today' ? 'auj.' : 'demain'" />
            <span class="w-12 text-muted">{{ x.time }}</span>
            <NuxtLink :to="x.propertyId ? `/logements/${x.propertyId}/timeline` : '/logements'" class="font-medium hover:underline">{{ x.propertyName }}</NuxtLink>
            <span class="text-muted">{{ x.guest }}</span>
            <span class="ml-auto">
              <Pill v-if="x.cleaningPlanned === true" v-bind="CLEAN[x.cleaningStatus ?? 'todo']" />
              <Pill v-else-if="x.cleaningPlanned === false" color="error" icon="i-lucide-x" label="pas de ménage" />
            </span>
          </li>
        </ul>
      </UCard>

      <!-- Finances en contexte -->
      <div v-if="d.finances" class="grid gap-4 lg:grid-cols-3">
        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-euro" class="size-4" /> Mois en cours ({{ monthLabel }})</p>
              <SourceTags :keys="['pms', ...(d.finances.cleaningCost !== null ? ['clean'] : [])]" :bricks="d.bricks" />
            </div>
          </template>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label="Revenus" :value="eur(d.finances.revenue)" />
            <Kpi label="Occupation moy." :value="`${d.finances.occupancy} %`" />
            <Kpi v-if="d.finances.cleaningCost !== null" label="Ménages (location)" :value="eur(d.finances.cleaningCost)" :hint="d.finances.cleaningShare !== null ? `${d.finances.cleaningShare} % des revenus` : ''" />
            <Kpi v-if="d.finances.stockConsumption !== null" label="Conso. stock (location)" :value="eur(d.finances.stockConsumption)" hint="Rocket Stock" />
          </div>
          <table class="mt-4 w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr><th class="py-1">Logement</th><th class="py-1 text-right">Revenus</th><th class="py-1 text-right">Nuits</th><th class="py-1">Occupation</th><th v-if="d.finances.cleaningCost !== null" class="py-1 text-right">Ménages</th></tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="p in d.finances.properties" :key="p.name">
                <td class="py-1.5"><span class="mr-1.5 inline-block size-2 rounded-full" :style="{ backgroundColor: p.color || 'var(--ui-primary)' }" />{{ p.name }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ eur(p.revenue) }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ p.nights }}</td>
                <td class="py-1.5 pl-3"><div class="flex items-center gap-2"><div class="h-1.5 w-24 overflow-hidden rounded-full bg-elevated"><div class="h-full rounded-full bg-primary" :style="{ width: `${Math.min(100, p.occupancy)}%` }" /></div><span class="text-xs tabular-nums text-muted">{{ p.occupancy }} %</span></div></td>
                <td v-if="d.finances.cleaningCost !== null" class="py-1.5 text-right tabular-nums">{{ p.cleaningCost === null ? '—' : eur(p.cleaningCost) }}</td>
              </tr>
            </tbody>
          </table>
        </UCard>
        <div class="space-y-4">
          <UCard>
            <template #header><p class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-telescope" class="size-4" /> 30 prochains jours</p></template>
            <p class="text-2xl font-bold">{{ eur(d.finances.forecast.revenue) }}</p>
            <p class="text-sm text-muted">{{ d.finances.forecast.bookings }} réservation(s) confirmée(s), {{ d.finances.forecast.nights }} nuits</p>
            <p class="mt-2 text-xs text-dimmed">Arrivées du {{ fmtDay(d.finances.forecast.from) }} au {{ fmtDay(d.finances.forecast.to) }} · Rocket PMS</p>
          </UCard>
          <UCard>
            <template #header><p class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-split" class="size-4" /> Par canal (ce mois)</p></template>
            <p v-if="!d.finances.channels.length" class="text-sm text-muted">Aucune nuit ce mois-ci.</p>
            <ul v-else class="space-y-1.5 text-sm">
              <li v-for="c in d.finances.channels" :key="c.source" class="flex items-center justify-between gap-2">
                <PlatformBadge :source="c.source" /><span class="tabular-nums">{{ eur(c.revenue) }} <span class="text-xs text-muted">· {{ c.nights }} n.</span></span>
              </li>
            </ul>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Tableau de bord intelligent (accueil quand Rocket PMS est branche) : une seule route GET /api/dashboard/smart croise
// PMS, Place, Clean, Stock et Cast. Chaque widget indique ses briques sources ; une brique en panne vide seulement sa
// colonne et ajoute une alerte. Rafraichissement manuel + automatique toutes les 5 minutes.
const { user } = useAuth()
const { data: d, pending, error, refresh } = await useFetch('/api/dashboard/smart', { key: 'smart-dashboard' })

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 5 * 60 * 1000) })
onBeforeUnmount(() => clearInterval(timer))

const nowTick = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => { tick = setInterval(() => (nowTick.value = Date.now()), 30 * 1000) })
onBeforeUnmount(() => clearInterval(tick))
const updatedLabel = computed(() => {
  if (!d.value) return '—'
  const s = Math.max(0, Math.round((nowTick.value - Date.parse(d.value.generatedAt)) / 1000))
  return s < 60 ? "à l'instant" : `il y a ${Math.round(s / 60)} min`
})

const brickList = computed(() => (d.value ? Object.entries(d.value.bricks).filter(([, b]) => b.configured).map(([key, b]) => ({ key, ...b })) : []))
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: d.value?.finances?.currency || 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const fmtDay = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const monthLabel = computed(() => (d.value ? new Date(`${d.value.month}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : ''))

type C = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary'
const LEVEL = { critical: { icon: 'i-lucide-octagon-alert', text: 'text-error' }, warning: { icon: 'i-lucide-triangle-alert', text: 'text-warning' }, info: { icon: 'i-lucide-info', text: 'text-info' } } as const
const CLEAN: Record<string, { color: C; icon: string; label: string }> = {
  done: { color: 'success', icon: 'i-lucide-check', label: 'fait' }, in_progress: { color: 'info', icon: 'i-lucide-loader', label: 'en cours' },
  late: { color: 'error', icon: 'i-lucide-alarm-clock', label: 'en retard' }, todo: { color: 'warning', icon: 'i-lucide-clock', label: 'à faire' },
  none: { color: 'error', icon: 'i-lucide-x', label: 'aucun' },
}
const LINEN: Record<string, { color: C; icon: string; label: string }> = {
  ready: { color: 'success', icon: 'i-lucide-check', label: 'prêt' }, tight: { color: 'warning', icon: 'i-lucide-gauge', label: 'juste' },
  missing: { color: 'error', icon: 'i-lucide-x', label: 'manquant' }, unknown: { color: 'neutral', icon: 'i-lucide-help-circle', label: '?' },
}
const ACCESS: Record<string, { color: C; icon: string; label: string }> = {
  sent: { color: 'success', icon: 'i-lucide-key-round', label: 'envoyé' }, to_send: { color: 'warning', icon: 'i-lucide-send', label: 'à envoyer' },
  error: { color: 'error', icon: 'i-lucide-circle-alert', label: 'erreur' }, none: { color: 'neutral', icon: 'i-lucide-minus', label: 'aucun' },
}
const SCREEN: Record<string, { color: C; icon: string; label: string }> = {
  online: { color: 'success', icon: 'i-lucide-tv', label: 'en ligne' }, offline: { color: 'error', icon: 'i-lucide-tv-minimal', label: 'hors ligne' },
  none: { color: 'neutral', icon: 'i-lucide-minus', label: 'aucun' },
}

// Petits composants locaux (pastille d'etat, KPI, briques sources)
const Pill = defineComponent({
  props: { color: { type: String, default: 'neutral' }, icon: String, label: String, title: String },
  setup: p => () => h(resolveComponent('UBadge') as any, { size: 'sm', variant: 'subtle', color: p.color, icon: p.icon, label: p.label, title: p.title }),
})
const Kpi = defineComponent({
  props: { label: String, value: String, hint: String },
  setup: p => () => h('div', [h('p', { class: 'text-xs uppercase tracking-wide text-muted' }, p.label), h('p', { class: 'text-xl font-bold tabular-nums' }, p.value), p.hint ? h('p', { class: 'text-xs text-dimmed' }, p.hint) : null]),
})
const SourceTags = defineComponent({
  props: { keys: { type: Array as PropType<string[]>, default: () => [] }, bricks: { type: Object as PropType<Record<string, { name: string; ok: boolean }>>, required: true } },
  setup: p => () => h('div', { class: 'flex flex-wrap items-center gap-1 text-xs text-dimmed' }, [h('span', 'Source :'), ...p.keys.map(k => h(resolveComponent('UBadge') as any, { key: k, size: 'sm', variant: 'outline', color: p.bricks[k]?.ok ? 'neutral' : 'error', label: p.bricks[k]?.name || k }))]),
})
</script>
