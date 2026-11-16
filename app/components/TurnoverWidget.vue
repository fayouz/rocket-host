<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-refresh-cw" class="size-4 text-muted" /> {{ t('daily.turnover.title') }}</h3>
        <UBadge v-if="data?.turnovers.length" color="error" variant="subtle" :label="t('daily.turnover.today', { n: data.turnovers.length })" />
      </div>
    </template>
    <p v-if="error || !data" class="text-sm text-muted">{{ t('daily.common.unavailable') }}</p>
    <template v-else>
      <p v-if="!data.turnovers.length" class="text-sm text-muted">{{ t('daily.turnover.none') }}</p>
      <ul class="space-y-3">
        <li v-for="tv in data.turnovers" :key="tv.property" class="text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="flex items-center gap-1.5 font-medium"><LogementDot :property-id="tv.out?.propertyId ?? tv.in?.propertyId" /> {{ tv.property }}</span>
            <UBadge :color="cleaningStatusColor(tv.cleaning?.status)" variant="subtle" :label="tv.cleaning?.status ?? t('daily.turnover.unassigned')" />
          </div>
          <p class="text-muted">{{ t('daily.turnover.line', { out: tv.out?.guest, in: tv.in?.guest }) }}</p>
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
const { t } = useI18n()
const query = computed(() => ({ properties: props.properties?.length ? props.properties.join(',') : undefined }))
const { data, error } = await useFetch('/api/today', { query })
</script>
