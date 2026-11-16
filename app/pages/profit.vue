<template>
  <div v-if="data">
    <h2 class="section-title">{{ t('manage.profit.title') }}</h2>
    <UTable :data="rows" :columns="columns">
      <template #revenue-cell="{ row }">{{ eur(row.original.revenue) }}</template>
      <template #occupancy-cell="{ row }">{{ row.original.occupancy }} %</template>
      <template #bar-cell="{ row }"><UProgress :model-value="100 * row.original.revenue / max" size="sm" class="min-w-16" /></template>
    </UTable>
    <p class="mt-3 text-sm text-muted">{{ t('manage.profit.note') }}</p>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/profit')
const rows = computed(() => (data.value?.months ?? []).slice().reverse()
  .flatMap(m => m.byProperty.map((p, i) => ({ month: i ? '' : m.month, ...p }))))
const max = computed(() => Math.max(1, ...(data.value?.months ?? []).flatMap(m => m.byProperty.map(p => p.revenue))))
const { t } = useI18n()
const { num } = useLocaleFormat()
const eur = (n: number) => num(n) + ' €'
const columns = computed(() => [
  { accessorKey: 'month', header: t('manage.profit.month') },
  { accessorKey: 'property', header: t('manage.profit.property') },
  { accessorKey: 'revenue', header: t('manage.profit.revenue') },
  { accessorKey: 'nights', header: t('manage.profit.nights') },
  { accessorKey: 'occupancy', header: t('manage.profit.occ') },
  { accessorKey: 'bar', header: '' },
])
</script>
