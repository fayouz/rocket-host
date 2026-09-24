<template><div /></template>

<script setup lang="ts">
// Les codes clavier sont maintenant dans l'onglet Serrures : on garde l'ancienne adresse pour les liens existants
await navigateTo(`/logements/${useRoute().params.id}/serrures`, { replace: true })
</script>
