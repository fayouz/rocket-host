<template>
  <div v-if="locksData" class="flex flex-col gap-4 lg:h-[calc(100vh-17rem)] lg:flex-row">
    <!-- Colonne gauche : liste des serrures du logement, comme une boite de reception -->
    <div class="min-w-0 space-y-1 overflow-y-auto lg:w-80 lg:shrink-0 lg:border-r lg:border-default lg:pr-3">
      <h2 class="section-title !mt-0">Serrures</h2>
      <button
        v-for="l in locksData.locks" :key="l.id" type="button" class="block w-full rounded-md p-2.5 text-left transition-colors"
        :class="selected === l.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-elevated'"
        @click="selected = l.id"
      >
        <div class="flex items-center justify-between gap-2">
          <b class="truncate text-sm">{{ l.name }}</b>
          <UBadge size="sm" :color="l.locked ? 'success' : 'warning'" variant="subtle" :label="l.state" />
        </div>
        <p class="text-xs text-muted">
          Batterie {{ l.battery === null ? 'inconnue' : `${l.battery} %` }} · {{ codesOf(l.id).length }} code{{ codesOf(l.id).length > 1 ? 's' : '' }} à venir
          <span v-if="l.batteryCritical || l.keypadBatteryCritical" class="text-error"> · ⚠</span>
        </p>
      </button>
      <p v-if="!locksData.locks.length" class="text-sm text-muted">Aucune serrure liée à ce logement (voir Réglages).</p>
    </div>

    <!-- Colonne droite : serrure selectionnee (codes clavier 2/3, historique 1/3) -->
    <div v-if="current" class="grid min-w-0 flex-1 gap-4 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)]">
      <UCard class="lg:col-span-2" :ui="{ root: 'flex flex-col lg:min-h-0', body: 'min-h-0 flex-1 space-y-3 overflow-y-auto' }">
        <template #header>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-lg font-semibold">{{ current.name }}</h3>
            <UBadge :color="current.locked ? 'success' : 'warning'" variant="subtle" :label="current.state" />
            <UBadge :color="current.batteryCritical ? 'error' : 'neutral'" variant="subtle" :icon="batteryIcon(current.battery)" :label="current.battery === null ? '?' : `${current.battery} %`" />
            <UBadge v-if="current.keypadBatteryCritical" color="error" variant="subtle" label="Pile clavier faible" />
          </div>
          <p class="mt-1 text-sm text-muted">Codes clavier : chacun s'ouvre 1 h avant le check-in et se ferme 1 h après le check-out (horaires Lodgify, heure de Paris). Rien n'est envoyé à Nuki avant ton clic.</p>
        </template>
        <div
          v-for="i in codesOf(current.id)" :key="i.bookingId" class="rounded-md border border-default p-3"
          :class="{ 'border-l-4 border-l-error': i.status === 'error' || i.outdated }"
        >
          <div class="flex justify-between gap-3"><b>{{ i.guest }}</b><PlatformBadge :source="i.source" /></div>
          <p class="text-sm text-muted">{{ fr(i.arrival) }} → {{ fr(i.departure) }}</p>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span><span class="font-mono text-lg font-semibold tracking-widest">{{ i.code }}</span><span class="text-sm text-muted"> · {{ when(i.validFrom) }} → {{ when(i.validUntil) }}</span></span>
            <UBadge v-if="i.status === 'created'" color="success" variant="subtle" label="Créé sur Nuki" />
            <UButton v-else size="sm" icon="i-lucide-key-round" label="Créer sur Nuki" :loading="busy === i.bookingId" :disabled="codesData?.demo" @click="send(i)" />
          </div>
          <p v-if="i.outdated" class="text-sm text-warning">⚠ Dates modifiées depuis la création : à refaire à la main dans Nuki.</p>
          <p v-if="i.error && i.status === 'error'" class="text-sm text-error">⚠ {{ i.error }}</p>
        </div>
        <p v-if="!codesOf(current.id).length" class="text-sm text-muted">Aucune réservation à venir sur cette serrure.</p>
      </UCard>

      <UCard class="lg:col-span-1" :ui="{ root: 'flex flex-col lg:min-h-0', body: 'min-h-0 flex-1 overflow-y-auto' }">
        <template #header><p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-history" class="size-3.5" /> Historique</p></template>
        <p v-for="(g, i) in current.logs" :key="i" class="text-sm text-muted">{{ when(g.date) }} · {{ actions[g.action] || `Action ${g.action}` }}<template v-if="g.who"> · {{ g.who }}</template></p>
        <p v-if="!current.logs.length" class="text-sm text-muted">Aucun passage récent.</p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Serrures du logement et leurs codes clavier (ex-onglet Codes), en disposition boite de reception
const route = useRoute()
const [{ data: locksData }, { data: codesData, refresh: refreshCodes }] = await Promise.all([
  useFetch(() => `/api/logements/${route.params.id}/locks`),
  useFetch(() => `/api/logements/${route.params.id}/codes`),
])
const demo = useState('demo')
watchEffect(() => { demo.value = !!locksData.value?.demo })
const selected = ref<number | null>(null)
watchEffect(() => {
  const locks = locksData.value?.locks ?? []
  if (!locks.some(l => l.id === selected.value)) selected.value = locks[0]?.id ?? null
})
const current = computed(() => locksData.value?.locks.find(l => l.id === selected.value) ?? null)
const codesOf = (lockId: number) => (codesData.value?.items ?? []).filter(i => i.lockId === lockId)
const actions: Record<number, string> = { 1: 'Déverrouillage', 2: 'Verrouillage', 3: 'Ouverture (pêne)', 4: 'Lock’n’Go', 5: 'Lock’n’Go + ouverture' }
const batteryIcon = (b: number | null) => b === null ? 'i-lucide-battery' : b <= 20 ? 'i-lucide-battery-low' : b <= 60 ? 'i-lucide-battery-medium' : 'i-lucide-battery-full'
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const busy = ref<number | null>(null)
// Creation du code sur la serrure : action sur la porte, toujours confirmee
async function send(i: { bookingId: number, guest: string, code: string, arrival: string, departure: string }) {
  if (!confirm(`Créer le code ${i.code} sur la serrure Nuki pour ${i.guest} (${fr(i.arrival)} → ${fr(i.departure)}) ?`)) return
  busy.value = i.bookingId
  try { await $fetch(`/api/codes/${i.bookingId}`, { method: 'POST' }) }
  catch (e: any) { alert(e?.data?.statusMessage || 'Échec de la création') }
  busy.value = null
  await refreshCodes()
}
</script>
