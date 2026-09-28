<template>
  <!-- Rappel en tete d'une page locale remplacee par une brique Rocket quand Rocket PMS est branche -->
  <UAlert
    v-if="pms?.configured"
    color="info" variant="subtle" icon="i-lucide-rocket" class="mb-4 print:hidden"
    :title="`Géré dans ${brick === 'place' ? 'Rocket Place' : 'Rocket PMS'}`"
    :description="description || 'Rocket PMS est branché : cette page locale reste disponible mais la référence est dans la brique.'"
    :actions="url ? [{ label: 'Ouvrir', icon: 'i-lucide-external-link', to: url, target: '_blank', color: 'info', variant: 'outline' }] : []"
  />
</template>

<script setup lang="ts">
const props = defineProps<{ brick: 'pms' | 'place'; description?: string }>()
const { data: pms } = await useFetch('/api/pms/status', { key: 'pms-status' })
const cfg = useRuntimeConfig().public
const url = computed(() => (props.brick === 'place' ? cfg.placeFrontUrl : cfg.pmsFrontUrl) || '')
</script>
