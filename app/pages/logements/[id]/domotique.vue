<template>
  <div v-if="data" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">Domotique</h2>
      <UBadge :color="status.color" variant="subtle" :label="status.label" />
    </div>

    <UAlert v-if="oauthMsg" :color="oauthMsg.color" variant="subtle" :title="oauthMsg.text" />
    <UTabs v-model="tab" :items="tabs" :content="false" />

    <!-- ONGLET APPAREILS -->
    <template v-if="tab === 'appareils'">
      <UCard>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium">Appareils vus par Homey<span v-if="homeyName" class="font-normal text-muted"> · {{ homeyName }}</span></p>
            <p class="text-sm text-muted">
              <template v-if="devices">{{ devices.length }} appareil{{ devices.length > 1 ? 's' : '' }} · {{ online }} en ligne<template v-if="offline"> · {{ offline }} hors ligne</template> · lu à {{ hour(testedAt) }}</template>
              <template v-else>Lecture seule : la découverte ne commande ni ne modifie rien.</template>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UInput v-if="devices" v-model="search" size="sm" icon="i-lucide-search" placeholder="Filtrer" class="w-40" />
            <UButton icon="i-lucide-radar" :label="devices ? 'Relancer la découverte' : 'Lancer la découverte'" :loading="discovering" :disabled="testDisabled" @click="discover" />
          </div>
        </div>
        <p v-if="testError" class="mt-2 text-sm text-error">{{ testError }}</p>
      </UCard>

      <UCard v-if="!devices && !testError">
        <div class="flex flex-col items-center gap-2 py-6 text-center">
          <UIcon name="i-lucide-cpu" class="size-10 text-muted" />
          <template v-if="testDisabled">
            <p class="font-medium">Connexion à configurer</p>
            <p class="max-w-md text-sm text-muted">Connecte d'abord ton Homey (onglet Réglages) pour pouvoir découvrir les appareils de ce logement, y compris ceux du hub Aqara.</p>
            <UButton color="neutral" variant="outline" icon="i-lucide-settings" label="Ouvrir les réglages" @click="tab = 'reglages'" />
          </template>
          <template v-else>
            <p class="font-medium">Aucun appareil chargé</p>
            <p class="max-w-md text-sm text-muted">Clique sur « Lancer la découverte » pour lister les appareils (chauffage, capteurs, prises, scènes…) avec leur état actuel. Ensuite tu choisiras ceux qui appartiennent à ce logement.</p>
          </template>
        </div>
      </UCard>

      <template v-if="devices">
        <UCard v-if="!devices.length"><p class="text-sm text-muted">Connexion réussie, mais Homey ne voit aucun appareil avec ces droits d'accès.</p></UCard>
        <p v-else-if="!groups.length" class="px-1 text-sm text-muted">Aucun appareil ne correspond à « {{ search }} ».</p>
        <section v-for="g in groups" :key="g.cls" class="space-y-2">
          <h3 class="flex items-center gap-2 px-1 text-sm font-semibold text-muted">
            <UIcon :name="g.icon" class="size-4" /> {{ g.label }} <span class="font-normal">({{ g.items.length }})</span>
          </h3>
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <UCard v-for="d in g.items" :key="d.id" :ui="{ body: 'p-3 sm:p-3' }" :class="{ 'opacity-60': !d.available }">
              <div class="flex items-start justify-between gap-2">
                <p class="min-w-0 break-words font-medium leading-snug">{{ d.name }}</p>
                <UBadge :color="d.available ? 'success' : 'neutral'" variant="subtle" size="sm" :label="d.available ? 'En ligne' : 'Hors ligne'" />
              </div>
              <ul v-if="d.capabilities.length" class="mt-2 space-y-0.5 text-sm">
                <li v-for="c in d.capabilities.slice(0, 6)" :key="c.id" class="flex justify-between gap-2">
                  <span class="truncate text-muted">{{ c.title }}</span><b class="shrink-0">{{ show(c) }}</b>
                </li>
                <li v-if="d.capabilities.length > 6" class="text-xs text-muted">+ {{ d.capabilities.length - 6 }} autres propriétés</li>
              </ul>
            </UCard>
          </div>
        </section>
      </template>
    </template>

    <!-- ONGLET RÉGLAGES -->
    <template v-else>
      <UAlert color="info" variant="subtle" icon="i-lucide-shield-check" title="Phase de préparation"
              description="Rien n'est commandé chez Homey : les réglages sont enregistrés et la règle est seulement simulée sur les prochaines réservations." />

      <!-- Connexion -->
      <UCard>
        <template #header><b>Connexion Homey Pro</b></template>
        <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="save">
          <USelect v-model="form.homeyMode" :items="modeItems" />
          <UInput v-if="form.homeyMode === 'local'" v-model="form.homeyUrl" placeholder="Adresse de Homey (ex. http://192.168.1.20)" />
          <span v-else class="self-center text-sm text-muted">L'adresse est fournie par le cloud Homey.</span>
          <div v-if="form.homeyMode === 'cloud'" class="space-y-2 text-sm sm:col-span-2">
            <template v-if="!data.cloud.clientConfigured">
              <p class="text-muted"><b>1.</b> Ajoute <code>HOMEY_CLIENT_ID=…</code> et <code>HOMEY_CLIENT_SECRET=…</code> (ton application Homey) dans <code>.env</code>, puis redémarre. Ne les colle jamais dans le chat.</p>
              <p class="text-muted"><b>2.</b> Dans les outils développeur de Homey, déclare cette adresse de retour : <code class="select-all break-all">{{ data.cloud.redirectUri }}</code></p>
            </template>
            <template v-else-if="!data.cloud.connected">
              <p class="text-muted">Application détectée. L'adresse de retour déclarée chez Homey doit être exactement : <code class="select-all break-all">{{ data.cloud.redirectUri }}</code></p>
              <UButton icon="i-lucide-link" label="Connecter mon compte Homey" :to="connectUrl" external />
            </template>
            <template v-else>
              <p class="text-muted"><UIcon name="i-lucide-check" class="align-middle text-success" /> Compte Homey connecté le {{ new Date(data.cloud.connectedAt!).toLocaleDateString('fr-FR') }} (le jeton reste sur le serveur).</p>
              <div class="flex flex-wrap items-center gap-2">
                <UFormField label="Homey associé à ce logement" class="w-72">
                  <USelect v-model="form.homeyId" :items="homeyItems" placeholder="Choisir un Homey" class="w-full" />
                </UFormField>
                <span v-if="homeysError" class="text-error">{{ homeysError }}</span>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-unlink" label="Déconnecter le compte" @click="disconnect" />
              </div>
            </template>
          </div>
          <p v-else class="text-sm text-muted sm:col-span-2">
            <template v-if="data.keyPresent"><UIcon name="i-lucide-check" class="align-middle text-success" /> Clé d'API détectée dans <code>.env</code> (sa valeur n'est jamais affichée).</template>
            <template v-else>Clé d'API absente : crée-la dans Homey (Réglages → Clés d'API, droits minimaux : lire et commander les appareils), puis ajoute <code>HOMEY_API_KEY=…</code> dans <code>.env</code> et redémarre. Ne la colle jamais dans le chat.</template>
          </p>
          <p v-if="form.homeyMode === 'cloud' && data.cloud.connected && !form.homeyId" class="text-sm text-warning sm:col-span-2">Choisis le Homey de ce logement puis enregistre : sans association, aucun appareil n'est lu ni commandé.</p>
          <p v-if="error" class="text-sm text-error sm:col-span-2">{{ error }}</p>
          <div class="flex flex-wrap gap-2 sm:col-span-2">
            <UButton type="submit" label="Enregistrer" :loading="busy" />
            <UButton color="neutral" variant="outline" icon="i-lucide-plug-zap" label="Tester la connexion" :loading="testing" :disabled="testDisabled" @click="test" />
            <span v-if="pingOk" class="self-center text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> {{ pingOk }}</span>
            <span v-else class="self-center text-xs text-muted">Vérifie seulement l'accès : ne lit aucun appareil, ne commande rien. Enregistre d'abord les réglages.</span>
          </div>
          <p v-if="testError" class="text-sm text-error sm:col-span-2">{{ testError }}</p>
        </form>
      </UCard>

      <!-- Règle de préchauffage -->
      <UCard>
        <template #header><div class="flex items-center justify-between gap-2"><b>Préchauffage</b>
          <USwitch v-model="form.preheatEnabled" :label="form.preheatEnabled ? 'Règle activée (simulation)' : 'Règle désactivée'" @update:model-value="save" /></div></template>
        <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="save">
          <UFormField label="Heures avant l'arrivée"><UInput v-model="form.preheatHours" type="number" step="0.5" :min="data.limits.preheatHours[0]" :max="data.limits.preheatHours[1]" /></UFormField>
          <UFormField label="Minutes après le départ (retour en éco)"><UInput v-model="form.ecoDelayMin" type="number" step="15" :min="data.limits.ecoDelayMin[0]" :max="data.limits.ecoDelayMin[1]" /></UFormField>
          <UFormField :label="`Consigne confort (°C, ${data.limits.comfort[0]}–${data.limits.comfort[1]})`"><UInput v-model="form.comfortTemp" type="number" step="0.5" :min="data.limits.comfort[0]" :max="data.limits.comfort[1]" /></UFormField>
          <UFormField :label="`Consigne éco (°C, ${data.limits.eco[0]}–${data.limits.eco[1]})`"><UInput v-model="form.ecoTemp" type="number" step="0.5" :min="data.limits.eco[0]" :max="data.limits.eco[1]" /></UFormField>
          <UButton type="submit" class="sm:col-span-2" label="Enregistrer la règle" :loading="busy" />
        </form>
        <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
        <p v-if="saved" class="mt-2 text-sm text-success">Enregistré.</p>
      </UCard>

      <!-- Simulation -->
      <UCard>
        <template #header><b>Simulation — 60 prochains jours</b></template>
        <p v-if="!data.config.preheatEnabled" class="text-sm text-muted">Active la règle pour voir ce qu'elle ferait sur les réservations à venir. Horaires d'arrivée et de départ lus dans Lodgify (heure de Paris) ; pas de préchauffage sans réservation.</p>
        <p v-else-if="!data.actions.length" class="text-sm text-muted">Aucune action à prévoir : pas de réservation à venir sur ce logement.</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="a in data.actions" :key="a.at + a.kind + a.bookingId" class="flex items-start gap-3 py-2">
            <UIcon :name="icon(a.kind)" class="mt-0.5 size-5 shrink-0" :class="a.kind === 'comfort' ? 'text-orange-500' : a.kind === 'eco' ? 'text-sky-500' : 'text-muted'" />
            <div class="min-w-0 flex-1">
              <p class="text-sm"><b>{{ when(a.at) }}</b> — {{ a.kind === 'comfort' ? `Consigne ${a.temp} °C` : a.kind === 'eco' ? `Consigne éco ${a.temp} °C` : 'Consigne inchangée' }}</p>
              <p class="text-xs text-muted">{{ a.note }} · {{ a.guest }}</p>
            </div>
            <UBadge color="neutral" variant="outline" size="sm" label="Simulé" />
          </li>
        </ul>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/domotique`)
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })

const modeItems = [{ label: 'Local (réseau du logement, clé d\'API)', value: 'local' }, { label: 'Cloud Homey (accès à distance)', value: 'cloud' }]
const form = reactive({ homeyMode: 'local', homeyUrl: '', homeyId: '', preheatEnabled: false, preheatHours: 3 as number | string, comfortTemp: 20 as number | string, ecoTemp: 17 as number | string, ecoDelayMin: 60 as number | string })
watch(() => data.value?.config, (c) => { if (c) Object.assign(form, c) }, { immediate: true })

const status = computed(() => ({
  unconfigured: { color: 'neutral' as const, label: 'Non configuré' },
  'no-key': { color: 'warning' as const, label: 'Clé d\'API absente' },
  'no-client': { color: 'warning' as const, label: 'Application Homey absente' },
  'not-connected': { color: 'warning' as const, label: 'Compte non connecté' },
  'no-homey': { color: 'warning' as const, label: 'Aucun Homey associé' },
  untested: { color: 'info' as const, label: 'À tester' },
})[data.value?.connection ?? 'unconfigured'])

const busy = ref(false)
const error = ref('')
const saved = ref(false)
async function save() {
  busy.value = true; error.value = ''; saved.value = false
  try {
    await $fetch(`/api/logements/${route.params.id}/domotique`, { method: 'PUT', body: { ...form, homeyId: form.homeyId === NONE ? '' : form.homeyId } })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
  busy.value = false
  await refresh()
}

const connectUrl = computed(() => `/api/homey/connect?return=${encodeURIComponent(`/logements/${route.params.id}/domotique`)}`)
const testDisabled = computed(() => !data.value || (form.homeyMode === 'cloud' ? !data.value.cloud.connected || data.value.config.homeyMode !== 'cloud' || !data.value.config.homeyId : !data.value.keyPresent || !data.value.config.homeyUrl || data.value.config.homeyMode !== 'local'))
const oauthMsg = computed(() => ({
  ok: { color: 'success' as const, text: 'Compte Homey connecté.' },
  refuse: { color: 'warning' as const, text: 'Autorisation refusée ou annulée : le compte n\'est pas connecté.' },
  etat: { color: 'error' as const, text: 'Retour d\'autorisation invalide (session expirée ?). Recommence la connexion.' },
  erreur: { color: 'error' as const, text: 'Échec de la connexion au compte Homey. Vérifie l\'identifiant, le secret et l\'adresse de retour déclarée, puis recommence.' },
} as Record<string, { color: 'success' | 'warning' | 'error'; text: string }>)[String(route.query.homey ?? '')])
const homeys = ref<{ id: string; name: string }[]>([])
const homeysError = ref('')
const NONE = '__none'
const homeyItems = computed(() => [{ label: 'Aucun (dissocier)', value: NONE }, ...homeys.value.map(h => ({ label: h.name, value: h.id }))])
async function loadHomeys() {
  homeysError.value = ''
  try { homeys.value = (await $fetch<{ homeys: { id: string; name: string }[] }>('/api/homey/homeys')).homeys } catch (e: any) { homeysError.value = e?.data?.statusMessage || 'Liste des Homey indisponible.' }
}
watch(() => [data.value?.cloud.connected, form.homeyMode], () => { if (data.value?.cloud.connected && form.homeyMode === 'cloud' && !homeys.value.length) loadHomeys() }, { immediate: true })
async function disconnect() {
  if (!confirm('Déconnecter le compte Homey ? Le jeton enregistré sur le serveur sera effacé.')) return
  await $fetch('/api/homey/disconnect', { method: 'POST' })
  homeys.value = []; devices.value = null
  await refresh()
}

const testing = ref(false)
const discovering = ref(false)
const pingOk = ref('')
const testError = ref('')
const testedAt = ref('')
type Dev = { id: string; name: string; class: string; available: boolean; capabilities: { id: string; title: string; value: unknown; units: string | null }[] }
const devices = ref<Dev[] | null>(null)
async function test() {
  testing.value = true; testError.value = ''; pingOk.value = ''
  try {
    const r = await $fetch<{ homey?: string; count?: number }>(`/api/logements/${route.params.id}/domotique/test`, { method: 'POST' })
    pingOk.value = r.homey ? `Connexion valide : ${r.homey}` : `Connexion valide (${r.count ?? 0} appareil${(r.count ?? 0) > 1 ? 's' : ''} vu${(r.count ?? 0) > 1 ? 's' : ''})`
  } catch (e: any) { testError.value = e?.data?.statusMessage || 'Échec du test.' }
  testing.value = false
}
async function discover() {
  discovering.value = true; testError.value = ''
  try {
    const r = await $fetch<{ testedAt: string; devices: Dev[] }>(`/api/logements/${route.params.id}/domotique/discover`, { method: 'POST' })
    devices.value = r.devices; testedAt.value = r.testedAt
  } catch (e: any) { devices.value = null; testError.value = e?.data?.statusMessage || 'Échec de la découverte.' }
  discovering.value = false
}
const show = (c: { value: unknown; units: string | null }) => c.value === null ? '—' : typeof c.value === 'boolean' ? (c.value ? 'oui' : 'non') : `${c.value}${c.units ? ` ${c.units}` : ''}`
const hour = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const icon = (k: string) => k === 'comfort' ? 'i-lucide-flame' : k === 'eco' ? 'i-lucide-leaf' : 'i-lucide-equal'
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// --- Onglets (l'onglet choisi est gardé dans l'adresse : ?onglet=reglages) ---
const router = useRouter()
const tabs = [{ label: 'Appareils', icon: 'i-lucide-cpu', value: 'appareils' }, { label: 'Réglages', icon: 'i-lucide-settings', value: 'reglages' }]
const tab = ref<string>(route.query.onglet === 'reglages' || route.query.homey ? 'reglages' : 'appareils') // retour d'autorisation Homey : on revient sur les réglages
watch(tab, (t) => { router.replace({ query: { ...route.query, onglet: t } }) })

// --- Appareils : filtre et regroupement par type ---
const search = ref('')
const homeyName = computed(() => homeys.value.find(h => h.id === data.value?.config.homeyId)?.name ?? '')
const online = computed(() => devices.value?.filter(d => d.available).length ?? 0)
const offline = computed(() => (devices.value?.length ?? 0) - online.value)
const CLASSES: Record<string, [string, string]> = {
  thermostat: ['Chauffage et thermostats', 'i-lucide-thermometer'], heater: ['Chauffage et thermostats', 'i-lucide-thermometer'], airconditioning: ['Climatisation', 'i-lucide-snowflake'],
  light: ['Lumières', 'i-lucide-lightbulb'], socket: ['Prises', 'i-lucide-plug'], sensor: ['Capteurs', 'i-lucide-radio'], lock: ['Serrures', 'i-lucide-lock'],
  fan: ['Ventilation', 'i-lucide-fan'], curtain: ['Volets et stores', 'i-lucide-blinds'], blinds: ['Volets et stores', 'i-lucide-blinds'], windowcoverings: ['Volets et stores', 'i-lucide-blinds'],
  camera: ['Caméras', 'i-lucide-camera'], doorbell: ['Sonnettes', 'i-lucide-bell'], speaker: ['Audio', 'i-lucide-speaker'], tv: ['Télévisions', 'i-lucide-tv'],
  vacuumcleaner: ['Aspirateurs', 'i-lucide-brush-cleaning'], airpurifier: ['Purificateurs d\'air', 'i-lucide-wind'], other: ['Autres', 'i-lucide-cpu'],
}
const groups = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('fr')
  const by = new Map<string, { cls: string; label: string; icon: string; items: Dev[] }>()
  for (const d of devices.value ?? []) {
    if (q && !d.name.toLocaleLowerCase('fr').includes(q)) continue
    const [label, icon] = CLASSES[d.class] ?? [d.class ? d.class.charAt(0).toUpperCase() + d.class.slice(1) : 'Autres', 'i-lucide-cpu']
    const g = by.get(label) ?? { cls: label, label, icon, items: [] }
    g.items.push(d); by.set(label, g)
  }
  return [...by.values()].sort((a, b) => (a.label === 'Autres' ? 1 : 0) - (b.label === 'Autres' ? 1 : 0) || a.label.localeCompare(b.label, 'fr'))
})
</script>
