<template>
  <SmartDashboard v-if="pmsOn" />
  <ClassicHome v-else />
</template>

<script setup lang="ts">
// Accueil : tableau de bord intelligent quand Rocket PMS est branche (PMS_API_URL), sinon l'accueil historique
// (Lodgify en direct). Meme cle que le menu (layouts/default.vue) : un seul appel a /api/pms/status.
const { data: pms } = await useFetch('/api/pms/status', { key: 'pms-status' })
const pmsOn = computed(() => !!pms.value?.configured)
</script>
