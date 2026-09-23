<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h3 class="flex items-center gap-1.5 font-semibold"><UIcon name="i-lucide-lock" class="size-4 text-muted" /> Serrures</h3>
        <UBadge v-if="alerts" color="error" variant="subtle" :label="`${alerts} alerte${alerts > 1 ? 's' : ''}`" />
      </div>
    </template>
    <p v-if="error || !data" class="text-sm text-muted">Indisponible pour le moment (Nuki ne répond pas).</p>
    <template v-else>
      <p v-if="!data.locks.length" class="text-sm text-muted">Aucune serrure trouvée.</p>
      <ul class="space-y-3">
        <li v-for="l in data.locks" :key="l.id" class="text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <NuxtLink :to="link(l)" class="font-medium hover:underline">{{ l.property || l.name }}</NuxtLink>
            <UBadge :color="l.locked ? 'success' : faulty(l) ? 'error' : 'warning'" variant="subtle" :label="l.state" />
          </div>
          <p class="text-muted">
            Serrure « {{ l.name }} » · batterie {{ l.battery === null ? 'inconnue' : l.battery + ' %' }}
            <span v-if="l.batteryCritical || l.keypadBatteryCritical" class="text-error">
              · ⚠ {{ l.batteryCritical ? 'batterie critique' : 'pile du clavier faible' }}
            </span>
          </p>
        </li>
      </ul>
    </template>
  </UCard>
</template>

<script setup lang="ts">
// Etat de toutes les serrures Nuki (verrouillee ou non, batterie), avec lien vers la page Serrures du logement
const { data, error } = await useFetch('/api/locks')
const { data: lg } = await useFetch('/api/logements', { key: 'logements' })
// Etats anormaux (moteur bloque, non calibree) ou batterie critique : comptes comme alertes
const faulty = (l: { state: string }) => /bloqu|calibr/i.test(l.state)
const alerts = computed(() => (data.value?.locks ?? []).filter(l => l.batteryCritical || l.keypadBatteryCritical || faulty(l)).length)
const link = (l: { propertyId: number | null }) => {
  const logement = lg.value?.logements.find(x => x.lodgifyPropertyId === l.propertyId)
  return logement ? `/logements/${logement.id}/serrures` : '/settings'
}
</script>
