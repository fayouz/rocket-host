<template>
  <div>
  <DomotiqueNav />
  <div v-if="data" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">{{ t('nav.domotique') }}</h2>
      <UBadge :color="status.color" variant="subtle" :label="status.label" />
    </div>

    <UAlert v-if="oauthMsg" :color="oauthMsg.color" variant="subtle" :title="oauthMsg.text" />

    <!-- Loussa Réservations actif : connecteurs du lieu vus par Loussa Lieux (lecture seule, rien n'est commande d'ici) -->
    <UCard v-if="data.pms">
      <template #header><p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-house-wifi" class="size-3.5" /> {{ t('daily.domo.placeTitle') }}</p></template>
      <p v-if="data.pms.error" class="text-sm text-error">{{ data.pms.error }}</p>
      <p v-else-if="!data.pms.sections.length" class="text-sm text-muted">{{ t('daily.domo.noConnector') }}</p>
      <div v-for="sec in data.pms.sections" :key="sec.connectorId" class="mb-3 last:mb-0">
        <p class="mb-1 flex items-center gap-1.5 font-medium"><UIcon :name="sec.icon" class="size-4" />{{ sec.name }}<span class="text-xs font-normal text-muted">· {{ sec.pluginName }}</span></p>
        <p v-if="sec.error" class="text-sm text-error">{{ sec.error }}</p>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="(c, i) in sec.cards" :key="i" class="rounded-md border border-default p-2">
            <p class="flex items-center gap-1.5 text-sm font-medium"><UIcon :name="c.icon" class="size-3.5" />{{ c.title }}</p>
            <p v-for="(it, j) in c.items" :key="j" class="flex justify-between gap-2 text-xs text-muted"><span>{{ it.label }}</span><span class="tabular-nums">{{ it.value }}</span></p>
          </div>
        </div>
      </div>
    </UCard>
    <UTabs v-model="tab" :items="tabs" :content="false" />

    <!-- ONGLET APPAREILS -->
    <template v-if="tab === 'appareils'">
      <UCard>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium">{{ t('daily.domo.seenByHomey') }}<span v-if="homeyName" class="font-normal text-muted"> · {{ homeyName }}</span></p>
            <p class="text-sm text-muted">
              <template v-if="devices">{{ t('daily.domo.deviceCount', { n: devices.length }, devices.length) }} · {{ t('daily.domo.onlineN', { n: online }) }}<template v-if="offline"> · {{ t('daily.domo.offlineN', { n: offline }) }}</template> · {{ t('daily.domo.readAt', { time: hour(testedAt) }) }}</template>
              <template v-else>{{ t('daily.domo.readOnly') }}</template>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UInput v-if="devices" v-model="search" size="sm" icon="i-lucide-search" :placeholder="t('daily.domo.filter')" class="w-40" />
            <UButton icon="i-lucide-radar" :label="devices ? t('daily.domo.rediscover') : t('daily.domo.discover')" :loading="discovering" :disabled="testDisabled" @click="discover" />
          </div>
        </div>
        <p v-if="testError" class="mt-2 text-sm text-error">{{ testError }}</p>
      </UCard>

      <UCard v-if="!devices && !testError">
        <div class="flex flex-col items-center gap-2 py-6 text-center">
          <UIcon name="i-lucide-cpu" class="size-10 text-muted" />
          <template v-if="testDisabled">
            <p class="font-medium">{{ t('daily.domo.toConfigure') }}</p>
            <p class="max-w-md text-sm text-muted">{{ t('daily.domo.connectFirst') }}</p>
            <UButton color="neutral" variant="outline" icon="i-lucide-settings" :label="t('daily.domo.openSettings')" @click="tab = 'reglages'" />
          </template>
          <template v-else>
            <p class="font-medium">{{ t('daily.domo.noDevices') }}</p>
            <p class="max-w-md text-sm text-muted">{{ t('daily.domo.clickDiscover') }}</p>
          </template>
        </div>
      </UCard>

      <template v-if="devices">
        <UCard v-if="!devices.length"><p class="text-sm text-muted">{{ t('daily.domo.noneSeen') }}</p></UCard>
        <p v-else-if="!groups.length" class="px-1 text-sm text-muted">{{ t('daily.domo.noMatch', { q: search }) }}</p>
        <section v-for="g in groups" :key="g.cls" class="space-y-2">
          <h3 class="flex items-center gap-2 px-1 text-sm font-semibold text-muted">
            <UIcon :name="g.icon" class="size-4" /> {{ g.label }} <span class="font-normal">({{ g.items.length }})</span>
          </h3>
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <UCard v-for="d in g.items" :key="d.id" :ui="{ body: 'p-3 sm:p-3' }" :class="{ 'opacity-60': !d.available }">
              <div class="flex items-start justify-between gap-2">
                <p class="min-w-0 break-words font-medium leading-snug">{{ d.name }}</p>
                <UBadge :color="d.available ? 'success' : 'neutral'" variant="subtle" size="sm" :label="d.available ? t('daily.domo.online') : t('daily.domo.offline')" />
              </div>
              <ul v-if="d.capabilities.length" class="mt-2 space-y-0.5 text-sm">
                <li v-for="c in d.capabilities.slice(0, 6)" :key="c.id" class="flex justify-between gap-2">
                  <span class="truncate text-muted">{{ c.title }}</span><b class="shrink-0">{{ show(c) }}</b>
                </li>
                <li v-if="d.capabilities.length > 6" class="text-xs text-muted">{{ t('daily.domo.moreProps', { n: d.capabilities.length - 6 }) }}</li>
              </ul>
              <div v-if="EXCLUDED_CLASSES.has(d.class)" class="mt-2 text-xs text-muted">{{ t('daily.domo.neverShare', { type: d.class }) }}</div>
              <template v-else>
                <UCheckbox class="mt-2" :model-value="!!guestSelection[d.id]" :label="t('daily.domo.availableGuest')" @update:model-value="toggleGuest(d, $event)" />
                <div v-if="guestSelection[d.id] && d.capabilities.some(c => c.id === 'target_temperature')" class="mt-2 flex items-center gap-2 text-sm">
                  <span class="text-muted">{{ t('daily.domo.bounds') }}</span>
                  <UInput v-model.number="guestSelection[d.id]!.minTemp" type="number" :min="GUEST_TEMP_LIMITS[0]" :max="GUEST_TEMP_LIMITS[1]" size="xs" class="w-16" @change="saveGuestDevices" />
                  <span class="text-muted">{{ t('daily.domo.boundTo') }}</span>
                  <UInput v-model.number="guestSelection[d.id]!.maxTemp" type="number" :min="GUEST_TEMP_LIMITS[0]" :max="GUEST_TEMP_LIMITS[1]" size="xs" class="w-16" @change="saveGuestDevices" />
                </div>
              </template>
            </UCard>
          </div>
        </section>
      </template>
    </template>

    <!-- ONGLET RÉGLAGES -->
    <template v-else>
      <UAlert color="info" variant="subtle" icon="i-lucide-shield-check" :title="t('daily.domo.prepTitle')"
              :description="t('daily.domo.prepDesc')" />

      <!-- Connexion -->
      <UCard>
        <template #header><b>{{ t('daily.domo.connTitle') }}</b></template>
        <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="save">
          <USelect v-model="form.homeyMode" :items="modeItems" />
          <UInput v-if="form.homeyMode === 'local'" v-model="form.homeyUrl" :placeholder="t('daily.domo.homeyUrl')" />
          <span v-else class="self-center text-sm text-muted">{{ t('daily.domo.urlFromCloud') }}</span>
          <div v-if="form.homeyMode === 'cloud'" class="space-y-2 text-sm sm:col-span-2">
            <template v-if="!data.cloud.clientConfigured">
              <i18n-t keypath="daily.domo.step1" tag="p" class="text-muted"><template #n><b>1.</b></template><template #link><NuxtLink to="/settings/connexions" class="underline">{{ t('daily.domo.settingsConnections') }}</NuxtLink></template></i18n-t>
              <i18n-t keypath="daily.domo.step2" tag="p" class="text-muted"><template #n><b>2.</b></template><template #uri><code class="select-all break-all">{{ data.cloud.redirectUri }}</code></template></i18n-t>
            </template>
            <template v-else-if="!data.cloud.connected">
              <i18n-t keypath="daily.domo.appDetected" tag="p" class="text-muted"><template #uri><code class="select-all break-all">{{ data.cloud.redirectUri }}</code></template></i18n-t>
              <UButton icon="i-lucide-link" :label="t('daily.domo.connectAccount')" :to="connectUrl" external />
            </template>
            <template v-else>
              <p class="text-muted"><UIcon name="i-lucide-check" class="align-middle text-success" /> {{ t('daily.domo.accountConnected', { date: new Date(data.cloud.connectedAt!).toLocaleDateString(fmtLoc) }) }}</p>
              <div class="flex flex-wrap items-center gap-2">
                <UFormField :label="t('daily.domo.homeyLinked')" class="w-72">
                  <USelect v-model="form.homeyId" :items="homeyItems" :placeholder="t('daily.domo.pickHomey')" class="w-full" />
                </UFormField>
                <span v-if="homeysError" class="text-error">{{ homeysError }}</span>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-unlink" :label="t('daily.domo.disconnect')" @click="disconnect" />
              </div>
            </template>
          </div>
          <p v-else class="text-sm text-muted sm:col-span-2">
            <template v-if="data.keyPresent"><UIcon name="i-lucide-check" class="align-middle text-success" /> <i18n-t keypath="daily.domo.keySaved" tag="span"><template #link><NuxtLink to="/settings/connexions" class="underline">{{ t('daily.domo.settingsConnections') }}</NuxtLink></template></i18n-t></template>
            <i18n-t v-else keypath="daily.domo.keyMissing" tag="span"><template #link><NuxtLink to="/settings/connexions" class="underline">{{ t('daily.domo.settingsConnections') }}</NuxtLink></template></i18n-t>
          </p>
          <p v-if="form.homeyMode === 'cloud' && data.cloud.connected && !form.homeyId" class="text-sm text-warning sm:col-span-2">{{ t('daily.domo.pickWarn') }}</p>
          <p v-if="error" class="text-sm text-error sm:col-span-2">{{ error }}</p>
          <div class="flex flex-wrap gap-2 sm:col-span-2">
            <UButton type="submit" :label="t('daily.contacts.save')" :loading="busy" />
            <UButton color="neutral" variant="outline" icon="i-lucide-plug-zap" :label="t('daily.domo.testConn')" :loading="testing" :disabled="testDisabled" @click="test" />
            <span v-if="pingOk" class="self-center text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> {{ pingOk }}</span>
            <span v-else class="self-center text-xs text-muted">{{ t('daily.domo.testNote') }}</span>
          </div>
          <p v-if="testError" class="text-sm text-error sm:col-span-2">{{ testError }}</p>
        </form>
      </UCard>

      <!-- Règle de préchauffage -->
      <UCard>
        <template #header><div class="flex items-center justify-between gap-2"><b>{{ t('daily.domo.preheat') }}</b>
          <USwitch v-model="form.preheatEnabled" :label="form.preheatEnabled ? t('daily.domo.ruleOn') : t('daily.domo.ruleOff')" @update:model-value="save" /></div></template>
        <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="save">
          <UFormField :label="t('daily.domo.hoursBefore')"><UInput v-model="form.preheatHours" type="number" step="0.5" :min="data.limits.preheatHours[0]" :max="data.limits.preheatHours[1]" /></UFormField>
          <UFormField :label="t('daily.domo.minAfter')"><UInput v-model="form.ecoDelayMin" type="number" step="15" :min="data.limits.ecoDelayMin[0]" :max="data.limits.ecoDelayMin[1]" /></UFormField>
          <UFormField :label="t('daily.domo.comfortSet', { min: data.limits.comfort[0], max: data.limits.comfort[1] })"><UInput v-model="form.comfortTemp" type="number" step="0.5" :min="data.limits.comfort[0]" :max="data.limits.comfort[1]" /></UFormField>
          <UFormField :label="t('daily.domo.ecoSet', { min: data.limits.eco[0], max: data.limits.eco[1] })"><UInput v-model="form.ecoTemp" type="number" step="0.5" :min="data.limits.eco[0]" :max="data.limits.eco[1]" /></UFormField>
          <UButton type="submit" class="sm:col-span-2" :label="t('daily.domo.saveRule')" :loading="busy" />
        </form>
        <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
        <p v-if="saved" class="mt-2 text-sm text-success">{{ t('daily.domo.saved') }}</p>
      </UCard>

      <!-- Simulation -->
      <UCard>
        <template #header><b>{{ t('daily.domo.simulation') }}</b></template>
        <p v-if="!data.config.preheatEnabled" class="text-sm text-muted">{{ t('daily.domo.simOff') }}</p>
        <p v-else-if="!data.actions.length" class="text-sm text-muted">{{ t('daily.domo.noAction') }}</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="a in data.actions" :key="a.at + a.kind + a.bookingId" class="flex items-start gap-3 py-2">
            <UIcon :name="icon(a.kind)" class="mt-0.5 size-5 shrink-0" :class="a.kind === 'comfort' ? 'text-orange-500' : a.kind === 'eco' ? 'text-sky-500' : 'text-muted'" />
            <div class="min-w-0 flex-1">
              <p class="text-sm"><b>{{ when(a.at) }}</b> — {{ a.kind === 'comfort' ? t('daily.domo.setpoint', { temp: a.temp }) : a.kind === 'eco' ? t('daily.domo.ecoSetpoint', { temp: a.temp }) : t('daily.domo.unchanged') }}</p>
              <p class="text-xs text-muted">{{ a.note }} · {{ a.guest }}</p>
            </div>
            <UBadge color="neutral" variant="outline" size="sm" :label="t('daily.domo.simulated')" />
          </li>
        </ul>
      </UCard>
    </template>
  </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()
