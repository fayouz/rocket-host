<template>
  <!-- Assistant « Ajouter une boîte e-mail » : ① Source ② Connexion ③ Test ④ Règles ⑤ Récapitulatif.
       Relevé désactivé à la création ; rien n'est envoyé automatiquement. Les mots de passe ne sont jamais réaffichés. -->
  <UModal v-model:open="open" title="Ajouter une boîte e-mail" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <ol class="mb-4 flex flex-wrap gap-1 text-xs">
        <li v-for="(s, i) in STEPS" :key="s" class="rounded-full px-2 py-0.5" :class="i === step ? 'bg-primary text-inverted' : i < step ? 'bg-elevated text-default' : 'text-muted'">{{ i + 1 }}. {{ s }}</li>
      </ol>

      <!-- ① Source -->
      <div v-if="step === 0" class="space-y-3">
        <p class="text-sm text-muted">D'où vient la boîte ?</p>
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
          <p class="mb-2 text-sm font-medium">Quel type de boîte Rocket Mailer ?</p>
          <URadioGroup v-model="mailerKind" :items="[{ label: 'Boîte partagée (dont tu es membre)', value: 'shared' }, { label: 'Boîte perso (créée pour toi dans Mailer)', value: 'personal' }]" />
        </div>
      </div>

      <!-- ② Connexion -->
      <div v-else-if="step === 1" class="space-y-3">
        <template v-if="source === 'local'">
          <UFormField label="Adresse e-mail (identifiant)">
            <div class="flex gap-2">
              <UInput v-model="srv.user" name="wizard-email" placeholder="toi@exemple.fr" autocomplete="off" class="flex-1" @change="detect" />
              <UButton color="neutral" variant="outline" icon="i-lucide-search" label="Détecter" :loading="busy === 'detect'" :disabled="!srv.user.includes('@')" @click="detect" />
            </div>
          </UFormField>
          <p v-if="detected" class="text-sm" :class="detected.ok && detected.provider ? 'text-success' : 'text-warning'">
            <template v-if="!detected.ok">{{ detected.message }}</template>
            <template v-else-if="detected.provider">✓ Service détecté : <b>{{ detected.label }}</b> — serveurs préremplis.</template>
            <template v-else>Service non reconnu : choisis-le ou « Autre serveur ».</template>
          </p>
          <UFormField label="Service de messagerie"><USelect v-model="srv.provider" :items="providerItems" class="w-full" @update:model-value="onProvider" /></UFormField>
          <p v-if="provider?.note" class="text-xs text-muted">{{ provider.note }}</p>
          <div class="grid gap-2 sm:grid-cols-3">
            <UFormField label="Serveur IMAP" class="sm:col-span-2"><UInput v-model="srv.host" :disabled="hostLocked" class="w-full" /></UFormField>
            <UFormField label="Port"><UInput v-model.number="srv.port" type="number" :disabled="locked" class="w-full" /></UFormField>
            <UFormField label="Serveur SMTP" class="sm:col-span-2"><UInput v-model="srv.smtpHost" :disabled="locked" class="w-full" /></UFormField>
            <UFormField label="Port"><UInput v-model.number="srv.smtpPort" type="number" :disabled="locked" class="w-full" /></UFormField>
          </div>
          <UFormField label="Mot de passe de la boîte" help="Sert au test puis est enregistré chiffré en base à la fin ; jamais réaffiché.">
            <UInput v-model="password" name="wizard-password" type="password" autocomplete="new-password" class="w-full" />
          </UFormField>
        </template>

        <template v-else-if="source === 'google' || source === 'microsoft'">
          <p class="text-sm text-muted">Rocket Host lit et envoie avec ce compte en IMAP / SMTP sécurisés (XOAUTH2), sans mot de passe : seul un jeton de renouvellement est gardé, chiffré.</p>
          <UFormField label="Adresse (facultatif, pour présélectionner le compte)"><UInput v-model="srv.user" placeholder="toi@gmail.com" class="w-full" /></UFormField>
          <UButton :icon="source === 'google' ? 'i-simple-icons-google' : 'i-simple-icons-microsoft'" :label="`Se connecter avec ${oauthLabel}`" :disabled="!oauthOk" data-oauth-button @click="startOAuth" />
          <UAlert v-if="!oauthOk" color="warning" variant="subtle" icon="i-lucide-settings" :title="`Connexion ${oauthLabel} à configurer`">
            <template #description>
              Renseigne l'application OAuth ({{ source === 'google' ? 'GOOGLE_MAIL_CLIENT_ID / _SECRET' : 'MICROSOFT_MAIL_CLIENT_ID / _SECRET' }}) dans
              <NuxtLink to="/settings/connexions?onglet=directes" class="underline">Connexions › Connexions directes</NuxtLink>,
              adresse de retour <code>{{ origin }}/api/mail/oauth/{{ source }}/callback</code>.
              <template v-if="mailerOn"> Ou choisis la source Rocket Mailer, qui gère aussi la connexion {{ oauthLabel }}.</template>
            </template>
          </UAlert>
        </template>

        <template v-else-if="source === 'mailer'">
          <p v-if="mailerLoading" class="text-sm text-muted">Interrogation de Rocket Mailer…</p>
          <UAlert v-else-if="!mailer?.ok" color="warning" variant="subtle" icon="i-lucide-mail-warning" title="Rocket Mailer indisponible" :description="mailer?.message || 'Réessaie plus tard.'" />
          <template v-else-if="mailerKind === 'shared'">
            <p class="text-sm text-muted">Boîtes partagées de Rocket Mailer dont <b>{{ mailer.userEmail }}</b> est membre :</p>
            <URadioGroup v-if="mailer.shared.length" v-model="mailerId" :items="mailer.shared.map((m: any) => ({ label: `${m.name} — ${m.email}`, value: m.id }))" />
            <p v-else class="text-sm text-muted">Aucune boîte partagée : demande à un administrateur de Rocket Mailer de t'y ajouter.</p>
          </template>
          <template v-else>
            <UAlert v-if="!mailer.personal" color="info" variant="subtle" icon="i-lucide-clock" title="Bientôt"
              description="Ce Rocket Mailer ne gère pas encore les boîtes perso. Tu peux en attendant ajouter la boîte en Locale, Google ou Microsoft." />
            <template v-else>
              <UFormField label="Adresse de ta boîte perso"><UInput v-model="srv.user" :placeholder="mailer.userEmail" class="w-full" /></UFormField>
              <UFormField label="Mot de passe (transmis à Rocket Mailer, qui le chiffre ; non gardé par Host)"><UInput v-model="password" type="password" autocomplete="new-password" class="w-full" /></UFormField>
            </template>
          </template>
        </template>
      </div>

      <!-- ③ Test -->
      <div v-else-if="step === 2" class="space-y-3">
        <p class="text-sm text-muted">Connexion au serveur de réception et identification au serveur d'envoi. Aucun message n'est lu ni envoyé.</p>
        <UButton icon="i-lucide-plug-zap" label="Lancer le test" :loading="busy === 'test'" data-wizard-test @click="runTest" />
        <div v-if="test" class="space-y-1 rounded-md border border-default p-3 text-sm" data-wizard-result>
          <template v-if="test.imap || test.smtp">
            <p :class="test.imap?.ok ? 'text-success' : 'text-error'">{{ test.imap?.ok ? `✓ Réception (IMAP) : connexion réussie, ${test.imap.folders} dossier(s)` : `✗ ${test.imap?.error}` }}</p>
            <p :class="test.smtp?.ok ? 'text-success' : 'text-error'">{{ test.smtp?.ok ? '✓ Envoi (SMTP) : identification réussie' : `✗ ${test.smtp?.error}` }}</p>
          </template>
          <p v-else :class="test.ok ? 'text-success' : 'text-error'">{{ test.ok ? '✓' : '✗' }} {{ test.message }}</p>
        </div>
        <p v-if="test && !test.ok" class="text-xs text-muted">Corrige la connexion (étape précédente) puis relance le test. Tu peux aussi continuer et corriger plus tard.</p>
      </div>

      <!-- ④ Règles -->
      <div v-else-if="step === 3" class="space-y-3">
        <template v-if="source === 'mailer'">
          <p class="text-sm text-muted">Les boîtes Rocket Mailer sont relevées et triées dans Rocket Mailer : pas de règle à régler ici.</p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">Quels e-mails ouvrir, et où ranger leurs pièces jointes (règles « expéditeur → catégorie / logement »). Les règles détaillées se modifient plus bas sur la page.</p>
          <ul class="space-y-1 text-sm">
            <li v-for="r in rules" :key="r.id" class="flex items-center gap-2"><UIcon name="i-lucide-filter" class="size-4 text-muted" />{{ r.name }} <span class="text-muted">(expéditeur contient « {{ r.sender }} »)</span></li>
            <li v-if="!rules.length" class="text-muted">Aucune règle pour l'instant.</li>
          </ul>
          <div class="flex flex-wrap items-center gap-1 text-sm">
            Ajouter un modèle :
            <UButton v-for="p in presets" :key="p.name" size="xs" color="neutral" variant="soft" :label="p.name" :disabled="rules.some((r: any) => r.sender === p.sender)" @click="addPreset(p)" />
          </div>
        </template>
      </div>

      <!-- ⑤ Récapitulatif -->
      <div v-else class="space-y-3 text-sm">
        <dl class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
          <dt class="text-muted">Source</dt><dd>{{ sourceLabel }}</dd>
          <dt class="text-muted">Adresse</dt><dd>{{ summaryEmail || '—' }}</dd>
          <template v-if="source === 'local'"><dt class="text-muted">Serveurs</dt><dd>{{ srv.host }}:{{ srv.port }} · {{ srv.smtpHost }}:{{ srv.smtpPort }}</dd></template>
          <dt class="text-muted">Test</dt><dd>{{ test ? (test.ok ? 'réussi' : 'en échec') : 'non lancé' }}</dd>
          <dt class="text-muted">Relevé</dt><dd>{{ enabled ? 'activé' : 'désactivé (par défaut)' }}</dd>
        </dl>
        <p class="text-muted">Rien n'est lu tant que le relevé n'est pas activé, et rien n'est jamais envoyé automatiquement : chaque envoi part d'un clic sur « Envoyer ».</p>
        <UButton v-if="!savedId" icon="i-lucide-check" label="Enregistrer la boîte" :loading="busy === 'save'" @click="save" />
        <template v-else>
          <p class="text-success">✓ Boîte enregistrée.</p>
          <USwitch v-if="source !== 'mailer'" :model-value="enabled" :label="enabled ? 'Relevé activé' : 'Activer le relevé'" @update:model-value="toggleEnabled" />
        </template>
      </div>

      <p v-if="error" class="mt-3 text-sm text-error" data-wizard-error>{{ error }}</p>
    </template>

    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton color="neutral" variant="ghost" :label="step ? 'Retour' : 'Annuler'" :disabled="!!savedId && step === 4" @click="step ? back() : (open = false)" />
        <UButton v-if="step < 4" label="Suivant" trailing-icon="i-lucide-arrow-right" :disabled="!canNext" :loading="busy === 'next'" data-wizard-next @click="next" />
        <UButton v-else color="neutral" label="Fermer" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ resume?: { provider: string; id?: number; error?: string } | null }>()
