<template>
  <div v-if="data">
    <h2 class="section-title">Revenus et occupation par mois</h2>
    <UTable :data="rows" :columns="columns">
      <template #revenue-cell="{ row }">{{ eur(row.original.revenue) }}</template>
      <template #occupancy-cell="{ row }">{{ row.original.occupancy }} %</template>
      <template #bar-cell="{ row }"><UProgress :model-value="100 * row.original.revenue / max" size="sm" class="min-w-16" /></template>
    </UTable>
    <p class="mt-3 text-sm text-muted">Revenus répartis nuit par nuit. Les charges (Indy) et la marge viendront ensuite.</p>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/profit')
const rows = computed(() => (data.value?.months ?? []).slice().reverse()
  .flatMap(m => m.byProperty.map((p, i) => ({ month: i ? '' : m.month, ...p }))))
const max = computed(() => Math.max(1, ...(data.value?.months ?? []).flatMap(m => m.byProperty.map(p => p.revenue))))
const eur = (n: number) => n.toLocaleString('fr-FR') + ' €'
const columns = [
  { accessorKey: 'month', header: 'Mois' },
  { accessorKey: 'property', header: 'Logement' },
  { accessorKey: 'revenue', header: 'Revenus' },
  { accessorKey: 'nights', header: 'Nuits' },
  { accessorKey: 'occupancy', header: 'Occup.' },
  { accessorKey: 'bar', header: '' },
]
</script>
