<template>
  <div v-if="data" class="space-y-4">
    <h2 class="section-title !mt-0">{{ t('nav.connections') }}</h2>
    <p class="text-sm text-muted">{{ t('admin.connexions.intro') }}</p>
    <UAlert v-if="!data.keyPresent" color="error" variant="subtle" icon="i-lucide-key-round" :title="t('admin.connexions.keyMissing')"
      :description="t('admin.connexions.keyMissingText')" />
    <UAlert v-if="envCount" color="warning" variant="subtle" icon="i-lucide-file-warning" :title="t('admin.connexions.envValues', { n: envCount })"
      :description="t('admin.connexions.envText')" />
    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" />

    <!-- Briques LoussaSuite : applis / middlewares de la suite, branchees par adresse + jeton d'application -->
    <template v-if="tab === 'briques'">
      <p class="text-sm text-muted">{{ t('admin.connexions.bricksIntro') }}</p>
      <div class="grid gap-4 lg:grid-cols-2">
        <UCard v-for="g in groupsOf(BRICKS)" :key="g.key">
          <template #header>
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold">{{ g.title }}</h3>
                <p class="text-xs text-muted">{{ g.description }}</p>
              </div>
              <UBadge size="sm" variant="subtle" :color="brickStatus(g.key).color" :label="brickStatus(g.key).label" />
            </div>
          </template>
          <div class="space-y-3">
            <template v-for="e in data.entries.filter(x => x.group === g.key)" :key="e.name">
              <SecretField v-if="e.kind === 'secret'" :label="e.label" :help="e.help" :status="e as any" @save="v => save({ secrets: { [e.name]: v } })" />
              <UFormField v-else :label="e.label" :help="e.help">
                <div class="flex gap-2">
                  <UInput v-model="form[e.name]" :placeholder="e.placeholder" class="flex-1" />
                  <UButton size="sm" color="neutral" variant="outline" :label="t('admin.common.save')" :disabled="form[e.name] === (e as any).value" @click="save({ settings: { [e.name]: form[e.name] ?? '' } })" />
                </div>
              </UFormField>
            </template>
            <p v-if="g.key === 'mail'" class="text-xs text-muted"><NuxtLink to="/settings/imap" class="underline">{{ t('admin.connexions.mailRules') }}</NuxtLink></p>
            <UButton v-if="g.key === 'mailer'" size="xs" icon="i-lucide-plus" :label="t('admin.connexions.addMailbox')" to="/settings/imap?assistant=1" />
            <i18n-t v-if="g.key === 'homey'" keypath="admin.connexions.homeyNote" tag="p" class="text-xs text-muted"><template #link><NuxtLink :to="domotiqueLink" class="underline">{{ t('nav.domotique') }}</NuxtLink></template></i18n-t>
          </div>
        </UCard>
        <UCard>
          <template #header>
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold">{{ t('admin.connexions.combinedTitle') }}</h3>
                <p class="text-xs text-muted">{{ t('admin.connexions.combinedDesc') }}</p>
              </div>
              <UBadge size="sm" variant="subtle" :color="brickStatus('pms').color" :label="pmsOn ? t('status.viaPms') : t('status.local')" />
            </div>
          </template>
          <p class="text-sm text-muted">{{ t('admin.connexions.combinedBody') }}</p>
        </UCard>
      </div>
    </template>

    <!-- Connexions directes : services tiers utilises directement par Host (et catalogue des plugins/connecteurs) -->
    <template v-else>
      <p class="text-sm text-muted">{{ t('admin.connexions.directIntro') }}</p>
      <div class="grid gap-4 lg:grid-cols-2">
        <UCard v-for="g in groupsOf(DIRECT)" :key="g.key">
          <template #header>
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold">{{ g.title }}</h3>
                <p class="text-xs text-muted">{{ g.description }}</p>
              </div>
            </div>
          </template>
          <div class="space-y-3">
            <template v-for="e in data.entries.filter(x => x.group === g.key)" :key="e.name">
              <SecretField v-if="e.kind === 'secret'" :label="e.label" :help="e.help" :status="e as any" @save="v => save({ secrets: { [e.name]: v } })" />
              <UFormField v-else :label="e.label" :help="e.help">
                <div class="flex gap-2">
                  <UInput v-model="form[e.name]" :placeholder="e.placeholder" class="flex-1" />
                  <UButton size="sm" color="neutral" variant="outline" :label="t('admin.common.save')" :disabled="form[e.name] === (e as any).value" @click="save({ settings: { [e.name]: form[e.name] ?? '' } })" />
                </div>
              </UFormField>
            </template>
            <p v-if="g.key === 'mail'" class="text-xs text-muted"><NuxtLink to="/settings/imap" class="underline">{{ t('admin.connexions.mailRules') }}</NuxtLink></p>
            <i18n-t v-if="g.key === 'mailoauth'" keypath="admin.connexions.oauthNote" tag="p" class="text-xs text-muted"><template #google><code>{{ origin }}/api/mail/oauth/google/callback</code></template><template #microsoft><code>{{ origin }}/api/mail/oauth/microsoft/callback</code></template></i18n-t>
            <UButton v-if="g.key === 'mail' || g.key === 'mailoauth'" size="xs" icon="i-lucide-plus" :label="t('admin.connexions.addMailbox')" to="/settings/imap?assistant=1" />
            <i18n-t v-if="g.key === 'homey'" keypath="admin.connexions.homeyNote" tag="p" class="text-xs text-muted"><template #link><NuxtLink :to="domotiqueLink" class="underline">{{ t('nav.domotique') }}</NuxtLink></template></i18n-t>
          </div>
        </UCard>
        <UCard>
          <template #header>
            <h3 class="font-semibold">{{ t('admin.connexions.connectorSecrets') }}</h3>
            <p class="text-xs text-muted">{{ t('admin.connexions.connectorSecretsHelp') }}</p>
          </template>
          <div class="space-y-3">
            <SecretField v-for="s in data.connectorSecrets" :key="s.name" :label="s.name" :status="s" @save="v => save({ secrets: { [s.name]: v } })" />
            <div class="flex flex-wrap gap-2">
              <UInput v-model="newName" placeholder="CONNECTOR_MON_SERVICE" class="w-60" />
              <UInput v-model="newValue" type="password" autocomplete="new-password" :placeholder="t('admin.connexions.valuePlaceholder')" class="flex-1" />
              <UButton size="sm" icon="i-lucide-plus" :label="t('admin.common.add')" :disabled="!/^CONNECTOR_[A-Z0-9_]{1,60}$/.test(newName) || !newValue.trim()" @click="addConnector" />
            </div>
          </div>
        </UCard>
      </div>
      <PluginsCatalog class="pt-4" />
    </template>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { data, refresh } = await useFetch('/api/settings/connexions')
