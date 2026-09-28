<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <b class="flex items-center gap-1.5"><UIcon name="i-lucide-rocket" class="size-4" /> Livret et écran TV gérés par Rocket PMS</b>
        <UButton v-if="data?.editorUrl" size="sm" icon="i-lucide-external-link" label="Modifier dans Rocket PMS" :to="data.editorUrl" external target="_blank" />
      </div>
    </template>
    <p v-if="status === 'pending' || status === 'idle'" class="text-sm text-muted">Chargement…</p>
    <p v-else-if="!data" class="text-sm text-muted">Rocket PMS ne répond pas pour ce logement.</p>
    <div v-else class="space-y-3 text-sm">
      <p class="text-muted">
        Chaque réservation a son propre lien voyageur (onglet Réservations : copier, QR code, « Envoyer le livret »).
        <template v-if="data.updatedAt"> Dernière modification : {{ when(data.updatedAt) }}.</template>
        <template v-if="data.languages.length"> Langues : {{ data.languages.join(', ') }}.</template>
      </p>
      <div v-if="data.tvUrl" class="flex flex-wrap items-center gap-2">
        <span class="font-medium">Écran TV :</span>
        <UInput :model-value="data.tvUrl" readonly size="sm" class="min-w-0 flex-1 font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-copy" :label="copied ? 'Copié' : 'Copier'" @click="copy" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-tv" label="Ouvrir" :to="data.tvUrl" external target="_blank" />
      </div>
      <p v-if="data.visits" class="text-muted">
        {{ data.visits.total }} visite{{ data.visits.total > 1 ? 's' : '' }} sur {{ data.visits.days }} jours
        <template v-if="data.visits.links.length"> · {{ data.visits.links.map(l => `${l.link === 'tv' ? 'TV' : (l.guest || `résa ${l.bookingId}`)} : ${l.total}`).join(' · ') }}</template>
      </p>
      <details v-if="data.sections.length">
        <summary class="cursor-pointer font-medium">Contenu actuel (lecture)</summary>
        <dl class="mt-2 space-y-2">
          <div v-for="s in data.sections" :key="s.key"><dt class="text-xs text-muted">{{ s.key }}</dt><dd class="whitespace-pre-line">{{ s.text }}</dd></div>
        </dl>
      </details>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{ logementId: string | number }>()
const { data, status } = useFetch(() => `/api/logements/${props.logementId}/pms-livret`, { server: false })
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(data.value!.tvUrl); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { /* copie manuelle */ } }
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>
