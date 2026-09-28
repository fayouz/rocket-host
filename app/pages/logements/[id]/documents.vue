<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">Documents</h2>
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" label="Export CSV comptable" :to="`/api/logements/${route.params.id}/documents.csv`" external target="_blank" />
    </div>
    <p class="text-sm text-muted">
      Tous les fichiers du logement. Clic droit sur un fichier → « Type et montant… » : un type comptable (facture, taxe, assurance…)
      avec sa date et son montant le fait compter dans le Bilan. Le filtre « Type » à droite retrouve les fichiers comptables.
    </p>
    <!-- Rocket PMS actif : documents du lieu dans Rocket Place (Rocket Cloud), en lecture -->
    <UCard v-if="pmsDocs?.enabled">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-cloud" class="size-3.5" /> Documents du lieu (Rocket Place)</p>
          <UButton v-if="pmsFolder" size="xs" color="neutral" variant="link" icon="i-lucide-arrow-left" label="Dossier racine" @click="pmsFolder = ''" />
        </div>
      </template>
      <div v-for="d in pmsDocs.items" :key="d.id" class="flex items-center justify-between gap-2 py-1 text-sm">
        <button v-if="d.kind === 'folder'" type="button" class="flex items-center gap-1.5 hover:underline" @click="pmsFolder = d.id"><UIcon name="i-lucide-folder" class="size-4" />{{ d.name }}</button>
        <a v-else :href="`/api/logements/${route.params.id}/pms-documents/${encodeURIComponent(d.id)}`" target="_blank" class="flex items-center gap-1.5 hover:underline"><UIcon name="i-lucide-file" class="size-4" />{{ d.name }}</a>
        <span class="text-xs text-muted">{{ d.size ? `${Math.max(1, Math.round(d.size / 1024))} Ko` : '' }}</span>
      </div>
      <p v-if="!pmsDocs.items.length" class="text-sm text-muted">Aucun document dans ce dossier.</p>
    </UCard>
    <p v-else-if="pmsError" class="text-sm text-error">Documents Rocket Place indisponibles : {{ pmsError }}</p>
    <FileExplorer :logement-id="Number(route.params.id)" height="calc(100vh - 20rem)" :readonly="!can('AG')" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { can, refresh } = useAuth()
await refresh()
// Documents du lieu via Rocket PMS : { enabled: false } tant que PMS_API_URL n'est pas configure (rien n'est affiche)
const pmsFolder = ref('')
const { data: pmsDocs, error: pmsFetchError } = useFetch(() => `/api/logements/${route.params.id}/pms-documents`, { query: computed(() => (pmsFolder.value ? { folder: pmsFolder.value } : {})), server: false })
const pmsError = computed(() => (pmsFetchError.value as any)?.data?.statusMessage || (pmsFetchError.value ? 'erreur' : ''))
</script>
