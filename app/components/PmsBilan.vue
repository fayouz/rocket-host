<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">{{ t('manage.bilan.title', { year: data?.year ?? year }) }} <span class="text-sm font-normal text-muted">· {{ t('manage.bilan.pmsName') }}</span></h2>
      <div class="flex items-center gap-2">
        <USelect v-if="data?.years.length" v-model="year" :items="data.years.map(y => ({ label: String(y), value: y }))" class="w-28" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" :label="t('manage.bilan.exportCsvShort')" :to="`/api/logements/${logementId}/pms-bilan.csv?year=${year}`" external target="_blank" />
      </div>
    </div>
    <p v-if="status === 'pending' && !data" class="text-sm text-muted">{{ t('manage.bilan.loading') }}</p>
    <p v-else-if="!data" class="text-sm text-muted">{{ t('manage.bilan.pmsDown') }}</p>
    <template v-else>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UCard><p class="text-sm text-muted">{{ t('manage.bilan.revStays') }}</p><p class="text-xl font-semibold">{{ eur(data.revenue) }}</p><p class="text-xs text-muted">{{ t('manage.bilan.grossSpread') }}</p></UCard>
        <UCard><p class="text-sm text-muted">{{ t('manage.bilan.charges') }}</p><p class="text-xl font-semibold text-warning">− {{ eur(data.chargesTotal) }}</p><p class="text-xs text-muted">{{ t('manage.bilan.pmsExpenses', { n: data.items.filter(i => i.kind !== 'income').length }) }}</p></UCard>
        <UCard><p class="text-sm text-muted">{{ t('manage.bilan.otherIncome') }}</p><p class="text-xl font-semibold">{{ eur(data.otherIncome) }}</p></UCard>
        <UCard :class="data.result < 0 ? 'border-l-4 border-l-error' : 'border-l-4 border-l-success'"><p class="text-sm text-muted">{{ t('manage.bilan.result') }}</p><p class="text-xl font-semibold">{{ eur(data.result) }}</p></UCard>
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

      <h3 class="section-title">{{ t('manage.bilan.byCat') }}</h3>
      <UCard v-if="data.categories.length">
        <ul class="space-y-2 text-sm">
          <li v-for="c in data.categories" :key="c.key" class="flex justify-between gap-2">
            <span>{{ c.label }} <span class="text-muted">· {{ t('manage.bilan.lines', { n: c.count }, c.count) }}{{ c.kind === 'income' ? t('manage.bilan.incomeTag') : '' }}</span></span><b>{{ eur(c.total) }}</b>
          </li>
        </ul>
      </UCard>
      <UCard v-else><p class="text-sm text-muted">{{ t('manage.bilan.noExpenses', { year: data.year }) }}</p></UCard>

      <h3 class="section-title">{{ t('manage.bilan.byMonth') }}</h3>
      <UCard>
        <ul class="space-y-2">
          <li v-for="(m, i) in data.months" :key="i" class="grid grid-cols-[4.5rem_1fr_6.5rem_6.5rem] items-center gap-2 text-sm">
            <span class="text-muted">{{ m.label }}</span>
            <UProgress :model-value="maxMonth ? (100 * m.revenue) / maxMonth : 0" size="xs" />
            <span class="text-right">{{ m.nights ? eur(m.revenue) : '—' }}</span>
            <span class="text-right" :class="m.result < 0 && 'text-error'">{{ m.revenue || m.charges || m.income ? eur(m.result) : '' }}</span>
          </li>
        </ul>
      </UCard>

      <h3 class="section-title">{{ t('manage.bilan.itemsTitle', { year: data.year }) }}</h3>
      <UCard v-if="data.items.length" :ui="{ body: 'p-0 sm:p-0' }">
        <table class="w-full text-sm">
          <thead class="text-left text-xs text-muted"><tr><th class="p-2">{{ t('manage.bilan.colDate') }}</th><th class="p-2">{{ t('manage.bilan.colCategory') }}</th><th class="p-2">{{ t('manage.bilan.colNote') }}</th><th class="p-2">{{ t('manage.bilan.colSource') }}</th><th class="p-2 text-right">{{ t('manage.bilan.colAmount') }}</th></tr></thead>
          <tbody>
            <tr v-for="e in data.items" :key="e.id" class="border-t border-default">
              <td class="p-2 whitespace-nowrap">{{ fr(e.date) }}</td><td class="p-2">{{ e.categoryLabel }}</td><td class="p-2 text-muted">{{ e.note }}</td><td class="p-2 text-muted">{{ e.source }}</td>
              <td class="p-2 text-right tabular-nums" :class="e.kind === 'income' ? 'text-success' : ''">{{ e.kind === 'income' ? '+' : '−' }} {{ eur(e.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>
      <p class="text-xs text-muted">{{ t('manage.bilan.pmsDisclaimer') }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ logementId: string | number }>()
const { t } = useI18n()
const { fmtLocale, money } = useLocaleFormat()
const year = ref<number>(new Date().getFullYear())
const { data, status } = useFetch(() => `/api/logements/${props.logementId}/pms-bilan`, { query: { year } })
const maxMonth = computed(() => Math.max(0, ...(data.value?.months ?? []).map(m => m.revenue)))
const eur = (n: number) => money(n, 0)
const fr = (d: string) => new Date(d).toLocaleDateString(fmtLocale.value, { day: 'numeric', month: 'short' })
</script>
