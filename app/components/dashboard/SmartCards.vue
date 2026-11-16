<template>
  <div v-if="d" class="space-y-6">
    <!-- Rangee 1 : arrivees a preparer (2/3) + alertes croisees (1/3) -->
    <div v-if="d.arrivals.length || d.alerts.length" class="grid gap-6 lg:grid-cols-3">
      <UCard v-if="d.arrivals.length" :class="d.alerts.length ? 'lg:col-span-2' : 'lg:col-span-3'" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-log-in" class="size-4 text-muted" /> {{ t('daily.smart.arrivalsToPrep') }}</h3>
            <SourceTags :keys="['pms', ...(d.columns.cleaning || d.columns.linen ? ['clean'] : []), ...(d.bricks.place.configured ? ['place'] : []), ...(d.columns.screen ? ['cast'] : [])]" :bricks="d.bricks" />
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr class="border-b border-default">
                <th class="px-4 py-2">{{ t('daily.smart.property') }}</th><th class="px-2 py-2">{{ t('daily.smart.guest') }}</th><th class="px-2 py-2">{{ t('daily.smart.time') }}</th>
                <th v-if="d.columns.cleaning" class="px-2 py-2">{{ t('daily.smart.cleaning') }}</th>
                <th v-if="d.columns.linen" class="px-2 py-2">{{ t('daily.smart.linen') }}</th>
                <th v-if="d.columns.access" class="px-2 py-2">{{ t('daily.smart.access') }}</th>
                <th v-if="d.columns.screen" class="px-2 py-2">{{ t('daily.smart.screen') }}</th>
                <th v-if="d.columns.payment" class="px-2 py-2">{{ t('daily.smart.payment') }}</th>
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
                <td class="whitespace-nowrap px-2 py-2"><UBadge size="sm" :color="a.day === 'today' ? 'primary' : 'neutral'" variant="subtle" :label="a.day === 'today' ? t('daily.smart.todayShort') : t('daily.smart.tomorrow')" /> {{ a.time }}</td>
                <td v-if="d.columns.cleaning" class="px-2 py-2"><Pill v-bind="CLEAN[a.cleaning?.status ?? 'none']" :title="a.cleaning?.label" /></td>
                <td v-if="d.columns.linen" class="px-2 py-2"><Pill v-bind="LINEN[a.linen ?? 'unknown']" /></td>
                <td v-if="d.columns.access" class="px-2 py-2"><Pill v-if="a.access" v-bind="ACCESS[a.access.status]" :title="a.access.detail" /></td>
                <td v-if="d.columns.screen" class="px-2 py-2"><Pill v-if="a.screen" v-bind="SCREEN[a.screen.status]" :title="a.screen.name" /></td>
                <td v-if="d.columns.payment" class="whitespace-nowrap px-2 py-2">
                  <template v-if="a.payment"><Pill v-if="a.payment.due > 0" color="warning" icon="i-lucide-hourglass" :label="t('daily.smart.due', { amount: eur(a.payment.due) })" /><Pill v-else color="success" icon="i-lucide-check" :label="t('daily.smart.paid')" /></template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard v-if="d.alerts.length" :class="d.arrivals.length ? '' : 'lg:col-span-3'" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-siren" class="size-4 text-muted" /> {{ t('daily.smart.alerts') }}
            <UBadge size="sm" :color="d.alerts[0]!.level === 'critical' ? 'error' : 'warning'" variant="subtle" :label="String(d.alerts.length)" />
          </h3>
        </template>
        <ul class="max-h-[22rem] divide-y divide-default overflow-y-auto">
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
    </div>

    <!-- Rangee 2 : finances du mois (2/3) + etat des briques (1/3) -->
    <div class="grid gap-6 lg:grid-cols-3">
      <UCard v-if="d.finances" class="lg:col-span-2">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-euro" class="size-4 text-muted" /> {{ t('daily.smart.monthFinances') }} <span class="font-normal capitalize text-muted">({{ monthLabel }})</span></h3>
            <SourceTags :keys="['pms', ...(d.finances.cleaningCost !== null ? ['clean'] : []), ...(d.finances.stockConsumption !== null ? ['stock'] : [])]" :bricks="d.bricks" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi :label="t('daily.smart.revenue')" :value="eur(d.finances.revenue)" />
          <Kpi :label="t('daily.smart.avgOccupancy')" :value="`${d.finances.occupancy} %`" />
          <Kpi v-if="d.finances.cleaningCost !== null" :label="t('daily.smart.cleanings')" :value="eur(d.finances.cleaningCost)" :hint="d.finances.cleaningShare !== null ? t('daily.smart.ofRevenue', { n: d.finances.cleaningShare }) : ''" />
          <Kpi v-if="d.finances.stockConsumption !== null" :label="t('daily.smart.stockUse')" :value="eur(d.finances.stockConsumption)" />
          <Kpi :label="t('daily.smart.next30')" :value="eur(d.finances.forecast.revenue)" :hint="t('daily.smart.forecast', { b: d.finances.forecast.bookings, n: d.finances.forecast.nights })" />
        </div>
        <ul v-if="d.finances.channels.length" class="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <li v-for="c in d.finances.channels" :key="c.source" class="flex items-center gap-1.5">
            <PlatformBadge :source="c.source" /><span class="tabular-nums">{{ eur(c.revenue) }} <span class="text-xs text-muted">· {{ t('daily.smart.nightsShort', { n: c.nights }) }}</span></span>
          </li>
        </ul>
      </UCard>

      <UCard v-if="brickList.length" :class="d.finances ? '' : 'lg:col-start-3'">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-blocks" class="size-4 text-muted" /> {{ t('daily.smart.bricks') }}</h3>
            <UButton icon="i-lucide-refresh-cw" size="xs" color="neutral" variant="ghost" :loading="pending" :aria-label="t('daily.smart.refresh')" @click="refresh()" />
          </div>
        </template>
        <ul class="space-y-1.5 text-sm">
          <li v-for="b in brickList" :key="b.key" class="flex items-center justify-between gap-2" :title="b.error || ''">
            <span class="flex items-center gap-1.5"><span class="size-2 rounded-full" :class="b.ok ? 'bg-success' : 'bg-error'" /> {{ b.name }}</span>
            <span class="text-xs text-muted">{{ b.ok ? (b.ms !== null ? `${b.ms} ms` : 'ok') : t('daily.smart.unreachable') }}</span>
          </li>
        </ul>
        <p class="mt-3 text-xs text-dimmed">{{ t('daily.smart.updated', { when: updatedLabel }) }}</p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Cartes du tableau de bord intelligent, integrees a l'accueil (pages/index.vue) quand Loussa Réservations est branche : une seule route GET /api/dashboard/smart croise
