<template><div /></template>

<script setup lang="ts">
// Les fichiers sont maintenant un sous-onglet de Documents : on garde l'ancienne adresse pour les liens existants
await navigateTo(`/logements/${useRoute().params.id}/documents?vue=fichiers`, { replace: true })
</script>
