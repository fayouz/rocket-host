<template>
  <div v-if="data" class="space-y-3">
    <h2 class="section-title !mt-0">{{ t('admin.imports.toSort') }}</h2>
    <p class="text-sm text-muted">{{ t('admin.imports.toSortIntro') }}</p>
    <UCard v-for="d in data.inbox" :key="d.id">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate font-medium">{{ d.title }}</p>
          <p class="text-sm text-muted">{{ fr(d.date) }} · {{ d.fileName }} · {{ size(d.size) }}</p>
          <p v-if="d.note" class="text-sm text-muted">{{ d.note }}</p>
        </div>
        <UBadge color="neutral" variant="outline" :label="d.source" />
      </div>
      <div class="mt-2 flex flex-wrap gap-1">
        <UButton v-if="d.inline" size="xs" color="neutral" variant="outline" icon="i-lucide-eye" :label="t('admin.imports.view')" :to="`/api/documents/${d.id}/file`" external target="_blank" />
        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-download" :label="t('admin.imports.download')" :to="`/api/documents/${d.id}/file?download=1`" external />
      </div>
      <form class="mt-3 grid gap-2 sm:grid-cols-2" @submit.prevent="classify(d.id)">
        <USelect v-model="forms[d.id]!.logementId" :items="logementItems" :placeholder="t('admin.imports.logement')" />
        <USelect v-model="forms[d.id]!.category" :items="categoryItems" />
        <UInput v-model="forms[d.id]!.date" type="date" />
        <UInput v-model="forms[d.id]!.amount" inputmode="decimal" :placeholder="t('admin.imports.amountPlaceholder')" />
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" :label="t('admin.imports.file')" :disabled="!forms[d.id]!.logementId" />
          <UButton color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('admin.common.delete')" @click="removeDoc(d)" />
        </div>
      </form>
    </UCard>
    <UCard v-if="!data.inbox.length"><p class="text-sm text-muted">{{ t('admin.imports.nothing') }}</p></UCard>

    <template v-if="data.unassignedTransactions.length">
      <h2 class="section-title">{{ t('admin.imports.unassigned') }}</h2>
      <p class="text-sm text-muted">{{ t('admin.imports.unassignedIntro') }}</p>
      <UCard v-for="u in data.unassignedTransactions" :key="u.source">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span><b>{{ u.source }}</b> · {{ t('admin.imports.lines', { n: u.count }, u.count) }} · {{ eur(u.total) }}</span>
          <span class="flex gap-2">
            <USelect v-model="assign[u.source]" :items="logementItems" :placeholder="t('admin.imports.logement')" class="w-48" />
            <UButton :label="t('admin.imports.assign')" :disabled="!assign[u.source]" @click="assignTx(u.source)" />
          </span>
        </div>
      </UCard>
    </template>

    <h2 class="section-title">{{ t('admin.imports.sources') }}</h2>
    <UCard v-for="s in data.sources" :key="s.source">
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span><b>{{ s.source }}</b> · {{ t('admin.imports.documentsCount', { n: s.documents }, s.documents) }} · {{ t('admin.imports.statementLines', { n: s.transactions }, s.transactions) }}
          <span v-if="s.last" class="text-muted">· {{ t('admin.imports.lastImport', { date: when(s.last) }) }}</span></span>
        <UButton v-if="s.transactions" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('admin.imports.deleteStatements')" @click="removeTx(s.source)" />
      </div>
    </UCard>
    <UCard v-if="!data.sources.length"><p class="text-sm text-muted">{{ t('admin.imports.noImport') }}</p></UCard>

    <h2 class="section-title">{{ t('admin.imports.howTo') }}</h2>
    <UCard>
      <i18n-t v-if="!data.webhookConfigured" keypath="admin.imports.tokenMissing" tag="p" class="mb-2 text-sm text-error">
        <template #token><code>WEBHOOK_TOKEN</code></template>
        <template #link><NuxtLink to="/settings/connexions" class="underline">{{ t('admin.imports.settingsConnections') }}</NuxtLink></template>
      </i18n-t>
      <i18n-t keypath="admin.imports.howToText" tag="p" class="text-sm text-muted">
        <template #docs><code>POST /api/import/documents</code></template>
        <template #tx><code>POST /api/import/transactions</code></template>
        <template #header><code>Authorization: Bearer &lt;WEBHOOK_TOKEN&gt;</code></template>
        <template #source><b>{{ t('admin.imports.sourceWord') }}</b></template>
        <template #externalId><b>externalId</b></template>
        <template #file><code>docs/imports-n8n.md</code></template>
      </i18n-t>
    </UCard>

    <div class="flex items-center justify-between">
      <h2 class="section-title">{{ t('admin.imports.importLog') }}</h2>
      <UButton v-if="data.log.length" size="xs" color="neutral" variant="ghost" :label="t('admin.imports.clearLog')" @click="clearLog" />
    </div>
    <UCard>
      <ul v-if="data.log.length" class="space-y-1 text-sm">
        <li v-for="l in data.log" :key="l.id" class="flex flex-wrap items-baseline gap-2">
          <UBadge size="sm" :color="l.status === 'ok' ? 'success' : l.status === 'error' ? 'error' : 'neutral'" variant="subtle" :label="l.status === 'ok' ? t('admin.imports.statusOk') : l.status === 'error' ? t('admin.imports.statusError') : t('admin.imports.statusKnown')" />
          <span class="text-muted">{{ when(l.at) }}</span><b>{{ l.source }}</b><span class="text-muted">{{ l.type }}</span><span class="min-w-0 break-words">{{ l.detail }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">{{ t('admin.imports.logEmpty') }}</p>
    </UCard>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
const { data, refresh } = await useFetch('/api/imports')
const error = ref('')
const forms = reactive<Record<number, { logementId?: number; category: string; date: string; amount: string }>>({})
const assign = reactive<Record<string, number | undefined>>({})
// Un petit formulaire par document a classer, prerempli avec ce que l'import a fourni
watchEffect(() => {
  for (const d of data.value?.inbox ?? []) forms[d.id] ??= { logementId: undefined, category: d.category, date: d.date, amount: d.amount === null ? '' : String(d.amount) }
})
const logementItems = computed(() => (data.value?.logements ?? []).map(l => ({ label: l.name, value: l.id })))
const categoryItems = computed(() => {
  const groups: Record<string, string> = { charge: t('admin.imports.groupCharge'), recette: t('admin.imports.groupRecette'), doc: t('admin.imports.groupDoc') }
  return Object.entries(groups).map(([kind, label]) => [
    { type: 'label' as const, label },
    ...(data.value?.categories ?? []).filter(c => c.kind === kind).map(c => ({ label: c.label, value: c.key })),
  ])
})
async function run(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() } catch (e: any) { error.value = e?.data?.statusMessage || t('account.retry') }
  await refresh()
}
const classify = (id: number) => run(() => $fetch(`/api/documents/${id}`, { method: 'PUT', body: { ...forms[id], amount: forms[id]!.amount } }))
const removeDoc = (d: { id: number; title: string }) => { if (confirm(t('admin.imports.confirmDeleteDoc', { title: d.title }))) return run(() => $fetch(`/api/documents/${d.id}`, { method: 'DELETE' })) }
const assignTx = (source: string) => run(() => $fetch('/api/imports/assign-transactions', { method: 'POST', body: { source, logementId: assign[source] } }))
const removeTx = (source: string) => { if (confirm(t('admin.imports.confirmDeleteTx', { source }))) return run(() => $fetch('/api/imports/transactions', { method: 'DELETE', query: { source } })) }
const clearLog = () => run(() => $fetch('/api/imports/log', { method: 'DELETE' }))

const fr = (d: string) => new Date(d).toLocaleDateString(fmtLocale.value, { day: 'numeric', month: 'short', year: 'numeric' })
const when = (d: string) => new Date(d).toLocaleString(fmtLocale.value, { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const { money: eur } = useLocaleFormat()
const size = (n: number) => (n >= 1048576 ? t('admin.imports.sizeMb', { n: (n / 1048576).toFixed(1) }) : t('admin.imports.sizeKb', { n: Math.max(1, Math.round(n / 1024)) }))
</script>
