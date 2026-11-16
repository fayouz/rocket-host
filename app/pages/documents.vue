<template>
  <div class="space-y-3">
    <h1 class="text-xl font-semibold">{{ t('nav.documents') }}</h1>
    <p class="text-sm text-muted">{{ t('daily.docs.pageIntro') }}</p>
    <FileExplorer height="calc(100vh - 14rem)" :readonly="!can('AG')" />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { can, refresh } = useAuth()
await refresh()
</script>
