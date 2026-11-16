<template>
  <!-- Assistant « Ajouter une boîte e-mail » : ① Source ② Connexion ③ Test ④ Règles ⑤ Récapitulatif.
       Relevé désactivé à la création ; rien n'est envoyé automatiquement. Les mots de passe ne sont jamais réaffichés. -->
  <UModal v-model:open="open" :title="t('manage.wizard.title')" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <ol class="mb-4 flex flex-wrap gap-1 text-xs">
        <li v-for="(s, i) in STEPS" :key="s" class="rounded-full px-2 py-0.5" :class="i === step ? 'bg-primary text-inverted' : i < step ? 'bg-elevated text-default' : 'text-muted'">{{ i + 1 }}. {{ s }}</li>
      </ol>

      <!-- ① Source -->
      <div v-if="step === 0" class="space-y-3">
        <p class="text-sm text-muted">{{ t('manage.wizard.sourceQ') }}</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <button v-for="s in sources" :key="s.key" type="button" class="rounded-lg border p-3 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            :class="source === s.key ? 'border-primary bg-primary/5' : 'border-default'" :data-source="s.key" @click="pick(s.key)">
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-2 font-medium"><UIcon :name="s.icon" class="size-4" />{{ s.label }}</span>
              <UBadge v-if="s.badge" size="sm" variant="subtle" :color="s.badgeColor" :label="s.badge" />
            </div>
            <p class="mt-1 text-xs text-muted">{{ s.help }}</p>
          </button>
        </div>
        <div v-if="source === 'mailer'" class="rounded-md border border-default p-3">
          <p class="mb-2 text-sm font-medium">{{ t('manage.wizard.mailerKindQ') }}</p>
          <URadioGroup v-model="mailerKind" :items="mailerKindItems" />
        </div>
      </div>

      <!-- ② Connexion -->
      <div v-else-if="step === 1" class="space-y-3">
        <template v-if="source === 'local'">
          <UFormField :label="t('manage.wizard.emailLabel')">
            <div class="flex gap-2">
              <UInput v-model="srv.user" name="wizard-email" :placeholder="t('manage.wizard.emailPlaceholder')" autocomplete="off" class="flex-1" @change="detect" />
              <UButton color="neutral" variant="outline" icon="i-lucide-search" :label="t('manage.wizard.detect')" :loading="busy === 'detect'" :disabled="!srv.user.includes('@')" @click="detect" />
            </div>
          </UFormField>
          <p v-if="detected" class="text-sm" :class="detected.ok && detected.provider ? 'text-success' : 'text-warning'">
            <template v-if="!detected.ok">{{ detected.message }}</template>
            <template v-else-if="detected.provider"><i18n-t keypath="manage.wizard.detected" tag="span"><template #label><b>{{ detected.label }}</b></template></i18n-t></template>
            <template v-else>{{ t('manage.wizard.unknownService') }}</template>
          </p>
          <UFormField :label="t('manage.wizard.provider')"><USelect v-model="srv.provider" :items="providerItems" class="w-full" @update:model-value="onProvider" /></UFormField>
          <p v-if="provider?.note" class="text-xs text-muted">{{ provider.note }}</p>
          <div class="grid gap-2 sm:grid-cols-3">
            <UFormField :label="t('manage.wizard.imapServer')" class="sm:col-span-2"><UInput v-model="srv.host" :disabled="hostLocked" class="w-full" /></UFormField>
            <UFormField :label="t('manage.wizard.port')"><UInput v-model.number="srv.port" type="number" :disabled="locked" class="w-full" /></UFormField>
            <UFormField :label="t('manage.wizard.smtpServer')" class="sm:col-span-2"><UInput v-model="srv.smtpHost" :disabled="locked" class="w-full" /></UFormField>
            <UFormField :label="t('manage.wizard.port')"><UInput v-model.number="srv.smtpPort" type="number" :disabled="locked" class="w-full" /></UFormField>
          </div>
          <UFormField :label="t('manage.wizard.mbPassword')" :help="t('manage.wizard.mbPasswordHelp')">
            <UInput v-model="password" name="wizard-password" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
        </template>

        <template v-else-if="source === 'google' || source === 'microsoft'">
          <p class="text-sm text-muted">{{ t('manage.wizard.oauthIntro') }}</p>
          <UFormField :label="t('manage.wizard.addrOptional')"><UInput v-model="srv.user" :placeholder="t('manage.wizard.gmailPlaceholder')" class="w-full" /></UFormField>
          <UButton :icon="source === 'google' ? 'i-simple-icons-google' : 'i-simple-icons-microsoft'" :label="t('manage.wizard.signInWith', { name: oauthLabel })" :disabled="!oauthOk" data-oauth-button @click="startOAuth" />
          <UAlert v-if="!oauthOk" color="warning" variant="subtle" icon="i-lucide-settings" :title="t('manage.wizard.oauthTitle', { name: oauthLabel })">
            <template #description>
              <i18n-t keypath="manage.wizard.oauthDesc" tag="span">
                <template #vars>{{ source === 'google' ? 'GOOGLE_MAIL_CLIENT_ID / _SECRET' : 'MICROSOFT_MAIL_CLIENT_ID / _SECRET' }}</template>
                <template #link><NuxtLink to="/settings/connexions?onglet=directes" class="underline">{{ t('manage.wizard.oauthLink') }}</NuxtLink></template>
                <template #code><code>{{ origin }}/api/mail/oauth/{{ source }}/callback</code></template>
              </i18n-t>
              <template v-if="mailerOn"> {{ t('manage.wizard.oauthAlt', { name: oauthLabel }) }}</template>
            </template>
          </UAlert>
        </template>

        <template v-else-if="source === 'mailer'">
          <p v-if="mailerLoading" class="text-sm text-muted">{{ t('manage.wizard.mailerLoading') }}</p>
          <UAlert v-else-if="!mailer?.ok" color="warning" variant="subtle" icon="i-lucide-mail-warning" :title="t('manage.wizard.mailerDown')" :description="mailer?.message || t('manage.wizard.retryLater')" />
          <template v-else-if="mailerKind === 'shared'">
            <p class="text-sm text-muted"><i18n-t keypath="manage.wizard.sharedList" tag="span"><template #email><b>{{ mailer.userEmail }}</b></template></i18n-t></p>
            <URadioGroup v-if="mailer.shared.length" v-model="mailerId" :items="mailer.shared.map((m: any) => ({ label: `${m.name} — ${m.email}`, value: m.id }))" />
            <p v-else class="text-sm text-muted">{{ t('manage.wizard.noShared') }}</p>
          </template>
          <template v-else>
            <UAlert v-if="!mailer.personal" color="info" variant="subtle" icon="i-lucide-clock" :title="t('manage.wizard.soon')"
              :description="t('manage.wizard.noPersonal')" />
            <template v-else>
              <UFormField :label="t('manage.wizard.personalAddr')"><UInput v-model="srv.user" :placeholder="mailer.userEmail" class="w-full" /></UFormField>
              <UFormField :label="t('manage.wizard.personalPwd')"><UInput v-model="password" type="password" autocomplete="new-password" class="w-full" /></UFormField>
            </template>
          </template>
        </template>
      </div>

      <!-- ③ Test -->
      <div v-else-if="step === 2" class="space-y-3">
        <p class="text-sm text-muted">{{ t('manage.wizard.testIntro') }}</p>
        <UButton icon="i-lucide-plug-zap" :label="t('manage.wizard.runTest')" :loading="busy === 'test'" data-wizard-test @click="runTest" />
        <div v-if="test" class="space-y-1 rounded-md border border-default p-3 text-sm" data-wizard-result>
          <template v-if="test.imap || test.smtp">
            <p :class="test.imap?.ok ? 'text-success' : 'text-error'">{{ test.imap?.ok ? t('manage.wizard.imapOk', { n: test.imap.folders }) : `✗ ${test.imap?.error}` }}</p>
            <p :class="test.smtp?.ok ? 'text-success' : 'text-error'">{{ test.smtp?.ok ? t('manage.wizard.smtpOk') : `✗ ${test.smtp?.error}` }}</p>
          </template>
          <p v-else :class="test.ok ? 'text-success' : 'text-error'">{{ test.ok ? '✓' : '✗' }} {{ test.message }}</p>
        </div>
        <p v-if="test && !test.ok" class="text-xs text-muted">{{ t('manage.wizard.testFail') }}</p>
      </div>

      <!-- ④ Règles -->
      <div v-else-if="step === 3" class="space-y-3">
        <template v-if="source === 'mailer'">
          <p class="text-sm text-muted">{{ t('manage.wizard.mailerRules') }}</p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">{{ t('manage.wizard.rulesIntro') }}</p>
          <ul class="space-y-1 text-sm">
            <li v-for="r in rules" :key="r.id" class="flex items-center gap-2"><UIcon name="i-lucide-filter" class="size-4 text-muted" />{{ r.name }} <span class="text-muted">{{ t('manage.wizard.senderContains', { sender: r.sender }) }}</span></li>
            <li v-if="!rules.length" class="text-muted">{{ t('manage.wizard.noRules') }}</li>
          </ul>
          <div class="flex flex-wrap items-center gap-1 text-sm">
            {{ t('manage.wizard.addPreset') }}
            <UButton v-for="p in presets" :key="p.name" size="xs" color="neutral" variant="soft" :label="p.name" :disabled="rules.some((r: any) => r.sender === p.sender)" @click="addPreset(p)" />
          </div>
        </template>
      </div>

      <!-- ⑤ Récapitulatif -->
      <div v-else class="space-y-3 text-sm">
        <dl class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
          <dt class="text-muted">{{ t('manage.wizard.recapSource') }}</dt><dd>{{ sourceLabel }}</dd>
          <dt class="text-muted">{{ t('manage.wizard.recapAddr') }}</dt><dd>{{ summaryEmail || '—' }}</dd>
          <template v-if="source === 'local'"><dt class="text-muted">{{ t('manage.wizard.recapServers') }}</dt><dd>{{ srv.host }}:{{ srv.port }} · {{ srv.smtpHost }}:{{ srv.smtpPort }}</dd></template>
          <dt class="text-muted">{{ t('manage.wizard.recapTest') }}</dt><dd>{{ test ? (test.ok ? t('manage.wizard.testOk') : t('manage.wizard.testKo')) : t('manage.wizard.testNone') }}</dd>
          <dt class="text-muted">{{ t('manage.wizard.recapFetch') }}</dt><dd>{{ enabled ? t('manage.wizard.on') : t('manage.wizard.offDefault') }}</dd>
        </dl>
        <p class="text-muted">{{ t('manage.wizard.recapNote') }}</p>
        <UButton v-if="!savedId" icon="i-lucide-check" :label="t('manage.wizard.saveBox')" :loading="busy === 'save'" @click="save" />
        <template v-else>
          <p class="text-success">{{ t('manage.wizard.saved') }}</p>
          <USwitch v-if="source !== 'mailer'" :model-value="enabled" :label="enabled ? t('manage.wizard.fetchOn') : t('manage.wizard.fetchEnable')" @update:model-value="toggleEnabled" />
        </template>
      </div>

      <p v-if="error" class="mt-3 text-sm text-error" data-wizard-error>{{ error }}</p>
    </template>

    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton color="neutral" variant="ghost" :label="step ? t('manage.wizard.back') : t('manage.wizard.cancel')" :disabled="!!savedId && step === 4" @click="step ? back() : (open = false)" />
        <UButton v-if="step < 4" :label="t('manage.wizard.next')" trailing-icon="i-lucide-arrow-right" :disabled="!canNext" :loading="busy === 'next'" data-wizard-next @click="next" />
        <UButton v-else color="neutral" :label="t('manage.wizard.close')" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { t } = useI18n()
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ resume?: { provider: string; id?: number; error?: string } | null }>()
const emit = defineEmits<{ saved: [] }>()

