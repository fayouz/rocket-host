<template>
  <span v-if="hex" class="inline-block size-2 shrink-0 rounded-full" :style="{ backgroundColor: hex }" />
</template>

<script setup lang="ts">
// Petit repère de couleur devant le nom d'un logement (choisie dans Réglages > Logements) : composant partagé pour
// eviter de refaire la recherche logement/couleur dans chaque carte du tableau de bord.
const props = defineProps<{ propertyId?: number | null }>()
const { data: lg } = await useFetch('/api/logements', { key: 'logements' })
const hex = computed(() => logementColorHex(lg.value?.logements.find(l => l.lodgifyPropertyId === props.propertyId)?.color))
</script>
