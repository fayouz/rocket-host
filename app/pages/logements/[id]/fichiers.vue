<template><div /></template>

<script setup lang="ts">
// Les fichiers sont maintenant dans l’onglet Documents : on garde l'ancienne adresse pour les liens existants
await navigateTo(`/logements/${useRoute().params.id}/documents`, { replace: true })
</script>