const STEPS = computed(() => [t('manage.wizard.recapSource'), t('manage.wizard.stepConn'), t('manage.wizard.recapTest'), t('manage.wizard.stepRules'), t('manage.wizard.stepRecap')])
const step = ref(0)
const source = ref<'' | 'mailer' | 'google' | 'microsoft' | 'local'>('')
const mailerKind = ref<'shared' | 'personal'>('shared')
const mailerId = ref('')
const password = ref('')
const busy = ref<string | null>(null)
const error = ref('')
const test = ref<any>(null)
const detected = ref<any>(null)
const savedId = ref<number | null>(null)
const enabled = ref(false)
const srv = reactive({ provider: 'custom', host: '', port: 993, secure: true, smtpHost: '', smtpPort: 465, smtpSecure: true, user: '' })

const { data: boxes, refresh: refreshBoxes } = useFetch('/api/mailboxes', { key: 'mailboxes' })
const { data: imap, refresh: refreshImap } = useFetch('/api/imap', { key: 'imap-wizard' })
const mailer = ref<any>(null)
const mailerLoading = ref(false)
const origin = import.meta.client ? window.location.origin : ''
const mailerOn = computed(() => !!boxes.value?.mailer.configured)
const oauthOk = computed(() => (source.value === 'google' || source.value === 'microsoft') && !!(boxes.value?.oauth as any)?.[source.value]?.configured)
const oauthLabel = computed(() => (source.value === 'google' ? 'Google' : 'Microsoft'))
const rules = computed(() => (imap.value?.rules ?? []) as any[])

