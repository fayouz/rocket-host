<template>
  <div v-if="data" class="space-y-2">
    <h2 class="section-title">{{ t('nav.logements') }}</h2>
    <UCard v-for="l in data.logements" :key="l.id">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b>{{ l.name }}</b>
          <p class="text-sm text-muted">{{ l.lodgifyName ? t('daily.lg.lodgify', { name: l.lodgifyName }) : t('daily.lg.notLinked') }}</p>
        </div>
        <UButton :to="firstLogementPage(l.id)" :label="t('daily.res.open')" trailing-icon="i-lucide-arrow-right" />
      </div>
    </UCard>
    <UCard v-if="!data.logements.length"><p class="text-sm text-muted">{{ t('daily.lg.none') }}</p></UCard>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { data } = await useFetch('/api/logements', { key: 'logements' })
const { refresh, firstLogementPage } = useAuth()
await refresh()
</script>
