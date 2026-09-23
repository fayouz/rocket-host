<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-refresh-cw" class="size-4 text-muted" /> Turnover</h3>
        <UBadge v-if="data?.turnovers.length" color="error" variant="subtle" :label="`${data.turnovers.length} aujourd'hui`" />
      </div>
    </template>
    <p v-if="error || !data" class="text-sm text-muted">Indisponible pour le moment.</p>
    <template v-else>
      <p v-if="!data.turnovers.length" class="text-sm text-muted">Aucun turnover aujourd'hui.</p>
      <ul class="space-y-3">
        <li v-for="t in data.turnovers" :key="t.property" class="text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-medium">{{ t.property }}</span>
            <UBadge :color="cleaningStatusColor(t.cleaning?.status)" variant="subtle" :label="t.cleaning?.status ?? 'Non assignée'" />
          </div>
          <p class="text-muted">Départ {{ t.out?.guest }} → arrivée {{ t.in?.guest }}</p>
        </li>
      </ul>
    </template>
  </UCard>
</template>

<script setup lang="ts">
// Turnovers du jour, en resume compact : cohabite avec StockWidget/LocksWidget dans une grille a 3 colonnes
// (bloc "vue d'ensemble" de la page Aujourd'hui), au lieu d'une liste detaillee en pleine largeur.
// `properties` : filtre optionnel du selecteur de logements du tableau de bord (ids Lodgify, vide = tous)
const props = defineProps<{ properties?: number[] }>()
const query = computed(() => ({ properties: props.properties?.length ? props.properties.join(',') : undefined }))
const { data, error } = await useFetch('/api/today', { query })
</script>
