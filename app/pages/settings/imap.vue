<template>
  <div v-if="data" class="space-y-3">
    <BrickHint brick="pms" description="Les e-mails voyageurs passent par Rocket Mailer via Rocket PMS ; cette boîte locale reste utilisée pour l'e-mail de gestion." />
    <h2 class="section-title !mt-0">E-mail (IMAP)</h2>
    <p class="text-sm text-muted">
      L'appli lit ta boîte en <b>lecture seule</b> (aucun message n'est marqué lu, déplacé ni supprimé) et n'ouvre que les e-mails dont l'expéditeur correspond à une règle ci-dessous.
      Leurs pièces jointes (factures PDF…) sont classées dans les Documents, sans doublon.
    </p>

    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <USwitch v-model="cfg.enabled" :label="cfg.enabled ? 'Relevé automatique activé' : 'Relevé automatique désactivé'" @update:model-value="saveConfig" />
        <div class="flex gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-plug-zap" label="Tester la connexion" :loading="busy === 'test'" :disabled="!data.passwordSet" @click="test" />
          <UButton icon="i-lucide-mail-search" label="Relever maintenant" :loading="busy === 'run'" :disabled="!data.passwordSet || !data.rules.length" @click="run" />
        </div>
      </div>
      <p v-if="!data.passwordSet" class="mt-3 text-sm text-warning">
        ⚠ Mot de passe manquant. Ajoute-le toi-même dans le fichier <code>.env</code> (ligne <code>IMAP_PASSWORD=…</code>) puis redémarre l'appli :
        il n'est jamais saisi ni affiché ici, ni stocké en base.
      </p>
      <p v-else class="mt-3 text-sm text-success">✓ Mot de passe défini dans <code>.env</code>.</p>
      <p class="mt-1 text-sm text-muted">
        Dernier relevé : {{ data.config.lastRunAt ? when(data.config.lastRunAt) : 'jamais' }}<template v-if="data.config.lastResult"> — {{ data.config.lastResult }}</template>
      </p>
      <div v-if="result" class="mt-3 rounded-md border border-default p-3 text-sm">
        <p v-if="!result.ok" class="text-error">✗ {{ result.error || result.message }}</p>
        <template v-else-if="result.rules">
          <p class="text-success">✓ Connexion réussie — {{ result.folders?.length }} dossier(s), « {{ cfg.folder }} » trouvé.</p>
          <p v-for="r in result.rules" :key="r.id" class="text-muted">Règle « {{ r.name }} » : {{ r.matches }} e-mail(s) sur les {{ cfg.sinceDays }} derniers jours</p>
          <p v-if="!result.rules.length" class="text-muted">Aucune règle active à tester.</p>
        </template>
        <p v-else class="text-success">✓ {{ result.message }}</p>
      </div>
    </UCard>

    <h3 class="section-title">Connexion</h3>
    <UCard>
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="saveConfig">
        <UFormField label="Identifiant (adresse e-mail)" class="sm:col-span-2">
          <div class="flex gap-2">
            <UInput v-model="cfg.user" placeholder="toi@exemple.fr" class="flex-1" />
            <UButton color="neutral" variant="outline" icon="i-lucide-search" label="Détecter le service" :loading="busy === 'detect'" :disabled="!cfg.user.includes('@')" @click="detect" />
          </div>
        </UFormField>
        <p v-if="detected" class="text-sm sm:col-span-2" :class="detected.ok && detected.provider ? 'text-success' : 'text-warning'">
          <template v-if="!detected.ok">{{ detected.message }}</template>
          <template v-else-if="detected.provider">
            ✓ Le domaine <b>{{ detected.domain }}</b> est géré par <b>{{ detected.label }}</b> (serveur de courrier : {{ detected.mx.slice(0, 2).join(', ') }}) — service sélectionné.
            <template v-if="detected.hostResolves === false"> Le serveur {{ detected.host }} ne répond pas au DNS depuis ici.</template>
          </template>
          <template v-else>Domaine <b>{{ detected.domain }}</b> : service non reconnu (serveur de courrier : {{ detected.mx.slice(0, 2).join(', ') }}). Choisis-le dans la liste, ou « Autre serveur ».</template>
        </p>
        <UFormField label="Service de messagerie" class="sm:col-span-2">
          <USelect v-model="cfg.provider" :items="providerItems" class="w-full" @update:model-value="onProvider" />
        </UFormField>
        <p v-if="provider?.note" class="text-sm text-muted sm:col-span-2">{{ provider.note }}</p>
        <UFormField label="Serveur IMAP"><UInput v-model="cfg.host" :disabled="hostLocked" placeholder="imap.exemple.fr" class="w-full" /></UFormField>
        <UFormField label="Port"><UInput v-model.number="cfg.port" type="number" :disabled="portLocked" class="w-full" /></UFormField>
        <USwitch v-model="cfg.secure" :disabled="portLocked" class="sm:col-span-2" label="TLS direct (port 993) — désactivé : STARTTLS obligatoire, jamais de mot de passe en clair" />
        <UFormField label="Dossier"><UInput v-model="cfg.folder" placeholder="INBOX" class="w-full" /></UFormField>
        <UFormField label="Relever toutes les (minutes)"><UInput v-model.number="cfg.intervalMin" type="number" min="5" max="1440" class="w-full" /></UFormField>
        <UFormField label="Historique (jours)"><UInput v-model.number="cfg.sinceDays" type="number" min="1" max="365" class="w-full" /></UFormField>
        <UButton type="submit" class="sm:col-span-2" label="Enregistrer la connexion" :loading="busy === 'save'" block />
      </form>
    </UCard>

    <h3 class="section-title">Envoi (SMTP)</h3>
    <UCard>
      <p class="mb-3 text-sm text-muted">
        Sert au bouton « Nouveau message » de l'écran E-mails. Même adresse et même mot de passe que la lecture (<code>IMAP_PASSWORD</code> dans <code>.env</code>).
        Chaque message part seulement quand tu cliques sur « Envoyer », et une copie est rangée dans « Envoyés ».
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Serveur d'envoi (SMTP)"><UInput v-model="cfg.smtpHost" :disabled="portLocked" class="w-full" /></UFormField>
        <UFormField label="Port"><UInput v-model.number="cfg.smtpPort" type="number" :disabled="portLocked" class="w-full" /></UFormField>
        <USwitch v-model="cfg.smtpSecure" :disabled="portLocked" class="sm:col-span-2" label="TLS direct (port 465) — désactivé : STARTTLS obligatoire (port 587)" />
        <UFormField label="Nom affiché à l'envoi" class="sm:col-span-2"><UInput v-model="cfg.fromName" placeholder="Ex. Prénom Nom" class="w-full" /></UFormField>
        <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
          <UButton :loading="busy === 'save'" label="Enregistrer l'envoi" @click="saveConfig" />
          <UButton color="neutral" variant="outline" icon="i-lucide-plug-zap" label="Tester l'envoi (sans envoyer de message)" :loading="busy === 'smtp'" :disabled="!data.passwordSet" @click="testSmtp" />
        </div>
      </div>
      <p v-if="smtpResult" class="mt-2 text-sm" :class="smtpResult.ok ? 'text-success' : 'text-error'">
        {{ smtpResult.ok ? `✓ Connexion et identification réussies sur ${smtpResult.host}:${smtpResult.port}. Aucun message envoyé.` : `✗ ${smtpResult.error}` }}
      </p>
    </UCard>

    <h3 class="section-title">Interface e-mail</h3>
    <UCard>
      <p class="mb-3 text-sm text-muted">
        L'écran <NuxtLink to="/mail" class="underline">E-mails</NuxtLink> affiche tes messages, rattachés automatiquement aux réservations et aux contacts. Seuls les en-têtes et un aperçu de 300 caractères sont gardés
        dans l'appli ; le corps et les pièces jointes sont lus dans ta boîte quand tu ouvres un message.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <USwitch v-model="cfg.syncMail" :label="cfg.syncMail ? 'Synchronisation automatique activée' : 'Synchronisation automatique désactivée'" @update:model-value="saveConfig" />
        <UFormField label="Historique (jours)"><UInput v-model.number="cfg.mailDays" type="number" min="1" max="365" class="w-28" @change="saveConfig" /></UFormField>
        <UButton color="error" variant="ghost" icon="i-lucide-trash-2" label="Vider le cache e-mails" @click="clearMailCache" />
      </div>
      <p class="mt-2 text-sm text-muted">Dernière synchronisation : {{ data.config.mailSyncedAt ? when(data.config.mailSyncedAt) : 'jamais' }}<template v-if="data.config.mailResult"> — {{ data.config.mailResult }}</template></p>
    </UCard>

    <h3 class="section-title">Règles : quels e-mails, et où ranger leurs pièces jointes</h3>
    <UCard v-for="r in data.rules" :key="r.id">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0 text-sm">
          <p class="font-medium">{{ r.name }} <UBadge color="neutral" variant="outline" size="sm" :label="r.source" /></p>
          <p class="text-muted">Expéditeur contient « {{ r.sender }} »<template v-if="r.subject"> · objet contient « {{ r.subject }} »</template></p>
          <p class="text-muted">→ {{ categoryLabel(r.category) }} · {{ r.logementId ? logementName(r.logementId) : 'à classer' }}</p>
        </div>
        <div class="flex items-center gap-1">
          <USwitch :model-value="r.enabled" @update:model-value="toggle(r, $event)" />
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" label="Modifier" @click="edit(r)" />
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeRule(r)" />
        </div>
      </div>
    </UCard>
    <UCard v-if="!data.rules.length"><p class="text-sm text-muted">Aucune règle : ajoute-en une ci-dessous, par exemple pour les factures d'une plateforme.</p></UCard>

    <UCard>
      <p class="mb-2 text-sm font-medium">{{ rule.id ? 'Modifier la règle' : 'Nouvelle règle' }}</p>
      <div class="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted">
        Modèles :
        <UButton v-for="p in presets" :key="p.name" size="xs" color="neutral" variant="soft" :label="p.name" @click="preset(p)" />
        <span class="text-xs">(à vérifier avec l'adresse réelle de tes e-mails)</span>
      </div>
      <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="saveRule">
        <UInput v-model="rule.name" placeholder="Nom (ex. Factures Airbnb)" />
        <UInput v-model="rule.source" placeholder="Source (ex. airbnb)" />
        <UInput v-model="rule.sender" placeholder="Expéditeur contient (ex. airbnb.com)" />
        <UInput v-model="rule.subject" placeholder="Objet contient (facultatif)" />
        <USelect v-model="rule.category" :items="categoryItems" />
        <USelect v-model="rule.logementId" :items="logementItems" />
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" :label="rule.id ? 'Enregistrer la règle' : 'Ajouter la règle'" :loading="busy === 'rule'" />
          <UButton v-if="rule.id" color="neutral" variant="ghost" label="Annuler" @click="resetRule" />
        </div>
      </form>
      <p class="mt-2 text-xs text-muted">Les factures d'un compte plateforme concernent souvent tous tes logements : laisse « À classer » et affecte-les ensuite dans Imports.</p>
    </UCard>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const { data, refresh } = await useFetch('/api/imap')
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
const logementItems = computed(() => [{ label: 'À classer (choisir plus tard)', value: 0 }, ...(data.value?.logements ?? []).map(l => ({ label: l.name, value: l.id }))])
const categoryItems = computed(() => {
  const groups: Record<string, string> = { charge: 'Charges', recette: 'Recettes', doc: 'Justificatifs' }
  return Object.entries(groups).map(([kind, label]) => [
    { type: 'label' as const, label },
    ...(data.value?.categories ?? []).filter(c => c.kind === kind).map(c => ({ label: c.label, value: c.key })),
  ])
})
const categoryLabel = (k: string) => data.value?.categories.find(c => c.key === k)?.label ?? k
const logementName = (id: number) => data.value?.logements.find(l => l.id === id)?.name ?? `Logement ${id}`
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fail = (e: any) => { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }

async function saveConfig() {
  busy.value = 'save'; error.value = ''
  try { await $fetch('/api/imap/config', { method: 'PUT', body: { provider: cfg.provider, enabled: cfg.enabled, host: cfg.host, port: cfg.port, secure: cfg.secure, user: cfg.user, folder: cfg.folder, intervalMin: cfg.intervalMin, sinceDays: cfg.sinceDays, syncMail: cfg.syncMail, mailDays: cfg.mailDays, smtpHost: cfg.smtpHost, smtpPort: cfg.smtpPort, smtpSecure: cfg.smtpSecure, fromName: cfg.fromName } }); await refresh() }
  catch (e) { fail(e) }
  busy.value = null
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
  if (!confirm('Vider le cache des e-mails ? Ta boîte n\'est pas touchée ; tu pourras resynchroniser.')) return
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
  if (!confirm(`Supprimer la règle « ${r.name} » ? (les documents déjà importés restent)`)) return
  error.value = ''
  try { await $fetch(`/api/imap/rules/${r.id}`, { method: 'DELETE' }); await refresh() } catch (e) { fail(e) }
}
</script>
