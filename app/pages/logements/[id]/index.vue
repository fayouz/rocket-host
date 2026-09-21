<template><div /></template>

<script setup lang="ts">
const { refresh, firstLogementPage } = useAuth()
await refresh()
await navigateTo(firstLogementPage(useRoute().params.id as string), { replace: true }) // selon le rôle : réservations, documents ou stock
</script>
