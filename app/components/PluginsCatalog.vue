<template>
  <div v-if="data" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-semibold">{{ t('admin.plugins.title') }}</h3>
      <UTabs v-model="category" :items="categories" :content="false" size="sm" />
    </div>
    <i18n-t keypath="admin.plugins.intro" tag="p" class="text-sm text-muted"><template #tab><b>{{ t('admin.plugins.tabConnectors') }}</b></template></i18n-t>
    <UAlert
      v-if="pms"
      :color="!pms.configured ? 'neutral' : pms.ok ? 'success' : 'error'" variant="subtle"
      :icon="!pms.configured ? 'i-lucide-server-off' : pms.ok ? 'i-lucide-server' : 'i-lucide-server-crash'"
      :title="t('admin.brick.pms')"
      :description="!pms.configured
        ? t('admin.plugins.pmsOff')
        : pms.ok ? t('admin.plugins.pmsOk') : t('admin.plugins.pmsDown', { error: pms.error || t('admin.plugins.unknownError') })"
    />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UCard v-for="p in shown" :key="p.id" :ui="{ body: 'flex h-full flex-col gap-3' }">
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><UIcon :name="p.icon" class="size-6 text-primary" /></span>
          <div class="min-w-0">
            <h3 class="font-semibold">{{ p.name }}</h3>
            <UBadge size="sm" color="neutral" variant="subtle" :label="CATEGORY_LABEL[p.category]" />
          </div>
        </div>
        <p class="flex-1 text-sm text-muted">{{ p.description }}</p>
        <div class="flex flex-wrap gap-1">
          <UBadge v-for="c in p.capabilities" :key="c" size="sm" variant="outline" :icon="CAP[c].icon" :label="CAP[c].label" />
        </div>
        <p class="text-xs text-muted">{{ t('admin.plugins.usedBy', { n: p.connectors }, p.connectors) }}</p>
      </UCard>
    </div>
    <i18n-t keypath="admin.plugins.footer" tag="p" class="text-xs text-muted"><template #prefix><code>CONNECTOR_</code></template></i18n-t>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
// Catalogue des plugins (anciennement page Reglages › Plugins), affiche dans Connexions & integrations › Connexions directes
const { data } = await useFetch('/api/plugins')
const { data: pms } = await useFetch('/api/pms/status')
const CATEGORY_LABEL = computed<Record<string, string>>(() => ({ domotique: t('nav.domotique'), documents: t('nav.documents'), general: t('admin.plugins.general') }))
const CAP = computed<Record<string, { label: string; icon: string }>>(() => ({
  info: { label: t('admin.plugins.capInfo'), icon: 'i-lucide-info' }, actions: { label: t('admin.connectors.actions'), icon: 'i-lucide-zap' }, documents: { label: t('nav.documents'), icon: 'i-lucide-folder-down' },
}))
const categories = computed(() => [{ label: t('admin.plugins.all'), value: 'all' }, { label: t('nav.domotique'), value: 'domotique' }, { label: t('nav.documents'), value: 'documents' }, { label: t('admin.plugins.general'), value: 'general' }])
const category = ref('all')
// « Documents » montre aussi les plugins generaux capables de recuperer des documents (ex. Service web)
const shown = computed(() => (data.value?.plugins ?? []).filter(p => category.value === 'all' || p.category === category.value || (category.value === 'documents' && p.capabilities.includes('documents'))))
</script>
