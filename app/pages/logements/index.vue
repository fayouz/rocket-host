<template>
  <div v-if="data" class="space-y-2">
    <h2 class="section-title">Logements</h2>
    <UCard v-for="l in data.logements" :key="l.id">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b>{{ l.name }}</b>
          <p class="text-sm text-muted">{{ l.lodgifyName ? `Lodgify : ${l.lodgifyName}` : 'Non associé à Lodgify' }}</p>
        </div>
        <UButton :to="firstLogementPage(l.id)" label="Ouvrir" trailing-icon="i-lucide-arrow-right" />
      </div>
    </UCard>
    <UCard v-if="!data.logements.length"><p class="text-sm text-muted">Aucun logement.</p></UCard>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/logements', { key: 'logements' })
const { refresh, firstLogementPage } = useAuth()
await refresh()
</script>