const emit = defineEmits<{ saved: [] }>()

const STEPS = ['Source', 'Connexion', 'Test', 'Règles', 'Récapitulatif']
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
  { key: 'mailer', icon: 'i-lucide-send', label: 'Rocket Mailer', help: 'Boîte partagée de l\'équipe, ou ta boîte perso gérée par Mailer.', badge: mailerOn.value ? '' : 'à configurer', badgeColor: 'warning' as const },
  { key: 'google', icon: 'i-simple-icons-google', label: 'Google', help: 'Gmail / Google Workspace, connexion sans mot de passe (OAuth).', badge: boxes.value?.oauth.google.configured ? '' : 'à configurer', badgeColor: 'warning' as const },
  { key: 'microsoft', icon: 'i-simple-icons-microsoft', label: 'Microsoft', help: 'Outlook / Microsoft 365, connexion sans mot de passe (OAuth).', badge: boxes.value?.oauth.microsoft.configured ? '' : 'à configurer', badgeColor: 'warning' as const },
  { key: 'local', icon: 'i-lucide-server', label: 'Locale (IMAP/SMTP)', help: 'N\'importe quel service : serveur détecté depuis l\'adresse, mot de passe chiffré.', badge: '', badgeColor: 'neutral' as const },
] as const)
const sourceLabel = computed(() => source.value === 'mailer' ? `Rocket Mailer — boîte ${mailerKind.value === 'shared' ? 'partagée' : 'perso'}` : sources.value.find(s => s.key === source.value)?.label ?? '')
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
const fail = (e: any) => { error.value = e?.data?.statusMessage || e?.statusMessage || 'Échec, réessaie.' }

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
