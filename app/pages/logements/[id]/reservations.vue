<template>
  <div v-if="data" class="space-y-2">
    <h2 class="section-title !mt-0">Réservations</h2>
    <UCard v-for="b in data.items" :key="b.id" :class="{ 'opacity-60': !b.active }">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <b>{{ b.guest }}</b>
        <div class="flex flex-wrap gap-1">
          <UBadge v-if="phase(b) === 'now'" color="success" label="En cours" />
          <UBadge v-else-if="phase(b) === 'next'" color="info" variant="subtle" label="À venir" />
          <UBadge :color="statusColor(b.status)" variant="subtle" :label="b.status" />
          <UBadge color="neutral" variant="outline" :label="b.source" />
          <UButton v-if="b.mails" size="xs" color="neutral" variant="soft" icon="i-lucide-mail" :label="String(b.mails)" :to="`/mail?booking=${b.id}`" title="E-mails rattachés à cette réservation" />
        </div>
      </div>
      <p class="text-sm text-muted">
        {{ fr(b.arrival) }}{{ b.checkIn ? ` à ${b.checkIn}` : '' }} → {{ fr(b.departure) }}{{ b.checkOut ? ` à ${b.checkOut}` : '' }}
        · {{ b.nights }} nuit{{ b.nights > 1 ? 's' : '' }}<template v-if="b.total"> · {{ eur(b.total) }}</template>
      </p>
      <p v-if="b.code" class="mt-1 text-sm">
        <UBadge :color="b.code === 'created' ? 'success' : b.code === 'error' ? 'error' : 'neutral'" variant="subtle"
                :label="b.code === 'created' ? 'Code créé sur Nuki' : b.code === 'error' ? 'Erreur de création du code' : 'Code prévu'" />
      </p>
    </UCard>
    <UCard v-if="!data.items.length"><p class="text-sm text-muted">Aucune réservation sur cette période.</p></UCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(() => `/api/logements/${route.params.id}/reservations`)
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const today = new Date().toISOString().slice(0, 10)
const phase = (b: { active: boolean; arrival: string; departure: string }) =>
  !b.active ? 'other' : b.arrival <= today && b.departure > today ? 'now' : b.arrival > today ? 'next' : 'past'
const statusColor = (s: string) => /book/i.test(s) ? 'success' : /declin|cancel/i.test(s) ? 'error' : 'info'
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const eur = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
</script>
