<template>
  <div v-if="data" class="space-y-3">
    <BrickHint brick="pms" :description="t('manage.imap.hint')" />
    <!-- Liste des boites (assistant « Ajouter une boite e-mail ») ; la boite principale se regle en detail plus bas -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !my-0">{{ t('manage.imap.mailboxes') }}</h2>
      <UButton icon="i-lucide-plus" :label="t('manage.imap.addMailbox')" data-add-mailbox @click="openWizard()" />
    </div>
    <UAlert v-if="oauthError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="oauthError" />
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <ul class="divide-y divide-default">
        <li v-for="m in boxes?.mailboxes ?? []" :key="m.id" class="flex flex-wrap items-center justify-between gap-2 p-3">
          <div class="min-w-0 text-sm">
            <p class="flex flex-wrap items-center gap-2 font-medium">
              {{ m.email || m.label }}
              <UBadge size="sm" variant="subtle" :color="SOURCE[m.source]?.color ?? 'neutral'" :label="SOURCE[m.source]?.label ?? m.source" />
              <UBadge v-if="m.primary" size="sm" variant="outline" color="neutral" :label="t('manage.imap.primary')" />
            </p>
            <p class="truncate text-xs text-muted">{{ m.status || t('manage.imap.notTested') }}</p>
          </div>
          <div class="flex items-center gap-1">
            <USwitch v-if="!m.source.startsWith('mailer')" :model-value="m.enabled" :label="m.enabled ? t('manage.imap.fetchOn') : t('manage.imap.fetchOff')" @update:model-value="setEnabled(m.id, $event)" />
            <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plug-zap" :label="t('manage.imap.test')" :loading="busy === `t${m.id}`" @click="testBox(m.id)" />
            <UButton v-if="!m.primary" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('manage.imap.removeAria', { email: m.email })" @click="removeBox(m)" />
          </div>
        </li>
        <li v-if="!boxes?.mailboxes?.length" class="p-3 text-sm text-muted">{{ t('manage.imap.noMailbox') }}</li>
      </ul>
    </UCard>
    <p class="text-xs text-muted"><i18n-t keypath="manage.imap.primaryNote" tag="span"><template #main><b>{{ t('manage.imap.mainWord') }}</b></template></i18n-t></p>
    <MailboxWizard v-model:open="wizardOpen" :resume="resume" @saved="onSaved" />

    <h2 class="section-title">{{ t('manage.imap.mainTitle') }}</h2>
    <p class="text-sm text-muted">
      <i18n-t keypath="manage.imap.mainIntro" tag="span"><template #ro><b>{{ t('manage.imap.readOnly') }}</b></template></i18n-t>
    </p>

    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <USwitch v-model="cfg.enabled" :label="cfg.enabled ? t('manage.imap.autoOn') : t('manage.imap.autoOff')" @update:model-value="saveConfig" />
        <div class="flex gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-plug-zap" :label="t('manage.imap.testConn')" :loading="busy === 'test'" :disabled="!data.passwordSet" @click="test" />
          <UButton icon="i-lucide-mail-search" :label="t('manage.imap.fetchNow')" :loading="busy === 'run'" :disabled="!data.passwordSet || !data.rules.length" @click="run" />
        </div>
      </div>
      <div class="mt-3">
        <SecretField :label="t('manage.imap.pwdLabel')" :status="data.password" :help="t('manage.imap.pwdHelp')" @save="savePassword" />
      </div>
      <p class="mt-1 text-sm text-muted">
        {{ t('manage.imap.lastFetch', { date: data.config.lastRunAt ? when(data.config.lastRunAt) : t('manage.imap.never') }) }}<template v-if="data.config.lastResult"> — {{ data.config.lastResult }}</template>
      </p>
      <div v-if="result" class="mt-3 rounded-md border border-default p-3 text-sm">
        <p v-if="!result.ok" class="text-error">✗ {{ result.error || result.message }}</p>
        <template v-else-if="result.rules">
          <p class="text-success">{{ t('manage.imap.connOk', { n: result.folders?.length, folder: cfg.folder }) }}</p>
          <p v-for="r in result.rules" :key="r.id" class="text-muted">{{ t('manage.imap.ruleMatches', { name: r.name, n: r.matches, days: cfg.sinceDays }) }}</p>
          <p v-if="!result.rules.length" class="text-muted">{{ t('manage.imap.noActiveRule') }}</p>
        </template>
        <p v-else class="text-success">✓ {{ result.message }}</p>
      </div>
    </UCard>

    <h3 class="section-title">{{ t('manage.imap.connection') }}</h3>
    <UCard>
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="saveConfig">
        <UFormField :label="t('manage.imap.login')" class="sm:col-span-2">
          <div class="flex gap-2">
            <UInput v-model="cfg.user" :placeholder="t('manage.imap.emailPlaceholder')" class="flex-1" />
            <UButton color="neutral" variant="outline" icon="i-lucide-search" :label="t('manage.imap.detectService')" :loading="busy === 'detect'" :disabled="!cfg.user.includes('@')" @click="detect" />
          </div>
        </UFormField>
        <p v-if="detected" class="text-sm sm:col-span-2" :class="detected.ok && detected.provider ? 'text-success' : 'text-warning'">
          <template v-if="!detected.ok">{{ detected.message }}</template>
          <template v-else-if="detected.provider">
            <i18n-t keypath="manage.imap.domainManaged" tag="span">
              <template #domain><b>{{ detected.domain }}</b></template>
              <template #label><b>{{ detected.label }}</b></template>
              <template #mx>{{ detected.mx.slice(0, 2).join(', ') }}</template>
            </i18n-t>
            <template v-if="detected.hostResolves === false"> {{ t('manage.imap.noDns', { host: detected.host }) }}</template>
          </template>
          <template v-else><i18n-t keypath="manage.imap.domainUnknown" tag="span"><template #domain><b>{{ detected.domain }}</b></template><template #mx>{{ detected.mx.slice(0, 2).join(', ') }}</template></i18n-t></template>
        </p>
        <UFormField :label="t('manage.imap.provider')" class="sm:col-span-2">
          <USelect v-model="cfg.provider" :items="providerItems" class="w-full" @update:model-value="onProvider" />
        </UFormField>
        <p v-if="provider?.note" class="text-sm text-muted sm:col-span-2">{{ provider.note }}</p>
        <UFormField :label="t('manage.imap.imapServer')"><UInput v-model="cfg.host" :disabled="hostLocked" :placeholder="t('manage.imap.imapPlaceholder')" class="w-full" /></UFormField>
        <UFormField :label="t('manage.imap.port')"><UInput v-model.number="cfg.port" type="number" :disabled="portLocked" class="w-full" /></UFormField>
        <USwitch v-model="cfg.secure" :disabled="portLocked" class="sm:col-span-2" :label="t('manage.imap.tls993')" />
        <UFormField :label="t('manage.imap.folder')"><UInput v-model="cfg.folder" placeholder="INBOX" class="w-full" /></UFormField>
        <UFormField :label="t('manage.imap.interval')"><UInput v-model.number="cfg.intervalMin" type="number" min="5" max="1440" class="w-full" /></UFormField>
        <UFormField :label="t('manage.imap.history')"><UInput v-model.number="cfg.sinceDays" type="number" min="1" max="365" class="w-full" /></UFormField>
        <UButton type="submit" class="sm:col-span-2" :label="t('manage.imap.saveConn')" :loading="busy === 'save'" block />
      </form>
    </UCard>

    <h3 class="section-title">{{ t('manage.imap.smtpTitle') }}</h3>
    <UCard>
      <p class="mb-3 text-sm text-muted">
        {{ t('manage.imap.smtpIntro') }}
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField :label="t('manage.imap.smtpServer')"><UInput v-model="cfg.smtpHost" :disabled="portLocked" class="w-full" /></UFormField>
        <UFormField :label="t('manage.imap.port')"><UInput v-model.number="cfg.smtpPort" type="number" :disabled="portLocked" class="w-full" /></UFormField>
        <USwitch v-model="cfg.smtpSecure" :disabled="portLocked" class="sm:col-span-2" :label="t('manage.imap.tls465')" />
        <UFormField :label="t('manage.imap.fromName')" class="sm:col-span-2"><UInput v-model="cfg.fromName" :placeholder="t('manage.imap.namePlaceholder')" class="w-full" /></UFormField>
        <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
          <UButton :loading="busy === 'save'" :label="t('manage.imap.saveSmtp')" @click="saveConfig" />
          <UButton color="neutral" variant="outline" icon="i-lucide-plug-zap" :label="t('manage.imap.testSmtp')" :loading="busy === 'smtp'" :disabled="!data.passwordSet" @click="testSmtp" />
        </div>
      </div>
      <p v-if="smtpResult" class="mt-2 text-sm" :class="smtpResult.ok ? 'text-success' : 'text-error'">
        {{ smtpResult.ok ? t('manage.imap.smtpOk', { host: smtpResult.host, port: smtpResult.port }) : `✗ ${smtpResult.error}` }}
      </p>
    </UCard>

    <h3 class="section-title">{{ t('manage.imap.uiTitle') }}</h3>
    <UCard>
      <p class="mb-3 text-sm text-muted">
        <i18n-t keypath="manage.imap.uiIntro" tag="span"><template #link><NuxtLink to="/mail" class="underline">{{ t('manage.mail.title') }}</NuxtLink></template></i18n-t>
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <USwitch v-model="cfg.syncMail" :label="cfg.syncMail ? t('manage.imap.syncOn') : t('manage.imap.syncOff')" @update:model-value="saveConfig" />
        <UFormField :label="t('manage.imap.history')"><UInput v-model.number="cfg.mailDays" type="number" min="1" max="365" class="w-28" @change="saveConfig" /></UFormField>
        <UButton color="error" variant="ghost" icon="i-lucide-trash-2" :label="t('manage.imap.clearCache')" @click="clearMailCache" />
      </div>
      <p class="mt-2 text-sm text-muted">{{ t('manage.imap.lastSync', { date: data.config.mailSyncedAt ? when(data.config.mailSyncedAt) : t('manage.imap.never') }) }}<template v-if="data.config.mailResult"> — {{ data.config.mailResult }}</template></p>
    </UCard>

    <h3 class="section-title">{{ t('manage.imap.rulesTitle') }}</h3>
    <UCard v-for="r in data.rules" :key="r.id">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0 text-sm">
          <p class="font-medium">{{ r.name }} <UBadge color="neutral" variant="outline" size="sm" :label="r.source" /></p>
          <p class="text-muted">{{ t('manage.imap.senderContains', { sender: r.sender }) }}<template v-if="r.subject"> · {{ t('manage.imap.subjectContains', { subject: r.subject }) }}</template></p>
          <p class="text-muted">→ {{ categoryLabel(r.category) }} · {{ r.logementId ? logementName(r.logementId) : t('manage.imap.toSort') }}</p>
        </div>
        <div class="flex items-center gap-1">
          <USwitch :model-value="r.enabled" @update:model-value="toggle(r, $event)" />
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" :label="t('manage.imap.edit')" @click="edit(r)" />
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeRule(r)" />
        </div>
      </div>
    </UCard>
    <UCard v-if="!data.rules.length"><p class="text-sm text-muted">{{ t('manage.imap.noRules') }}</p></UCard>

    <UCard>
      <p class="mb-2 text-sm font-medium">{{ rule.id ? t('manage.imap.editRule') : t('manage.imap.newRule') }}</p>
      <div class="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted">
        {{ t('manage.imap.templates') }}
        <UButton v-for="p in presets" :key="p.name" size="xs" color="neutral" variant="soft" :label="p.name" @click="preset(p)" />
        <span class="text-xs">{{ t('manage.imap.checkAddr') }}</span>
      </div>
      <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="saveRule">
        <UInput v-model="rule.name" :placeholder="t('manage.imap.phName')" />
        <UInput v-model="rule.source" :placeholder="t('manage.imap.phSource')" />
        <UInput v-model="rule.sender" :placeholder="t('manage.imap.phSender')" />
        <UInput v-model="rule.subject" :placeholder="t('manage.imap.phSubject')" />
        <USelect v-model="rule.category" :items="categoryItems" />
        <USelect v-model="rule.logementId" :items="logementItems" />
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" :label="rule.id ? t('manage.imap.saveRule') : t('manage.imap.addRule')" :loading="busy === 'rule'" />
          <UButton v-if="rule.id" color="neutral" variant="ghost" :label="t('manage.imap.cancel')" @click="resetRule" />
        </div>
      </form>
      <p class="mt-2 text-xs text-muted">{{ t('manage.imap.rulesNote') }}</p>
    </UCard>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
