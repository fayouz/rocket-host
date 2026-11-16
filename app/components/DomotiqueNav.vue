<template>
  <!-- Sous-navigation de l'onglet Domotique : serrures et autres appareils du logement -->
  <div class="mb-3 flex gap-1">
    <UButton v-for="l in links" :key="l.to" :to="l.to" size="sm" :icon="l.icon" :label="l.label"
             :color="route.path === l.to ? 'primary' : 'neutral'" :variant="route.path === l.to ? 'soft' : 'ghost'" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const base = computed(() => `/logements/${route.params.id}`)
const links = computed(() => [
  { label: t('daily.locksW.title'), icon: 'i-lucide-lock', to: `${base.value}/serrures` },
  { label: t('daily.domo.devices'), icon: 'i-lucide-thermometer', to: `${base.value}/domotique` },
])
</script>