// PMS, Place, Clean, Stock et Cast. Chaque widget indique ses briques sources ; une brique en panne vide seulement sa
// colonne et ajoute une alerte. Rafraichissement manuel + automatique toutes les 5 minutes.
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
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
  return s < 60 ? t('time.now') : t('time.min', { n: Math.round(s / 60) })
})

const brickList = computed(() => (d.value ? Object.entries(d.value.bricks).filter(([, b]) => b.configured).map(([key, b]) => ({ key, ...b })) : []))
const eur = (n: number) => new Intl.NumberFormat(fmtLocale.value, { style: 'currency', currency: d.value?.finances?.currency || 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const fmtDay = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(fmtLocale.value, { day: 'numeric', month: 'short' })
const monthLabel = computed(() => (d.value ? new Date(`${d.value.month}-15T12:00:00`).toLocaleDateString(fmtLocale.value, { month: 'long', year: 'numeric' }) : ''))

type C = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary'
const LEVEL = { critical: { icon: 'i-lucide-octagon-alert', text: 'text-error' }, warning: { icon: 'i-lucide-triangle-alert', text: 'text-warning' }, info: { icon: 'i-lucide-info', text: 'text-info' } } as const
const CLEAN = computed<Record<string, { color: C; icon: string; label: string }>>(() => ({
  done: { color: 'success', icon: 'i-lucide-check', label: t('daily.smart.cDone') }, in_progress: { color: 'info', icon: 'i-lucide-loader', label: t('daily.smart.cInProgress') },
  late: { color: 'error', icon: 'i-lucide-alarm-clock', label: t('daily.smart.cLate') }, todo: { color: 'warning', icon: 'i-lucide-clock', label: t('daily.smart.cTodo') },
  none: { color: 'error', icon: 'i-lucide-x', label: t('daily.smart.none') },
}))
const LINEN = computed<Record<string, { color: C; icon: string; label: string }>>(() => ({
  ready: { color: 'success', icon: 'i-lucide-check', label: t('daily.smart.lReady') }, tight: { color: 'warning', icon: 'i-lucide-gauge', label: t('daily.smart.lTight') },
  missing: { color: 'error', icon: 'i-lucide-x', label: t('daily.smart.lMissing') }, unknown: { color: 'neutral', icon: 'i-lucide-help-circle', label: '?' },
}))
const ACCESS = computed<Record<string, { color: C; icon: string; label: string }>>(() => ({
  sent: { color: 'success', icon: 'i-lucide-key-round', label: t('daily.smart.aSent') }, to_send: { color: 'warning', icon: 'i-lucide-send', label: t('daily.smart.aToSend') },
  error: { color: 'error', icon: 'i-lucide-circle-alert', label: t('daily.smart.aError') }, none: { color: 'neutral', icon: 'i-lucide-minus', label: t('daily.smart.none') },
}))
const SCREEN = computed<Record<string, { color: C; icon: string; label: string }>>(() => ({
  online: { color: 'success', icon: 'i-lucide-tv', label: t('daily.smart.sOnline') }, offline: { color: 'error', icon: 'i-lucide-tv-minimal', label: t('daily.smart.sOffline') },
  none: { color: 'neutral', icon: 'i-lucide-minus', label: t('daily.smart.none') },
}))

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
  setup: (p) => { const { t } = useI18n(); return () => h('div', { class: 'flex flex-wrap items-center gap-1 text-xs text-dimmed' }, [h('span', t('daily.smart.source')), ...p.keys.map(k => h(resolveComponent('UBadge') as any, { key: k, size: 'sm', variant: 'outline', color: p.bricks[k]?.ok ? 'neutral' : 'error', label: p.bricks[k]?.name || k }))]) },
})
</script>
