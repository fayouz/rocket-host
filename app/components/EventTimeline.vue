<template>
  <UTimeline v-if="events.length" :items="items" :model-value="lastPast" size="sm" />
  <UCard v-else><p class="text-sm text-muted">Rien sur cette période.</p></UCard>
</template>

<script setup lang="ts">
// Frise verticale : evenements passes remplis, a venir grises. `property` (optionnel) est ajoute devant la description.
interface Ev { at: string; title: string; description: string; icon: string; property?: string }
const props = defineProps<{ events: Ev[]; now: string }>()
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const items = computed(() => props.events.map((e, i) => ({
  value: i, date: when(e.at), title: e.title, icon: e.icon,
  description: [e.property, e.description].filter(Boolean).join(' · '),
})))
const lastPast = computed(() => props.events.filter(e => e.at <= props.now).length - 1)
</script>
