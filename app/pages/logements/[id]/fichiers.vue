<template>
  <div class="space-y-3">
    <h2 class="section-title !mt-0">Fichiers</h2>
    <p class="text-sm text-muted">Le dossier de ce logement (le même que dans le menu Documents) : contrats, photos, notices, tout ce que tu veux classer.</p>
    <FileExplorer :logement-id="Number(route.params.id)" height="calc(100vh - 20rem)" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
