<template>
  <!-- Loussa Réservations actif : bilan calculé par le PMS (revenus + dépenses du PMS) -->
  <PmsBilan v-if="pms" :logement-id="String(route.params.id)" />
  <div v-else-if="data" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">{{ t('manage.bilan.title', { year: data.year }) }}</h2>
      <div class="flex items-center gap-2">
        <USelect v-model="year" :items="data.years.map(y => ({ label: String(y), value: y }))" class="w-28" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" :label="t('manage.bilan.exportCsv')" :to="`/api/logements/${route.params.id}/documents.csv?year=${data.year}`" external target="_blank" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <UCard><p class="text-sm text-muted">{{ t('manage.bilan.revLodgify') }}</p><p class="text-xl font-semibold">{{ eur(data.revenue) }}</p><p class="text-xs text-muted">{{ t('manage.bilan.grossSpread') }}</p></UCard>
      <UCard><p class="text-sm text-muted">{{ t('manage.bilan.charges') }}</p><p class="text-xl font-semibold text-warning">− {{ eur(data.chargesTotal) }}</p><p class="text-xs text-muted">{{ t('manage.bilan.docs', { n: data.documents }, data.documents) }}</p></UCard>
      <UCard><p class="text-sm text-muted">{{ t('manage.bilan.otherIncome') }}</p><p class="text-xl font-semibold">{{ eur(data.otherIncome) }}</p><p class="text-xs text-muted">{{ t('manage.bilan.exLodgify') }}</p></UCard>
      <UCard :class="data.result < 0 ? 'border-l-4 border-l-error' : 'border-l-4 border-l-success'">
        <p class="text-sm text-muted">{{ t('manage.bilan.result') }}</p><p class="text-xl font-semibold">{{ eur(data.result) }}</p>
      </UCard>
    </div>

    <UCard>
      <p class="text-sm">
        <i18n-t keypath="manage.bilan.summary" tag="span">
          <template #nights><b>{{ data.nights }}</b></template>
          <template #stays><b>{{ data.stays }}</b></template>
          <template #occ><b>{{ data.occupancy }}</b></template>
        </i18n-t>
        <span class="text-muted"> {{ data.since ? t('manage.bilan.daysSince', { days: data.daysConsidered, date: fr(data.since) }) : t('manage.bilan.daysConsidered', { days: data.daysConsidered }) }}</span>
      </p>
    </UCard>

    <p v-if="data.chargesWithoutAmount" class="text-sm text-warning">
      {{ t('manage.bilan.noAmount', { n: data.chargesWithoutAmount }, data.chargesWithoutAmount) }}
    </p>
    <p v-if="data.withoutDate" class="text-sm text-warning">
      {{ t('manage.bilan.noDate', { n: data.withoutDate }, data.withoutDate) }}
    </p>

    <template v-if="data.platform.has || data.platform.unassigned">
      <h3 class="section-title">{{ t('manage.bilan.platformTitle') }}</h3>
      <UCard>
        <ul class="space-y-1 text-sm">
          <li class="flex justify-between"><span>{{ t('manage.bilan.payouts') }}</span><b>{{ eur(data.platform.payouts) }}</b></li>
          <li class="flex justify-between"><span>{{ t('manage.bilan.fees') }}</span><b>{{ eur(data.platform.fees) }}</b></li>
          <li class="flex justify-between"><span class="text-muted">{{ t('manage.bilan.touristTax') }}</span><span>{{ eur(data.platform.touristTax) }}</span></li>
          <li v-if="data.platform.refunds" class="flex justify-between"><span class="text-muted">{{ t('manage.bilan.refunds') }}</span><span>{{ eur(data.platform.refunds) }}</span></li>
        </ul>
        <p v-if="data.platform.unassigned" class="mt-2 text-sm text-warning">
          {{ t('manage.bilan.unassigned', { n: data.platform.unassigned }, data.platform.unassigned) }}
        </p>
      </UCard>
    </template>

    <h3 class="section-title">{{ t('manage.bilan.byCategory') }}</h3>
    <UCard v-if="data.charges.length">
      <ul class="space-y-3">
        <li v-for="c in data.charges" :key="c.key">
          <div class="flex justify-between gap-2 text-sm"><span>{{ c.label }} <span class="text-muted">· {{ t('manage.bilan.documents', { n: c.count }, c.count) }}</span></span><b>{{ eur(c.total) }}</b></div>
          <UProgress :model-value="data.chargesTotal ? (100 * c.total) / data.chargesTotal : 0" size="xs" color="warning" />
        </li>
      </ul>
    </UCard>
    <UCard v-else><p class="text-sm text-muted">{{ t('manage.bilan.noCharges', { year: data.year }) }}</p></UCard>

    <h3 class="section-title">{{ t('manage.bilan.revByMonth') }}</h3>
    <UCard>
      <ul class="space-y-2">
        <li v-for="(m, i) in data.months" :key="i" class="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-2 text-sm">
          <span class="text-muted">{{ monthName(i) }}</span>
          <UProgress :model-value="maxMonth ? (100 * m.revenue) / maxMonth : 0" size="xs" />
          <span class="text-right">{{ m.nights ? eur(m.revenue) : '—' }}</span>
        </li>
      </ul>
    </UCard>

    <p class="text-xs text-muted">
      {{ t('manage.bilan.disclaimer') }}
    </p>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { fmtLocale, money } = useLocaleFormat()
const route = useRoute()
const year = ref<number>(new Date().getFullYear())
const pms = useState<boolean>('pms', () => false)
const { data } = await useFetch(() => `/api/logements/${route.params.id}/bilan`, { query: { year }, immediate: !pms.value })
const maxMonth = computed(() => Math.max(0, ...(data.value?.months ?? []).map(m => m.revenue)))
const eur = (n: number) => money(n, 0)
const fr = (d: string) => new Date(d).toLocaleDateString(fmtLocale.value, { day: 'numeric', month: 'long' })
const monthName = (i: number) => new Date(2000, i, 1).toLocaleDateString(fmtLocale.value, { month: 'long' })
</script>
