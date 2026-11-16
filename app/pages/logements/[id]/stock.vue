<template>
  <!-- Loussa Réservations actif : niveaux du lieu dans Loussa Lieux (le catalogue se gere dans Loussa Lieux) -->
  <div v-if="data?.pms" class="space-y-2">
    <h2 class="section-title !mt-0">{{ t('daily.stock.title') }}</h2>
    <p class="text-sm text-muted">
      {{ pmsToBuy ? t('daily.stock.toBuy', { n: pmsToBuy }, pmsToBuy) : t('daily.stock.nothingToBuy') }}
      {{ t('daily.stock.pmsNote') }}
    </p>
    <UCard v-for="it in data.lines" :key="it.levelId" :class="{ 'border-l-4 border-l-warning': it.level === 'low', 'border-l-4 border-l-error': it.level === 'empty' }">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="font-medium">{{ it.name }}<UBadge v-if="it.subscription" class="ml-2" color="info" variant="subtle" :label="t('daily.stock.amazonSub')" /></span>
        <div class="flex items-center gap-1">
          <UButton v-for="l in levels" :key="l.value" size="sm" :label="l.label" :color="l.color" :variant="it.level === l.value ? 'solid' : 'outline'" @click="setPms(it, l.value)" />
        </div>
      </div>
    </UCard>
    <UCard v-if="!data.lines.length"><p class="text-sm text-muted">{{ t('daily.stock.noneTrackedPms') }}</p></UCard>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
  <div v-else-if="data" class="space-y-2">
    <h2 class="section-title !mt-0">{{ t('daily.stock.title') }}</h2>
    <p class="text-sm text-muted">
      {{ toBuy ? t('daily.stock.toBuy', { n: toBuy }, toBuy) : t('daily.stock.nothingToBuy') }}
      {{ t('daily.stock.tracks', { n: data.items.length }, data.items.length) }} {{ t('daily.stock.cleanerNote') }}
      {{ t('daily.stock.catalogNote') }}
    </p>
    <UCard v-for="it in data.items" :key="it.id" :class="{ 'border-l-4 border-l-warning': it.level === 'low', 'border-l-4 border-l-error': it.level === 'empty' }">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="font-medium">{{ it.name }}<UBadge v-if="it.subscription" class="ml-2" color="info" variant="subtle" :label="t('daily.stock.amazonSub')" /></span>
        <div class="flex items-center gap-1">
          <UButton v-for="l in levels" :key="l.value" size="sm" :label="l.label" :color="l.color" :variant="it.level === l.value ? 'solid' : 'outline'" @click="set(it, l.value)" />
          <UButton size="sm" icon="i-lucide-x" color="neutral" variant="ghost" :title="t('daily.stock.untrackTitle')" @click="untrack(it)" />
        </div>
      </div>
    </UCard>
    <UCard v-if="!data.items.length"><p class="text-sm text-muted">{{ t('daily.stock.noneTracked') }}</p></UCard>

    <h2 class="section-title">{{ t('daily.stock.addTitle') }}</h2>
    <div v-if="data.available.length" class="flex gap-2">
      <USelect v-model="pick" :items="data.available.map(a => ({ label: a.name, value: a.id }))" :placeholder="t('daily.stock.catalogItem')" class="flex-1" />
      <UButton :label="t('daily.stock.add')" :disabled="!pick" @click="addExisting" />
    </div>
    <div class="flex gap-2">
      <UInput v-model="newName" :placeholder="t('daily.stock.newItem')" class="flex-1" @keyup.enter="addNew" />
      <UButton :label="t('daily.stock.create')" :disabled="!newName.trim()" @click="addNew" />
    </div>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/stock`)
const levels = computed(() => [
  { value: 'ok', label: t('daily.stock.ok'), color: 'success' },
  { value: 'low', label: t('daily.stock.low'), color: 'warning' },
  { value: 'empty', label: t('daily.stock.empty'), color: 'error' },
] as const)
const error = ref('')
const pick = ref<number | undefined>()
const newName = ref('')
const toBuy = computed(() => data.value && !data.value.pms ? data.value.items.filter(i => i.level !== 'ok').length : 0)
const pmsToBuy = computed(() => data.value?.pms ? data.value.lines.filter(i => i.level !== 'ok').length : 0)
async function setPms(it: { levelId: string; level: string }, level: string) {
  const previous = it.level
  it.level = level
  try { await $fetch(`/api/logements/${route.params.id}/pms-stock/${it.levelId}`, { method: 'PUT', body: { level } }); error.value = '' }
  catch (e: any) { it.level = previous; error.value = e?.data?.statusMessage || t('daily.stock.saveFailed') }
}
const pid = () => (data.value && !data.value.pms ? data.value.propertyId : 0)
async function run(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() } catch (e: any) { error.value = e?.data?.statusMessage || t('daily.stock.saveFailed') }
  await refresh()
}
async function set(it: { id: number; level: string }, level: string) {
  const previous = it.level
  it.level = level // affichage immediat, annule si l'envoi echoue
  try { await $fetch('/api/stock/level', { method: 'PUT', body: { propertyId: pid(), itemId: it.id, level } }); error.value = '' }
  catch { it.level = previous; error.value = t('daily.stock.saveFailed') }
}
const untrack = (it: { id: number; name: string }) => {
  if (confirm(t('daily.stock.confirmUntrack', { name: it.name })))
    return run(() => $fetch('/api/stock/track', { method: 'PUT', body: { propertyId: pid(), itemId: it.id, tracked: false } }))
}
const addExisting = () => { const itemId = pick.value; pick.value = undefined; if (itemId) return run(() => $fetch('/api/stock/track', { method: 'PUT', body: { propertyId: pid(), itemId, tracked: true } })) }
const addNew = () => { const name = newName.value.trim(); if (!name) return; newName.value = ''; return run(() => $fetch('/api/stock/items', { method: 'POST', body: { name, propertyIds: [pid()] } })) }
</script>