const { data, refresh } = await useFetch('/api/imap')
const { data: boxes, refresh: refreshBoxes } = await useFetch('/api/mailboxes', { key: 'mailboxes' })
const SOURCE = computed<Record<string, { label: string; color: 'primary' | 'info' | 'success' | 'warning' | 'neutral' }>>(() => ({
  'mailer-shared': { label: t('manage.imap.srcShared'), color: 'primary' }, 'mailer-personal': { label: t('manage.imap.srcPersonal'), color: 'primary' },
  google: { label: 'Google', color: 'info' }, microsoft: { label: 'Microsoft', color: 'info' }, local: { label: t('manage.imap.srcLocal'), color: 'neutral' },
}))
// Assistant : ouvert par le bouton, par ?assistant=1 (lien depuis Connexions) ou au retour OAuth (?assistant=google&boite=… / &erreur=…)
const route = useRoute()
const wizardOpen = ref(false)
const resume = ref<{ provider: string; id?: number; error?: string } | null>(null)
const oauthError = ref('')
function openWizard(r: typeof resume.value = null) { resume.value = r; wizardOpen.value = true }
onMounted(() => {
  const q = route.query
  if (!q.assistant) return
  if (q.assistant === 'google' || q.assistant === 'microsoft') {
    if (q.erreur) oauthError.value = String(q.erreur)
    openWizard({ provider: String(q.assistant), id: q.boite ? Number(q.boite) : undefined, error: q.erreur ? String(q.erreur) : undefined })
  } else openWizard()
  navigateTo({ query: {} }, { replace: true })
})
async function onSaved() { await Promise.all([refreshBoxes(), refresh()]) }
async function setEnabled(id: number, enabled: boolean) {
  error.value = ''
  try { await $fetch(`/api/mailboxes/${id}`, { method: 'PUT', body: { enabled } }); await onSaved(); cfg.enabled = !!data.value?.config.enabled } catch (e) { fail(e) }
}
async function testBox(id: number) {
  busy.value = `t${id}`; error.value = ''
  try { await $fetch(`/api/mailboxes/${id}/test`, { method: 'POST' }); await refreshBoxes() } catch (e) { fail(e) }
  busy.value = null
}
async function removeBox(m: { id: number; email: string }) {
  if (!confirm(t('manage.imap.confirmRemove', { email: m.email }))) return
  error.value = ''
  try { await $fetch(`/api/mailboxes/${m.id}`, { method: 'DELETE' }); await refreshBoxes() } catch (e) { fail(e) }
}
const cfg = reactive({ ...(data.value?.config ?? { provider: 'ovh-mxplan', enabled: false, host: '', port: 993, secure: true, user: '', folder: 'INBOX', intervalMin: 15, sinceDays: 30 }) })
const detected = ref<any>(null)
const smtpResult = ref<any>(null)
const providerItems = computed(() => (data.value?.providers ?? []).map(p => ({ label: p.label, value: p.key })))
const provider = computed(() => data.value?.providers.find(p => p.key === cfg.provider))
// Service connu : serveur, port et securite viennent de la liste (sauf numero de serveur propre au compte : OVH Email Pro / Exchange)
const hostLocked = computed(() => !!provider.value && provider.value.key !== 'custom' && !provider.value.hostPattern)
const portLocked = computed(() => !!provider.value && provider.value.key !== 'custom')
function onProvider() {
  const p = provider.value
  if (p && p.key !== 'custom') Object.assign(cfg, { host: p.host, port: p.port, secure: p.secure })
  const sp = (p as any)?.smtp
  if (sp) Object.assign(cfg, { smtpHost: sp.sameAsImap ? cfg.host : sp.host, smtpPort: sp.port, smtpSecure: sp.secure })
}
async function detect() {
  busy.value = 'detect'; error.value = ''; detected.value = null
  try {
    detected.value = await $fetch('/api/imap/detect', { method: 'POST', body: { email: cfg.user } })
    if (detected.value.ok && detected.value.provider) { cfg.provider = detected.value.provider; onProvider() }
  } catch (e) { fail(e) }
  busy.value = null
}
const busy = ref<string | null>(null)
const error = ref('')
const result = ref<any>(null)
const blank = () => ({ id: 0, name: '', source: '', sender: '', subject: '', category: 'frais_plateformes', logementId: 0, enabled: true })
const rule = reactive(blank())
const presets = [
  { name: 'Airbnb', source: 'airbnb', sender: 'airbnb.com', category: 'frais_plateformes' },
  { name: 'Booking.com', source: 'booking', sender: 'booking.com', category: 'frais_plateformes' },
  { name: 'Lodgify', source: 'lodgify', sender: 'lodgify.com', category: 'abonnements' },
]
const logementItems = computed(() => [{ label: t('manage.imap.toSortLater'), value: 0 }, ...(data.value?.logements ?? []).map(l => ({ label: l.name, value: l.id }))])
const categoryItems = computed(() => {
  const groups: Record<string, string> = { charge: t('manage.imap.catCharges'), recette: t('manage.imap.catIncome'), doc: t('manage.imap.catDocs') }
  return Object.entries(groups).map(([kind, label]) => [
    { type: 'label' as const, label },
    ...(data.value?.categories ?? []).filter(c => c.kind === kind).map(c => ({ label: c.label, value: c.key })),
  ])
})
const categoryLabel = (k: string) => data.value?.categories.find(c => c.key === k)?.label ?? k
const logementName = (id: number) => data.value?.logements.find(l => l.id === id)?.name ?? t('manage.imap.propertyN', { id })
const when = (d: string) => new Date(d).toLocaleString(fmtLocale.value, { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fail = (e: any) => { error.value = e?.data?.statusMessage || t('manage.imap.failed') }

async function saveConfig() {
  busy.value = 'save'; error.value = ''
  try { await $fetch('/api/imap/config', { method: 'PUT', body: { provider: cfg.provider, enabled: cfg.enabled, host: cfg.host, port: cfg.port, secure: cfg.secure, user: cfg.user, folder: cfg.folder, intervalMin: cfg.intervalMin, sinceDays: cfg.sinceDays, syncMail: cfg.syncMail, mailDays: cfg.mailDays, smtpHost: cfg.smtpHost, smtpPort: cfg.smtpPort, smtpSecure: cfg.smtpSecure, fromName: cfg.fromName } }); await refresh() }
  catch (e) { fail(e) }
  busy.value = null
}
async function savePassword(v: string | null) {
  if (v === null && !confirm(t('manage.imap.confirmPwd'))) return
  error.value = ''
  try { await $fetch('/api/settings/connexions', { method: 'PUT', body: { secrets: { IMAP_PASSWORD: v } } }); await refresh() } catch (e) { fail(e) }
}
async function test() {
  busy.value = 'test'; error.value = ''; result.value = null
  try { await saveConfig(); result.value = await $fetch('/api/imap/test', { method: 'POST' }) } catch (e) { fail(e) }
  busy.value = null
}
async function testSmtp() {
  busy.value = 'smtp'; error.value = ''; smtpResult.value = null
  try { await saveConfig(); smtpResult.value = await $fetch('/api/mail/smtp-test', { method: 'POST' }) } catch (e) { fail(e) }
  busy.value = null
}
async function run() {
  busy.value = 'run'; error.value = ''; result.value = null
  try { result.value = await $fetch('/api/imap/run', { method: 'POST' }); await refresh() } catch (e) { fail(e) }
  busy.value = null
}
async function clearMailCache() {
  if (!confirm(t('manage.imap.confirmCache'))) return
  error.value = ''
  try { await $fetch('/api/mail/cache', { method: 'DELETE' }); await refresh() } catch (e) { fail(e) }
}
const resetRule = () => Object.assign(rule, blank())
const preset = (p: typeof presets[number]) => Object.assign(rule, { name: `Factures ${p.name}`, source: p.source, sender: p.sender, category: p.category })
const edit = (r: typeof rule) => Object.assign(rule, { ...r })
async function saveRule() {
  busy.value = 'rule'; error.value = ''
  try {
    const body = { name: rule.name, source: rule.source, sender: rule.sender, subject: rule.subject, category: rule.category, logementId: rule.logementId, enabled: rule.enabled }
    await $fetch(rule.id ? `/api/imap/rules/${rule.id}` : '/api/imap/rules', { method: rule.id ? 'PUT' : 'POST', body })
    resetRule(); await refresh()
  } catch (e) { fail(e) }
  busy.value = null
}
async function toggle(r: typeof rule, enabled: boolean) {
  error.value = ''
  try { await $fetch(`/api/imap/rules/${r.id}`, { method: 'PUT', body: { ...r, enabled } }); await refresh() } catch (e) { fail(e) }
}
async function removeRule(r: { id: number; name: string }) {
  if (!confirm(t('manage.imap.confirmRule', { name: r.name }))) return
  error.value = ''
  try { await $fetch(`/api/imap/rules/${r.id}`, { method: 'DELETE' }); await refresh() } catch (e) { fail(e) }
}
</script>
