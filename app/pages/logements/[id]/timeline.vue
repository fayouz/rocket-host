<template>
  <div v-if="data">
    <!-- Rocket PMS actif : ménages créés dans Rocket Place après chaque départ (lecture seule) -->
    <template v-if="pms">
      <h2 class="section-title !mt-0">Ménages (Rocket Place)</h2>
      <p class="mb-2 text-sm text-muted">Tâches de ménage planifiées par Rocket PMS après chaque départ, 14 derniers jours et 60 prochains. Lecture seule : l'attribution et le suivi se font dans Rocket Place.</p>
      <UCard class="mb-6">
        <p v-if="menStatus === 'pending' || menStatus === 'idle'" class="text-sm text-muted">Chargement…</p>
        <p v-else-if="!menages" class="text-sm text-muted">Rocket PMS ne répond pas pour le moment.</p>
        <p v-else-if="!menages.items.length" class="text-sm text-muted">Aucun ménage sur la période.</p>
        <ul v-else class="divide-y divide-default text-sm">
          <li v-for="(m, i) in menages.items" :key="i" class="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><UIcon name="i-lucide-spray-can" class="mr-1 size-4 align-middle text-muted" /><b>{{ when(m.at) }}</b> · {{ m.title }}</span>
            <UBadge size="sm" variant="subtle" :color="/terminé/.test(m.description) ? 'success' : /en cours/.test(m.description) ? 'info' : 'neutral'" :label="m.description" />
          </li>
        </ul>
      </UCard>
    </template>
    <h2 class="section-title" :class="!pms && '!mt-0'">Timeline</h2>
    <p class="mb-2 text-sm text-muted">Les 3 derniers jours et les 45 prochains : séjours, codes clavier, ménages, messages envoyés et prévus, réassort. Heure de Paris.</p>
    <EventTimeline :events="data.events" :now="data.now" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const pms = useState<boolean>('pms', () => false)
const { data } = await useFetch(() => `/api/logements/${route.params.id}/timeline`)
const { data: menages, status: menStatus } = useFetch(() => `/api/logements/${route.params.id}/pms-menages`, { server: false, immediate: pms.value })
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>
