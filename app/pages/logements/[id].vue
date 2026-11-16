<template>
  <div v-if="logement">
    <div class="mb-4 print:hidden">
      <h1 class="text-xl font-semibold">{{ logement.name }}</h1>
      <p class="text-sm text-muted">{{ logement.lodgifyName ? t('daily.lg.lodgify', { name: logement.lodgifyName }) : t('daily.lg.notLinked') }}</p>
    </div>
    <UAlert v-if="route.query.logement === 'tous'" class="mb-4 print:hidden" color="info" variant="subtle" icon="i-lucide-info"
            :title="t('daily.lg.noAllTitle')" :description="t('daily.lg.noAllDesc')" />
    <UNavigationMenu orientation="horizontal" highlight :items="menu" class="mb-6 print:hidden" />
    <div class="min-w-0">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { can, refresh } = useAuth()
await refresh()
const { data: logement } = await useFetch(() => `/api/logements/${route.params.id}`)
if (!logement.value) throw createError({ statusCode: 404, statusMessage: t('daily.lg.notFound'), fatal: true })
// Loussa Réservations actif : les onglets (livret, réservations, bilan, timeline) affichent aussi les données du PMS
const pms = useState<boolean>('pms', () => false)
watchEffect(() => { pms.value = !!logement.value?.pms })
const menu = computed(() => {
  const base = `/logements/${route.params.id}`
  // Lettres = rôles autorisés (mêmes que la table des permissions du serveur, qui reste seule juge)
  return [
    ['AG', { label: t('nav.reservations'), icon: 'i-lucide-calendar-days', to: `${base}/reservations` }],
    ['AG', { label: t('daily.lg.history'), icon: 'i-lucide-git-commit-vertical', to: `${base}/timeline` }],
    ['AGM', { label: t('daily.stock.title'), icon: 'i-lucide-package', to: `${base}/stock` }],
    ['AG', { label: t('nav.domotique'), icon: 'i-lucide-house-wifi', to: `${base}/serrures`, active: /\/(serrures|domotique)$/.test(route.path) }],
    ['A', { label: t('daily.lg.qrCleaning'), icon: 'i-lucide-qr-code', to: `${base}/qr` }],
    ['AG', { label: t('daily.lg.guidebook'), icon: 'i-lucide-book-heart', to: `${base}/livret` }],
    ['AGC', { label: t('nav.documents'), icon: 'i-lucide-folder-open', to: `${base}/documents` }],
    ['AGC', { label: t('nav.bilan'), icon: 'i-lucide-calculator', to: `${base}/bilan` }],
    ['A', { label: t('nav.mail'), icon: 'i-lucide-mail', to: `${base}/mails` }],
    ['A', { label: t('nav.contacts'), icon: 'i-lucide-contact', to: `${base}/contacts` }],
    ['A', { label: t('daily.lg.connectors'), icon: 'i-lucide-plug', to: `${base}/connecteurs` }],
  ].filter(([letters]) => can(letters as string)).map(([, item]) => item)
})
</script>