const sources = computed(() => [
  { key: 'mailer', icon: 'i-lucide-send', label: 'Loussa Mail', help: t('manage.wizard.srcMailer'), badge: mailerOn.value ? '' : t('manage.wizard.toConfigure'), badgeColor: 'warning' as const },
  { key: 'google', icon: 'i-simple-icons-google', label: 'Google', help: t('manage.wizard.srcGoogle'), badge: boxes.value?.oauth.google.configured ? '' : t('manage.wizard.toConfigure'), badgeColor: 'warning' as const },
  { key: 'microsoft', icon: 'i-simple-icons-microsoft', label: 'Microsoft', help: t('manage.wizard.srcMs'), badge: boxes.value?.oauth.microsoft.configured ? '' : t('manage.wizard.toConfigure'), badgeColor: 'warning' as const },
  { key: 'local', icon: 'i-lucide-server', label: t('manage.wizard.srcLocal'), help: t('manage.wizard.srcLocalHelp'), badge: '', badgeColor: 'neutral' as const },
] as const)
const mailerKindItems = computed(() => [{ label: t('manage.wizard.kindShared'), value: 'shared' }, { label: t('manage.wizard.kindPersonal'), value: 'personal' }])
const sourceLabel = computed(() => source.value === 'mailer' ? (mailerKind.value === 'shared' ? t('manage.wizard.labelShared') : t('manage.wizard.labelPersonal')) : sources.value.find(s => s.key === source.value)?.label ?? '')
const summaryEmail = computed(() => source.value === 'mailer' && mailerKind.value === 'shared' ? mailer.value?.shared?.find((m: any) => m.id === mailerId.value)?.email : srv.user)

