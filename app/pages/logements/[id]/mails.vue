<template>
  <div class="space-y-3">
    <h2 class="section-title !mt-0">{{ t('nav.mail') }}</h2>
    <p class="text-sm text-muted">{{ t('daily.mails.intro') }}</p>
    <UInput v-model="q" icon="i-lucide-search" :placeholder="t('daily.mails.search')" class="w-full" />
    <UCard v-for="m in items" :key="m.id" class="cursor-pointer" @click="navigateTo({ path: '/mail', query: { logement: route.params.id, open: m.id } })">
      <div class="flex items-baseline justify-between gap-2">
        <p class="truncate text-sm font-medium">{{ m.fromName || m.fromAddr }}</p>
        <span class="shrink-0 text-xs text-muted">{{ shortDate(m.date) }}</span>
      </div>
      <p class="truncate text-sm">{{ m.subject || t('daily.pms.noSubject') }}</p>
      <p class="line-clamp-1 text-xs text-muted">{{ m.snippet }}</p>
      <div v-if="m.links.length || m.attachments.length" class="mt-1 flex flex-wrap gap-1">
        <UBadge v-if="m.attachments.length" color="neutral" variant="outline" size="sm" icon="i-lucide-paperclip" :label="String(m.attachments.length)" />
        <UBadge v-for="l in m.links" :key="l.kind + l.targetId" :color="l.kind === 'booking' ? 'info' : 'primary'" variant="subtle" size="sm"
                :icon="l.kind === 'booking' ? 'i-lucide-calendar-days' : 'i-lucide-contact'" :label="l.label.split(' · ')[0]" />
      </div>
    </UCard>
    <UCard v-if="data && !items.length"><p class="text-sm text-muted">{{ t('daily.mails.none') }}</p></UCard>
    <UButton v-if="data && items.length < data.total" block color="neutral" variant="outline" :loading="loading" :label="t('daily.mails.loadMore', { n: items.length, total: data.total })" @click="more" />
    <UButton color="neutral" variant="ghost" icon="i-lucide-mail" :label="t('daily.mails.openFull')" :to="{ path: '/mail', query: { logement: route.params.id } }" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
const q = ref('')
const loading = ref(false)
const PAGE = 30
const query = (offset: number) => ({ logement: route.params.id, q: q.value || undefined, limit: PAGE, offset })
const { data } = await useFetch('/api/mail/messages', { query: computed(() => query(0)) })
const extra = ref<any[]>([])
watch(() => data.value, () => { extra.value = [] })
const items = computed(() => [...(data.value?.items ?? []), ...extra.value])
async function more() {
  loading.value = true
  try { extra.value.push(...((await $fetch<any>('/api/mail/messages', { query: query(items.value.length) })).items)) } finally { loading.value = false }
}
const shortDate = (d: string) => new Date(d).toLocaleDateString(fmtLocale.value, { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })
</script>
