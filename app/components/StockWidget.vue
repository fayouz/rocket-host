<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-package" class="size-4 text-muted" /> Stock</h3>
        <UButton size="xs" color="neutral" variant="link" to="/settings/stock" label="Catalogue" trailing-icon="i-lucide-arrow-right" />
      </div>
    </template>
    <p v-if="error || !data" class="text-sm text-muted">Indisponible pour le moment.</p>
    <template v-else>
      <p class="mb-3 text-sm">
        <b>{{ data.shopping.length }}</b> article{{ data.shopping.length > 1 ? 's' : '' }} à racheter
        <span v-if="!data.shopping.length" class="text-muted">— tout va bien</span>
      </p>
      <ul class="space-y-2">
        <li v-for="r in rows" :key="r.id" class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <NuxtLink :to="r.to" class="font-medium hover:underline">{{ r.name }}</NuxtLink>
          <span class="flex flex-wrap gap-1">
            <UBadge v-if="r.empty" color="error" variant="subtle" :label="`${r.empty} vide${r.empty > 1 ? 's' : ''}`" />
            <UBadge v-if="r.low" color="warning" variant="subtle" :label="`${r.low} bas`" />
            <UBadge v-if="!r.empty && !r.low" color="success" variant="subtle" :label="r.total ? 'OK' : 'aucun article'" />
          </span>
        </li>
      </ul>
      <UButton v-if="data.amazonUrl" class="mt-3" size="sm" block color="neutral" variant="outline" icon="i-lucide-shopping-cart" label="Ouvrir le panier Amazon" :to="data.amazonUrl" target="_blank" />
    </template>
  </UCard>
</template>

<script setup lang="ts">
// Etat du stock de tous les logements : articles a racheter, et par logement le nombre d'articles vides / bas
const { data, error } = await useFetch('/api/stock')
const { data: lg } = await useFetch('/api/logements', { key: 'logements' })
const rows = computed(() => (data.value?.properties ?? []).map((p) => {
  const levels = Object.values(p.levels)
  const logement = lg.value?.logements.find(l => l.lodgifyPropertyId === p.id)
  return {
    id: p.id, name: p.name, total: levels.length, empty: levels.filter(l => l === 'empty').length, low: levels.filter(l => l === 'low').length,
    to: logement ? `/logements/${logement.id}/stock` : '/settings/stock',
  }
}))
</script>