const providerItems = computed(() => (imap.value?.providers ?? []).map((p: any) => ({ label: p.label, value: p.key })))
const provider = computed<any>(() => imap.value?.providers.find((p: any) => p.key === srv.provider))
const hostLocked = computed(() => !!provider.value && provider.value.key !== 'custom' && !provider.value.hostPattern)
const locked = computed(() => !!provider.value && provider.value.key !== 'custom')
function onProvider() {
  const p = provider.value
  if (p && p.key !== 'custom') Object.assign(srv, { host: p.host, port: p.port, secure: p.secure })
  if (p?.smtp) Object.assign(srv, { smtpHost: p.smtp.sameAsImap ? srv.host : p.smtp.host, smtpPort: p.smtp.port, smtpSecure: p.smtp.secure })
}
async function detect() {
  if (!srv.user.includes('@')) return
  busy.value = 'detect'; error.value = ''
  try {
    detected.value = await $fetch('/api/imap/detect', { method: 'POST', body: { email: srv.user } })
    if (detected.value.ok && detected.value.provider) { srv.provider = detected.value.provider; onProvider() }
  } catch (e) { fail(e) }
  busy.value = null
}

function pick(k: typeof source.value) { source.value = k; error.value = '' }
const canNext = computed(() => {
  if (busy.value) return false
  if (step.value === 0) return !!source.value && (source.value !== 'mailer' || mailerOn.value)
  if (step.value === 1) {
    if (source.value === 'local') return srv.user.includes('@') && !!srv.host && !!srv.smtpHost && !!password.value
    if (source.value === 'mailer') return !!mailer.value?.ok && (mailerKind.value === 'shared' ? !!mailerId.value : !!mailer.value.personal && srv.user.includes('@'))
    return !!savedId.value // Google / Microsoft : apres le retour OAuth
  }
  return true
})
const fail = (e: any) => { error.value = e?.data?.statusMessage || e?.statusMessage || t('manage.wizard.failed') }

