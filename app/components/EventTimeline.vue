<template>
  <UTimeline v-if="events.length" :items="items" :model-value="lastPast" size="sm">
    <template #description="{ item }">
      <span class="inline-flex items-center gap-1.5">
        {{ item.description }}
        <UIcon v-if="item.platformIcon" :name="item.platformIcon.name" class="size-3.5 shrink-0" :style="{ color: item.platformIcon.color }" />
      </span>
    </template>
  </UTimeline>
  <UCard v-else><p class="text-sm text-muted">Rien sur cette période.</p></UCard>
</template>

<script setup lang="ts">
// Frise verticale : evenements passes remplis, a venir grises. `property` (optionnel) est ajoute devant la description.
// `description` peut contenir la source Lodgify brute (AirbnbIntegration, BookingCom...) : on l'extrait pour
// n'afficher que le logo de la plateforme (comme PlatformBadge), le texte reste pour les sources non reconnues.
interface Ev { at: string; title: string; description: string; icon: string; property?: string }
const props = defineProps<{ events: Ev[]; now: string }>()
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function platformIcon(source: string) {
  const s = source.toLowerCase()
  if (s.includes('airbnb')) return { name: 'i-simple-icons-airbnb', color: '#FF5A5F' }
  if (s.includes('booking')) return { name: 'i-simple-icons-bookingdotcom', color: '#0057B8' }
  return null
}
const items = computed(() => props.events.map((e, i) => {
  const parts = e.description.split(' · ')
  const platformIdx = parts.findIndex(p => platformIcon(p))
  const icon = platformIdx >= 0 ? platformIcon(parts[platformIdx]!) : null
  const rest = [e.property, ...parts.filter((_, idx) => idx !== platformIdx)].filter(Boolean).join(' · ')
  return {
    value: i, date: when(e.at), title: e.title, icon: e.icon,
    description: rest, platformIcon: icon,
  }
}))
const lastPast = computed(() => props.events.filter(e => e.at <= props.now).length - 1)
</script>
