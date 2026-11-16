<template>
  <div v-if="data">
    <!-- Loussa Réservations actif : ménages créés dans Loussa Lieux après chaque départ (lecture seule) -->
    <template v-if="pms">
      <h2 class="section-title !mt-0">{{ t('daily.tl.cleanings') }}</h2>
      <p class="mb-2 text-sm text-muted">{{ t('daily.tl.cleaningsIntro') }}</p>
      <UCard class="mb-6">
        <p v-if="menStatus === 'pending' || menStatus === 'idle'" class="text-sm text-muted">{{ t('daily.common.loading') }}</p>
        <p v-else-if="!menages" class="text-sm text-muted">{{ t('daily.tl.pmsDown') }}</p>
        <p v-else-if="!menages.items.length" class="text-sm text-muted">{{ t('daily.tl.noCleaning') }}</p>
        <ul v-else class="divide-y divide-default text-sm">
          <li v-for="(m, i) in menages.items" :key="i" class="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><UIcon name="i-lucide-spray-can" class="mr-1 size-4 align-middle text-muted" /><b>{{ when(m.at) }}</b> · {{ m.title }}</span>
            <UBadge size="sm" variant="subtle" :color="/terminé/.test(m.description) ? 'success' : /en cours/.test(m.description) ? 'info' : 'neutral'" :label="m.description" />
          </li>
        </ul>
      </UCard>
    </template>
    <h2 class="section-title" :class="!pms && '!mt-0'">{{ t('daily.tl.title') }}</h2>
    <p class="mb-2 text-sm text-muted">{{ t('daily.tl.intro') }}</p>
    <EventTimeline :events="data.events" :now="data.now" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
const pms = useState<boolean>('pms', () => false)
const { data } = await useFetch(() => `/api/logements/${route.params.id}/timeline`)
const { data: menages, status: menStatus } = useFetch(() => `/api/logements/${route.params.id}/pms-menages`, { server: false, immediate: pms.value })
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const when = (d: string) => new Date(d).toLocaleString(fmtLocale.value, { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>