async function next() {
  error.value = ''
  if (step.value === 0 && source.value === 'mailer') loadMailer()
  // Mailer : la boite est rattachee (partagee) ou creee (perso) dans Mailer avant le test, qui passe par Mailer
  if (step.value === 1 && source.value === 'mailer' && !savedId.value) { busy.value = 'next'; const ok = await save(); busy.value = null; if (!ok) return }
  step.value++
}
function back() { error.value = ''; step.value-- }
async function loadMailer() {
  mailerLoading.value = true
  try { mailer.value = await $fetch('/api/mailer/mailboxes') } catch (e) { fail(e) }
  mailerLoading.value = false
}
function startOAuth() { window.location.href = `/api/mail/oauth/${source.value}/start${srv.user.includes('@') ? `?email=${encodeURIComponent(srv.user)}` : ''}` }

async function runTest() {
  busy.value = 'test'; error.value = ''; test.value = null
  try {
    test.value = savedId.value
      ? await $fetch(`/api/mailboxes/${savedId.value}/test`, { method: 'POST' })
      : await $fetch('/api/mailboxes/test', { method: 'POST', body: { ...srv, password: password.value } })
  } catch (e) { fail(e) }
  busy.value = null
}
const presets = [
  { name: 'Airbnb', source: 'airbnb', sender: 'airbnb.com', category: 'frais_plateformes' },
  { name: 'Booking.com', source: 'booking', sender: 'booking.com', category: 'frais_plateformes' },
  { name: 'Lodgify', source: 'lodgify', sender: 'lodgify.com', category: 'abonnements' },
]
async function addPreset(p: typeof presets[number]) {
  error.value = ''
  try { await $fetch('/api/imap/rules', { method: 'POST', body: { name: `Factures ${p.name}`, source: p.source, sender: p.sender, subject: '', category: p.category, logementId: 0, enabled: true } }); await refreshImap() } catch (e) { fail(e) }
}
async function save() {
  busy.value = busy.value || 'save'; error.value = ''
  try {
    const body = source.value === 'local' ? { source: 'local', ...srv, password: password.value }
      : mailerKind.value === 'shared' ? { source: 'mailer-shared', mailerId: mailerId.value } : { source: 'mailer-personal', email: srv.user, password: password.value || undefined }
    const r = await $fetch<{ id: number }>('/api/mailboxes', { method: 'POST', body })
    savedId.value = r.id; password.value = ''
    await refreshBoxes(); emit('saved')
    return true
  } catch (e) { fail(e); return false } finally { if (busy.value === 'save') busy.value = null }
}
async function toggleEnabled(v: boolean) {
  error.value = ''
  try { await $fetch(`/api/mailboxes/${savedId.value}`, { method: 'PUT', body: { enabled: v } }); enabled.value = v; emit('saved') } catch (e) { fail(e) }
}
function reset() {
  Object.assign(srv, { provider: 'custom', host: '', port: 993, secure: true, smtpHost: '', smtpPort: 465, smtpSecure: true, user: '' })
  step.value = 0; source.value = ''; mailerId.value = ''; password.value = ''; test.value = null; detected.value = null; savedId.value = null; enabled.value = false; error.value = ''
}
// Ouverture : repart de zero, sauf retour OAuth (boite deja creee : on reprend a l'etape Test)
watch(open, (v) => {
  if (!v) return
  reset()
  const r = props.resume
  if (r && (r.provider === 'google' || r.provider === 'microsoft')) {
    source.value = r.provider
    if (r.id) { savedId.value = r.id; srv.user = boxes.value?.mailboxes.find((m: any) => m.id === r.id)?.email ?? ''; step.value = 2 } else { step.value = 1; error.value = r.error || '' }
  }
}, { immediate: true })
</script>
