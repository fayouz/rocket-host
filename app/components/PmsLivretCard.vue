<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <b class="flex items-center gap-1.5"><UIcon name="i-lucide-rocket" class="size-4" /> {{ t('manage.livretCard.title') }}</b>
        <UButton v-if="data?.editorUrl" size="sm" icon="i-lucide-external-link" :label="t('manage.livretCard.edit')" :to="data.editorUrl" external target="_blank" />
      </div>
    </template>
    <p v-if="status === 'pending' || status === 'idle'" class="text-sm text-muted">{{ t('manage.livretCard.loading') }}</p>
    <p v-else-if="!data" class="text-sm text-muted">{{ t('manage.livretCard.down') }}</p>
    <div v-else class="space-y-3 text-sm">
      <p class="text-muted">
        {{ t('manage.livretCard.intro') }}
        <template v-if="data.updatedAt">{{ t('manage.livretCard.updated', { date: when(data.updatedAt) }) }}</template>
        <template v-if="data.languages.length">{{ t('manage.livretCard.langs', { list: data.languages.join(', ') }) }}</template>
      </p>
      <div v-if="data.tvUrl" class="flex flex-wrap items-center gap-2">
        <span class="font-medium">{{ t('manage.livretCard.tv') }}</span>
        <UInput :model-value="data.tvUrl" readonly size="sm" class="min-w-0 flex-1 font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-copy" :label="copied ? t('manage.livretCard.copied') : t('manage.livretCard.copy')" @click="copy" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-tv" :label="t('manage.livretCard.open')" :to="data.tvUrl" external target="_blank" />
      </div>
      <p v-if="data.visits" class="text-muted">
        {{ t('manage.livretCard.visits', { n: data.visits.total, days: data.visits.days }, data.visits.total) }}
        <template v-if="data.visits.links.length"> · {{ data.visits.links.map(l => `${l.link === 'tv' ? t('manage.livretCard.tvShort') : (l.guest || t('manage.livretCard.booking', { id: l.bookingId }))} : ${l.total}`).join(' · ') }}</template>
      </p>
      <details v-if="data.sections.length">
        <summary class="cursor-pointer font-medium">{{ t('manage.livretCard.content') }}</summary>
        <dl class="mt-2 space-y-2">
          <div v-for="s in data.sections" :key="s.key"><dt class="text-xs text-muted">{{ s.key }}</dt><dd class="whitespace-pre-line">{{ s.text }}</dd></div>
        </dl>
      </details>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{ logementId: string | number }>()
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
const { data, status } = useFetch(() => `/api/logements/${props.logementId}/pms-livret`, { server: false })
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(data.value!.tvUrl); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { /* copie manuelle */ } }
const when = (d: string) => new Date(d).toLocaleString(fmtLocale.value, { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>