const { fmtLocale: fmtLoc } = useLocaleFormat()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/domotique`)
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })

const modeItems = computed(() => [{ label: t('daily.domo.modeLocal'), value: 'local' }, { label: t('daily.domo.modeCloud'), value: 'cloud' }])
const form = reactive({ homeyMode: 'local', homeyUrl: '', homeyId: '', preheatEnabled: false, preheatHours: 3 as number | string, comfortTemp: 20 as number | string, ecoTemp: 17 as number | string, ecoDelayMin: 60 as number | string })
watch(() => data.value?.config, (c) => { if (c) Object.assign(form, c) }, { immediate: true })

const status = computed(() => ({
  unconfigured: { color: 'neutral' as const, label: t('daily.domo.stUnconfigured') },
  'no-key': { color: 'warning' as const, label: t('daily.domo.stNoKey') },
  'no-client': { color: 'warning' as const, label: t('daily.domo.stNoClient') },
  'not-connected': { color: 'warning' as const, label: t('daily.domo.stNotConnected') },
  'no-homey': { color: 'warning' as const, label: t('daily.domo.stNoHomey') },
  untested: { color: 'info' as const, label: t('daily.domo.stUntested') },
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
  } catch (e: any) { error.value = e?.data?.statusMessage || t('daily.contacts.failed') }
  busy.value = false
  await refresh()
}

const connectUrl = computed(() => `/api/homey/connect?return=${encodeURIComponent(`/logements/${route.params.id}/domotique`)}`)
const testDisabled = computed(() => !data.value || (form.homeyMode === 'cloud' ? !data.value.cloud.connected || data.value.config.homeyMode !== 'cloud' || !data.value.config.homeyId : !data.value.keyPresent || !data.value.config.homeyUrl || data.value.config.homeyMode !== 'local'))
const oauthMsg = computed(() => ({
  ok: { color: 'success' as const, text: t('daily.domo.oauthOk') },
  refuse: { color: 'warning' as const, text: t('daily.domo.oauthRefused') },
  etat: { color: 'error' as const, text: t('daily.domo.oauthState') },
  erreur: { color: 'error' as const, text: t('daily.domo.oauthError') },
} as Record<string, { color: 'success' | 'warning' | 'error'; text: string }>)[String(route.query.homey ?? '')])
const homeys = ref<{ id: string; name: string }[]>([])
const homeysError = ref('')
const NONE = '__none'
const homeyItems = computed(() => [{ label: t('daily.domo.noneUnlink'), value: NONE }, ...homeys.value.map(h => ({ label: h.name, value: h.id }))])
async function loadHomeys() {
  homeysError.value = ''
  try { homeys.value = (await $fetch<{ homeys: { id: string; name: string }[] }>('/api/homey/homeys')).homeys } catch (e: any) { homeysError.value = e?.data?.statusMessage || t('daily.domo.homeyListFail') }
}
watch(() => [data.value?.cloud.connected, form.homeyMode], () => { if (data.value?.cloud.connected && form.homeyMode === 'cloud' && !homeys.value.length) loadHomeys() }, { immediate: true })
async function disconnect() {
  if (!confirm(t('daily.domo.confirmDisconnect'))) return
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
    pingOk.value = r.homey ? t('daily.domo.validConn', { homey: r.homey }) : t('daily.domo.validConnCount', { n: r.count ?? 0 }, r.count ?? 0)
  } catch (e: any) { testError.value = e?.data?.statusMessage || t('daily.domo.testFail') }
  testing.value = false
}
async function discover() {
  discovering.value = true; testError.value = ''
  try {
    const r = await $fetch<{ testedAt: string; devices: Dev[] }>(`/api/logements/${route.params.id}/domotique/discover`, { method: 'POST' })
    devices.value = r.devices; testedAt.value = r.testedAt
  } catch (e: any) { devices.value = null; testError.value = e?.data?.statusMessage || t('daily.domo.discoverFail') }
  discovering.value = false
}
const show = (c: { value: unknown; units: string | null }) => c.value === null ? '—' : typeof c.value === 'boolean' ? (c.value ? t('daily.domo.yes') : t('daily.domo.no')) : `${c.value}${c.units ? ` ${c.units}` : ''}`

// --- Appareils mis a disposition du voyageur (livret/ecran TV) ---
const EXCLUDED_CLASSES = new Set(['lock', 'garagedoor', 'camera', 'doorbell'])
const GUEST_TEMP_LIMITS = [16, 24] as const
const guestSelection = reactive<Record<string, { minTemp: number; maxTemp: number }>>({})
async function loadGuestDevices() {
  const r = await $fetch<{ devices: { deviceId: string; minTemp: number | null; maxTemp: number | null }[] }>(`/api/logements/${route.params.id}/domotique/guest-devices`)
  for (const key of Object.keys(guestSelection)) delete guestSelection[key]
  for (const d of r.devices) guestSelection[d.deviceId] = { minTemp: d.minTemp ?? GUEST_TEMP_LIMITS[0], maxTemp: d.maxTemp ?? GUEST_TEMP_LIMITS[1] }
}
loadGuestDevices()
function toggleGuest(d: Dev, on: boolean) {
  if (on) guestSelection[d.id] = { minTemp: GUEST_TEMP_LIMITS[0], maxTemp: GUEST_TEMP_LIMITS[1] }
  else delete guestSelection[d.id]
  saveGuestDevices()
}
async function saveGuestDevices() {
  const list = (devices.value ?? []).filter(d => guestSelection[d.id]).map(d => ({
    deviceId: d.id, deviceName: d.name, deviceClass: d.class,
    minTemp: guestSelection[d.id]!.minTemp, maxTemp: guestSelection[d.id]!.maxTemp,
  }))
  await $fetch(`/api/logements/${route.params.id}/domotique/guest-devices`, { method: 'PUT', body: { devices: list } })
}
const hour = (d: string) => new Date(d).toLocaleTimeString(fmtLoc.value, { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const icon = (k: string) => k === 'comfort' ? 'i-lucide-flame' : k === 'eco' ? 'i-lucide-leaf' : 'i-lucide-equal'
const when = (d: string) => new Date(d).toLocaleString(fmtLoc.value, { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// --- Onglets (l'onglet choisi est gardé dans l'adresse : ?onglet=reglages) ---
const router = useRouter()
const tabs = computed(() => [{ label: t('daily.domo.devices'), icon: 'i-lucide-cpu', value: 'appareils' }, { label: t('daily.domo.settings'), icon: 'i-lucide-settings', value: 'reglages' }])
const tab = ref<string>(route.query.onglet === 'reglages' || route.query.homey ? 'reglages' : 'appareils') // retour d'autorisation Homey : on revient sur les réglages
watch(tab, (v) => { router.replace({ query: { ...route.query, onglet: v } }) })

// --- Appareils : filtre et regroupement par type ---
const search = ref('')
const homeyName = computed(() => homeys.value.find(h => h.id === data.value?.config.homeyId)?.name ?? '')
const online = computed(() => devices.value?.filter(d => d.available).length ?? 0)
const offline = computed(() => (devices.value?.length ?? 0) - online.value)
const CLASSES: Record<string, [string, string]> = {
  thermostat: ['heating', 'i-lucide-thermometer'], heater: ['heating', 'i-lucide-thermometer'], airconditioning: ['ac', 'i-lucide-snowflake'],
  light: ['lights', 'i-lucide-lightbulb'], socket: ['sockets', 'i-lucide-plug'], sensor: ['sensors', 'i-lucide-radio'], lock: ['locks', 'i-lucide-lock'],
  fan: ['ventilation', 'i-lucide-fan'], curtain: ['shutters', 'i-lucide-blinds'], blinds: ['shutters', 'i-lucide-blinds'], windowcoverings: ['shutters', 'i-lucide-blinds'],
  camera: ['cameras', 'i-lucide-camera'], doorbell: ['doorbells', 'i-lucide-bell'], speaker: ['audio', 'i-lucide-speaker'], tv: ['tvs', 'i-lucide-tv'],
  vacuumcleaner: ['vacuums', 'i-lucide-brush-cleaning'], airpurifier: ['purifiers', 'i-lucide-wind'], other: ['other', 'i-lucide-cpu'],
}
const groups = computed(() => {
  const q = search.value.trim().toLocaleLowerCase(locale.value)
  const by = new Map<string, { cls: string; label: string; icon: string; items: Dev[] }>()
  for (const d of devices.value ?? []) {
    if (q && !d.name.toLocaleLowerCase(locale.value).includes(q)) continue
    const known = CLASSES[d.class]
    const key = known ? known[0] : d.class ? `x:${d.class}` : 'other'
    const label = known ? t(`daily.domo.cls.${known[0]}`) : d.class ? d.class.charAt(0).toUpperCase() + d.class.slice(1) : t('daily.domo.cls.other')
    const g = by.get(key) ?? { cls: key, label, icon: known ? known[1] : 'i-lucide-cpu', items: [] }
    g.items.push(d); by.set(key, g)
  }
  return [...by.values()].sort((a, b) => (a.cls === 'other' ? 1 : 0) - (b.cls === 'other' ? 1 : 0) || a.label.localeCompare(b.label, locale.value))
})
</script>
