<template><div /></template>

<script setup lang="ts">
await navigateTo(`/logements/${useRoute().params.id}/reservations`, { replace: true })
</script>
