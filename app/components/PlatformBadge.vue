<template>
  <span class="inline-flex items-center gap-1.5 text-sm text-muted">
    <UIcon v-if="icon" :name="icon.name" class="size-4 shrink-0" :style="{ color: icon.color }" />
    <template v-else>{{ source }}</template>
  </span>
</template>

<script setup lang="ts">
// Logo de la plateforme (Airbnb, Booking.com) : l'icone suffit, pas besoin du nom en texte ; autres sources : texte seul
const props = defineProps<{ source: string }>()
const icon = computed(() => {
  const s = (props.source || '').toLowerCase()
  if (s.includes('airbnb')) return { name: 'i-simple-icons-airbnb', color: '#FF5A5F' }
  if (s.includes('booking')) return { name: 'i-simple-icons-bookingdotcom', color: '#0057B8' }
  return null
})
</script>
