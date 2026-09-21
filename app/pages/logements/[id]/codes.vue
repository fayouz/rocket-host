<template>
  <div v-if="data" class="space-y-2">
    <h2 class="section-title !mt-0">Codes clavier</h2>
    <p class="text-sm text-muted">Chaque code s'ouvre 1 h avant le check-in et se ferme 1 h après le check-out (horaires lus dans Lodgify, heure de Paris). Rien n'est envoyé à Nuki avant ton clic.</p>
    <UCard v-for="i in data.items" :key="i.bookingId" :class="{ 'border-l-4 border-l-error': i.status === 'error' || i.outdated }">
      <div class="flex justify-between gap-3"><b>{{ i.guest }}</b><PlatformBadge :source="i.source" /></div>
      <p class="text-sm text-muted">{{ fr(i.arrival) }} → {{ fr(i.departure) }}</p>
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span><span class="font-mono text-lg font-semibold tracking-widest">{{ i.code }}</span><span class="text-sm text-muted"> · {{ hour(i.validFrom) }} → {{ hour(i.validUntil) }}</span></span>
        <UBadge v-if="i.status === 'created'" color="success" variant="subtle" label="Créé sur Nuki" />
        <UButton v-else label="Créer sur Nuki" :loading="busy === i.bookingId" :disabled="data.demo" @click="send(i)" />
      </div>
      <p v-if="i.outdated" class="text-sm text-warning">⚠ Dates modifiées depuis la création : à refaire à la main dans Nuki.</p>
      <p v-if="i.error && i.status === 'error'" class="text-sm text-error">⚠ {{ i.error }}</p>
    </UCard>
    <UCard v-if="!data.items.length"><p class="text-sm text-muted">Aucune réservation à venir avec une serrure liée à ce logement (voir Réglages).</p></UCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/codes`)
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const busy = ref<number | null>(null)
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const hour = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
async function send(i: { bookingId: number, guest: string, code: string, arrival: string, departure: string }) {
  if (!confirm(`Créer le code ${i.code} sur la serrure Nuki pour ${i.guest} (${fr(i.arrival)} → ${fr(i.departure)}) ?`)) return
  busy.value = i.bookingId
  try { await $fetch(`/api/codes/${i.bookingId}`, { method: 'POST' }) }
  catch (e: any) { alert(e?.data?.statusMessage || 'Échec de la création') }
  busy.value = null
  await refresh()
}
</script>
