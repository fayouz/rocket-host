<template>
  <div v-if="data" class="space-y-4">
    <h2 class="section-title !mt-0">Connexions & intégrations</h2>
    <p class="text-sm text-muted">
      Adresses et jetons des briques Rocket et des services branchés. Les secrets sont chiffrés en base (AES-256-GCM) et ne sont jamais réaffichés :
      seuls leurs 4 derniers caractères apparaissent. Détails : docs/secrets.md.
    </p>
    <UAlert v-if="!data.keyPresent" color="error" variant="subtle" icon="i-lucide-key-round" title="Clé de chiffrement absente"
      description="ROCKET_SECRETS_KEY n'est pas définie dans l'environnement du serveur : les secrets ne peuvent pas être enregistrés." />
    <UAlert v-if="envCount" color="warning" variant="subtle" icon="i-lucide-file-warning" :title="`${envCount} valeur(s) encore lue(s) dans .env`"
      description="Lance « npm run secrets:import-env » sur le serveur pour les importer en base, puis retire-les de .env." />
    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" />

    <!-- Briques Rocket : applis / middlewares de la suite, branchees par adresse + jeton d'application -->
    <template v-if="tab === 'briques'">
      <p class="text-sm text-muted">Applications de la suite Rocket. Rocket Cloud passe par Rocket PMS ; Rocket Mailer peut aussi être branché en direct pour les boîtes e-mail (partagées et perso) ; Rocket Auth (connexion unique) se règle dans l'environnement du serveur.</p>
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
                  <UButton size="sm" color="neutral" variant="outline" label="Enregistrer" :disabled="form[e.name] === (e as any).value" @click="save({ settings: { [e.name]: form[e.name] ?? '' } })" />
                </div>
              </UFormField>
            </template>
            <p v-if="g.key === 'mail'" class="text-xs text-muted"><NuxtLink to="/settings/imap" class="underline">Serveur, identifiant et règles de la boîte</NuxtLink></p>
            <UButton v-if="g.key === 'mailer'" size="xs" icon="i-lucide-plus" label="Ajouter une boîte e-mail" to="/settings/imap?assistant=1" />
            <p v-if="g.key === 'homey'" class="text-xs text-muted">Adresse du Homey et mode (local/cloud) : réglages du logement › <NuxtLink :to="domotiqueLink" class="underline">Domotique</NuxtLink>.</p>
          </div>
        </UCard>
        <UCard>
          <template #header>
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold">Rocket Mailer · Rocket Cloud · Rocket Auth</h3>
                <p class="text-xs text-muted">Mailer (envois d'e-mails) et Cloud (fichiers) sont joints à travers Rocket PMS : rien à saisir ici. Rocket Auth : variables ROCKET_AUTH_… du serveur.</p>
              </div>
              <UBadge size="sm" variant="subtle" :color="brickStatus('pms').color" :label="pmsOn ? 'via PMS' : 'local'" />
            </div>
          </template>
          <p class="text-sm text-muted">Sans Rocket PMS, les e-mails partent par la boîte IMAP/SMTP et les fichiers restent dans Rocket Host.</p>
        </UCard>
      </div>
    </template>

    <!-- Connexions directes : services tiers utilises directement par Host (et catalogue des plugins/connecteurs) -->
    <template v-else>
      <p class="text-sm text-muted">Services tiers branchés directement sur Rocket Host : Lodgify, Nuki, Homey, boîte e-mail, webhook n8n et plugins / connecteurs par logement.</p>
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
                  <UButton size="sm" color="neutral" variant="outline" label="Enregistrer" :disabled="form[e.name] === (e as any).value" @click="save({ settings: { [e.name]: form[e.name] ?? '' } })" />
                </div>
              </UFormField>
            </template>
            <p v-if="g.key === 'mail'" class="text-xs text-muted"><NuxtLink to="/settings/imap" class="underline">Serveur, identifiant et règles de la boîte</NuxtLink></p>
            <p v-if="g.key === 'mailoauth'" class="text-xs text-muted">Adresses de retour à déclarer : <code>{{ origin }}/api/mail/oauth/google/callback</code> et <code>{{ origin }}/api/mail/oauth/microsoft/callback</code>.</p>
            <UButton v-if="g.key === 'mail' || g.key === 'mailoauth'" size="xs" icon="i-lucide-plus" label="Ajouter une boîte e-mail" to="/settings/imap?assistant=1" />
            <p v-if="g.key === 'homey'" class="text-xs text-muted">Adresse du Homey et mode (local/cloud) : réglages du logement › <NuxtLink :to="domotiqueLink" class="underline">Domotique</NuxtLink>.</p>
          </div>
        </UCard>
        <UCard>
          <template #header>
            <h3 class="font-semibold">Secrets des connecteurs</h3>
            <p class="text-xs text-muted">Jetons des connecteurs « Service web »… : le connecteur indique le nom (CONNECTOR_…), la valeur se saisit ici.</p>
          </template>
          <div class="space-y-3">
            <SecretField v-for="s in data.connectorSecrets" :key="s.name" :label="s.name" :status="s" @save="v => save({ secrets: { [s.name]: v } })" />
            <div class="flex flex-wrap gap-2">
              <UInput v-model="newName" placeholder="CONNECTOR_MON_SERVICE" class="w-60" />
              <UInput v-model="newValue" type="password" autocomplete="new-password" placeholder="Valeur" class="flex-1" />
              <UButton size="sm" icon="i-lucide-plus" label="Ajouter" :disabled="!/^CONNECTOR_[A-Z0-9_]{1,60}$/.test(newName) || !newValue.trim()" @click="addConnector" />
            </div>
          </div>
        </UCard>
      </div>
      <PluginsCatalog class="pt-4" />
    </template>
  </div>
</template>

<script setup lang="ts">
const { data, refresh } = await useFetch('/api/settings/connexions')
// Deux onglets : briques de la suite Rocket / services tiers en direct (?onglet=briques|directes)
const route = useRoute()
const tabs = [{ label: 'Briques Rocket', value: 'briques', icon: 'i-lucide-boxes' }, { label: 'Connexions directes', value: 'directes', icon: 'i-lucide-plug' }]
const tab = computed({
  get: () => (route.query.onglet === 'directes' ? 'directes' : 'briques'),
  set: v => navigateTo({ query: { ...route.query, onglet: v } }, { replace: true }),
})
const BRICKS = ['pms', 'mailer', 'place', 'clean', 'stock', 'cast']
const DIRECT = ['direct', 'homey', 'mail', 'mailoauth', 'webhook']
const groupsOf = (keys: string[]) => (data.value?.groups ?? []).filter(g => keys.includes(g.key)).sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key))
const { data: pms } = await useFetch('/api/pms/status', { key: 'pms-status' })
const pmsOn = computed(() => !!pms.value?.configured)
// Pastille d'etat : PMS d'apres /api/pms/status, les autres briques d'apres la presence de leur adresse
function brickStatus(key: string): { label: string; color: 'success' | 'error' | 'neutral' | 'info' } {
  if (key === 'pms') return !pmsOn.value ? { label: 'off', color: 'neutral' } : pms.value?.ok ? { label: 'connecté', color: 'success' } : { label: 'erreur', color: 'error' }
  const url = (data.value?.entries ?? []).find(e => e.name === `ROCKET_${key.toUpperCase()}_URL`) as any
  return url?.value ? { label: 'configuré', color: 'info' } : { label: 'off', color: 'neutral' }
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
  if (body.secrets && Object.values(body.secrets).includes(null) && !confirm('Effacer ce secret ? Le service concerné cessera de fonctionner.')) return
  try { await $fetch('/api/settings/connexions', { method: 'PUT', body }); await refresh() } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
}
async function addConnector() { await save({ secrets: { [newName.value]: newValue.value } }); newName.value = ''; newValue.value = '' }
</script>
