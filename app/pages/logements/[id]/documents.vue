<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">{{ t('nav.documents') }}</h2>
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" :label="t('daily.docs.exportCsv')" :to="`/api/logements/${route.params.id}/documents.csv`" external target="_blank" />
    </div>
    <p class="text-sm text-muted">
      {{ t('daily.docs.intro') }}
    </p>
    <!-- Loussa Réservations actif : documents du lieu dans Loussa Lieux (Loussa Cloud), en lecture -->
    <UCard v-if="pmsDocs?.enabled">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-cloud" class="size-3.5" /> {{ t('daily.docs.placeDocs') }}</p>
          <UButton v-if="pmsFolder" size="xs" color="neutral" variant="link" icon="i-lucide-arrow-left" :label="t('daily.docs.root')" @click="pmsFolder = ''" />
        </div>
      </template>
      <div v-for="d in pmsDocs.items" :key="d.id" class="flex items-center justify-between gap-2 py-1 text-sm">
        <button v-if="d.kind === 'folder'" type="button" class="flex items-center gap-1.5 hover:underline" @click="pmsFolder = d.id"><UIcon name="i-lucide-folder" class="size-4" />{{ d.name }}</button>
        <a v-else :href="`/api/logements/${route.params.id}/pms-documents/${encodeURIComponent(d.id)}`" target="_blank" class="flex items-center gap-1.5 hover:underline"><UIcon name="i-lucide-file" class="size-4" />{{ d.name }}</a>
        <span class="text-xs text-muted">{{ d.size ? t('daily.docs.sizeKb', { n: Math.max(1, Math.round(d.size / 1024)) }) : '' }}</span>
      </div>
      <p v-if="!pmsDocs.items.length" class="text-sm text-muted">{{ t('daily.docs.emptyFolder') }}</p>
    </UCard>
    <p v-else-if="pmsError" class="text-sm text-error">{{ t('daily.docs.unavailable', { error: pmsError }) }}</p>
    <FileExplorer :logement-id="Number(route.params.id)" height="calc(100vh - 20rem)" :readonly="!can('AG')" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { can, refresh } = useAuth()
await refresh()
// Documents du lieu via Loussa Réservations : { enabled: false } tant que PMS_API_URL n'est pas configure (rien n'est affiche)
const pmsFolder = ref('')
const { data: pmsDocs, error: pmsFetchError } = useFetch(() => `/api/logements/${route.params.id}/pms-documents`, { query: computed(() => (pmsFolder.value ? { folder: pmsFolder.value } : {})), server: false })
const pmsError = computed(() => (pmsFetchError.value as any)?.data?.statusMessage || (pmsFetchError.value ? t('status.error') : ''))
</script>