// Deux onglets : briques de LoussaSuite / services tiers en direct (?onglet=briques|directes)
const route = useRoute()
const tabs = computed(() => [{ label: t('admin.connexions.tabBricks'), value: 'briques', icon: 'i-lucide-boxes' }, { label: t('admin.connexions.tabDirect'), value: 'directes', icon: 'i-lucide-plug' }])
const tab = computed({
  get: () => (route.query.onglet === 'directes' ? 'directes' : 'briques'),
  set: v => navigateTo({ query: { ...route.query, onglet: v } }, { replace: true }),
})
const BRICKS = ['pms', 'mailer', 'place', 'clean', 'stock', 'cast']
const DIRECT = ['direct', 'homey', 'mail', 'mailoauth', 'translate', 'webhook']
const groupsOf = (keys: string[]) => (data.value?.groups ?? []).filter(g => keys.includes(g.key)).sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key))
const { data: pms } = await useFetch('/api/pms/status', { key: 'pms-status' })
const pmsOn = computed(() => !!pms.value?.configured)
// Pastille d'etat : PMS d'apres /api/pms/status, les autres briques d'apres la presence de leur adresse
function brickStatus(key: string): { label: string; color: 'success' | 'error' | 'neutral' | 'info' } {
  if (key === 'pms') return !pmsOn.value ? { label: t('status.off'), color: 'neutral' } : pms.value?.ok ? { label: t('status.connected'), color: 'success' } : { label: t('status.error'), color: 'error' }
  const url = (data.value?.entries ?? []).find(e => e.name === `ROCKET_${key.toUpperCase()}_URL`) as any
  return url?.value ? { label: t('admin.connexions.configured'), color: 'info' } : { label: t('status.off'), color: 'neutral' }
}
const { data: lg } = useNuxtData<{ logements: { id: number }[] }>('logements')
const domotiqueLink = computed(() => (lg.value?.logements?.[0] ? `/logements/${lg.value.logements[0].id}/domotique` : '/logements'))
const form = reactive<Record<string, string>>({})
const origin = useRequestURL().origin
const error = ref('')
const newName = ref(''), newValue = ref('')
watchEffect(() => { for (const e of data.value?.entries ?? []) if (e.kind === 'setting') form[e.name] = String((e as any).value ?? '') })
const envCount = computed(() => [...(data.value?.entries ?? []), ...(data.value?.connectorSecrets ?? [])].filter(e => (e as any).source === 'env').length)
async function save(body: { settings?: Record<string, string>; secrets?: Record<string, string | null> }) {
  error.value = ''
  if (body.secrets && Object.values(body.secrets).includes(null) && !confirm(t('admin.connexions.confirmClear'))) return
  try { await $fetch('/api/settings/connexions', { method: 'PUT', body }); await refresh() } catch (e: any) { error.value = e?.data?.statusMessage || t('account.retry') }
}
async function addConnector() { await save({ secrets: { [newName.value]: newValue.value } }); newName.value = ''; newValue.value = '' }
</script>
