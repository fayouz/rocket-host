<template>
  <div v-if="data" class="grid gap-6 lg:grid-cols-3">
    <!-- Colonne gauche (2/3) : la journee -->
    <div class="min-w-0 space-y-2 lg:col-span-2">
      <h2 class="section-title !mt-0">Turnovers du jour</h2>
      <UCard v-for="t in data.turnovers" :key="t.property" class="border-l-4 border-l-error">
        <b>{{ t.property }}</b> — ménage à faire aujourd'hui
        <p class="text-sm text-muted">Départ {{ t.out?.guest }} → arrivée {{ t.in?.guest }}</p>
      </UCard>
      <UCard v-if="!data.turnovers.length"><p class="text-sm text-muted">Aucun turnover aujourd'hui</p></UCard>

      <template v-for="s in sections" :key="s.title">
        <h2 class="section-title">{{ s.title }}</h2>
        <UCard v-for="b in s.items" :key="b.id">
          <div class="flex justify-between gap-3"><b>{{ b.property }}</b><span class="text-sm text-muted">{{ b.source }}</span></div>
          <p class="text-sm text-muted">{{ b.guest }} · {{ fr(b.arrival) }} → {{ fr(b.departure) }}</p>
        </UCard>
        <UCard v-if="!s.items.length"><p class="text-sm text-muted">Aucune</p></UCard>
      </template>
    </div>

    <!-- Colonne droite (1/3) : 3 widgets, stock, serrures et timeline de tous les logements -->
    <aside class="min-w-0 space-y-4 lg:col-span-1">
      <ContactsWidget />
      <StockWidget />
      <LocksWidget />
      <UCard v-if="tl">
        <template #header>
          <div>
            <h3 class="font-semibold">Timeline · tous les logements</h3>
            <p class="text-sm text-muted">Hier et les 7 prochains jours : séjours, codes, ménages, messages et réassort.</p>
          </div>
        </template>
        <div ref="tlBox" class="relative lg:max-h-[34rem] lg:overflow-y-auto lg:pr-2">
          <EventTimeline :events="events" :now="tl.now" />
        </div>
      </UCard>
    </aside>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/today')
const { data: tl } = await useFetch('/api/timeline', { query: { past: 1, future: 7 } })
const events = computed(() => (tl.value?.properties ?? []).flatMap(p => p.events.map(e => ({ ...e, property: p.name }))).sort((a, b) => a.at.localeCompare(b.at)))
// Colonne timeline : au chargement, fait defiler jusqu'au dernier evenement passe (le "maintenant")
const tlBox = ref<HTMLElement | null>(null)
onMounted(() => setTimeout(() => {
  const box = tlBox.value
  if (!box || box.scrollHeight <= box.clientHeight) return // petit ecran : pas de cadre defilant
  const last = events.value.filter(e => e.at <= tl.value!.now).length - 1
  // On garde un evenement passe au-dessus du "maintenant" pour le contexte
  const item = box.querySelectorAll('[data-slot="item"]')[Math.max(0, last - 1)] as HTMLElement | undefined
  if (item) box.scrollTop = Math.max(0, item.offsetTop - 8)
}, 150))
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const sections = computed(() => data.value ? [
  { title: 'Arrivées', items: data.value.arrivals },
  { title: 'Départs', items: data.value.departures },
  { title: 'Prochaines arrivées', items: data.value.upcoming },
] : [])
</script>
