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
    <FileExplorer :logement-id="Number(route.params.id)" height="calc(100vh - 20rem)" :readonly="!can('AG')" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { can, refresh } = useAuth()
await refresh()
</script>
