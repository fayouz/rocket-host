<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">Ménage & linge · tous les logements</h1>
    <p class="mb-4 text-sm text-muted">Les 3 derniers jours et les 45 prochains, pour tous tes logements (pastille de couleur = logement). Heure de Paris.</p>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <USelect v-model="lgFilter" :items="lgItems" class="w-56" />
      <USwitch v-model="onlyCleaning" label="Ménages et départs seulement" />
    </div>
    <EventTimeline v-if="data" :events="events" :now="data.now" />
    <p v-else class="text-sm text-muted">Chargement…</p>
  </div>
</template>

<script setup lang="ts">
// Vue « Tous les logements » du ménage : réutilise la timeline agrégée (/api/timeline, déjà filtrée selon les
// logements autorisés) et le composant EventTimeline de l'onglet Timeline d'un logement.
interface Ev { at: string; kind?: string; title: string; description: string; icon: string; property?: string; propertyId?: number }
const { logements } = useLogementChoice()
const { data } = await useFetch<{ now: string; properties: { id: number; name: string; events: Ev[] }[]; demo?: boolean }>('/api/timeline', { query: { past: 3, future: 45 } })
const demo = useState('demo')
watchEffect(() => { if (data.value?.demo) demo.value = true })
const lgFilter = ref('all')
const lgItems = computed(() => [{ label: 'Tous les logements', value: 'all' }, ...logements.value.map(l => ({ label: l.name, value: String(l.lodgifyPropertyId) }))])
const onlyCleaning = ref(true)
// Frise unique : evenements de tous les logements, tries par date, avec le nom et la pastille du logement
const merged = computed(() => (data.value?.properties ?? []).flatMap(p => p.events.map(e => ({ ...e, property: p.name, propertyId: p.id })))
  .sort((a, b) => a.at.localeCompare(b.at)))
const events = computed(() => merged.value.filter(e =>
  (lgFilter.value === 'all' || String(e.propertyId) === lgFilter.value)
  && (!onlyCleaning.value || e.kind === 'cleaning' || e.kind === 'stock' || e.title.startsWith('Départ'))))
</script>
