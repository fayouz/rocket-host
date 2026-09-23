<template>
  <div v-if="data" class="tv-bg relative flex min-h-screen flex-col justify-between overflow-hidden px-16 py-12 text-white">
    <div v-if="data.background" class="absolute inset-0 bg-cover bg-center" :class="{ 'bg-kenburns': data.background.animated }" :style="{ backgroundImage: `url(${data.background.url})` }" />
    <div v-if="data.background" class="absolute inset-0 bg-black/40" />
    <div class="relative flex items-start justify-between">
      <div>
        <p class="text-3xl text-white/70">{{ t.welcomeTo }}</p>
        <h1 class="text-6xl font-semibold">{{ data.logement }}</h1>
      </div>
      <div v-if="showWeather && data.weather" class="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3 text-white/80 backdrop-blur-xl">
        <UIcon :name="weatherIcon(data.weather.code, data.weather.isDay)" class="size-10" />
        <div>
          <p class="text-3xl font-semibold text-white">{{ data.weather.tempC }}°C</p>
          <p class="text-lg">{{ weatherLabel(data.weather.code, lang) }}</p>
        </div>
      </div>
    </div>

    <div v-if="data.guest" class="relative space-y-2">
      <p class="text-4xl">{{ t.hello }} <b>{{ data.guest.firstName }}</b> !</p>
      <p class="text-2xl text-white/80">{{ formatGuestDate(data.guest.arrival, lang) }} → {{ formatGuestDate(data.guest.departure, lang) }}</p>
    </div>

    <div class="relative grid grid-cols-2 gap-10">
      <div v-if="c.welcomeText" class="rounded-2xl bg-white/10 p-8 backdrop-blur-xl">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-heart" class="size-8" /> {{ t.welcomeText }}</p>
        <p class="mt-3 whitespace-pre-line text-2xl">{{ c.welcomeText }}</p>
      </div>

      <template v-for="id in gridOrder" :key="id">
        <div v-if="id === 'wifi' && (c.wifiSsid || c.wifiPassword)" class="rounded-2xl bg-white/10 p-8 backdrop-blur-xl">
          <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-wifi" class="size-8" /> {{ t.wifi }}</p>
          <p v-if="c.wifiSsid" class="mt-3 text-3xl font-mono">{{ c.wifiSsid }}</p>
          <p v-if="c.wifiPassword" class="text-3xl font-mono text-white/80">{{ c.wifiPassword }}</p>
        </div>

        <div v-else-if="SECTIONS[id] && c[SECTIONS[id]!.key]" class="rounded-2xl bg-white/10 p-8 backdrop-blur-xl">
          <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon :name="SECTIONS[id]!.icon" class="size-8" /> {{ SECTIONS[id]!.label }}</p>
          <p class="mt-3 whitespace-pre-line text-2xl">{{ c[SECTIONS[id]!.key] }}</p>
        </div>

        <div v-else-if="id === 'devices' && devices.length" class="rounded-2xl bg-white/10 p-8 backdrop-blur-xl">
          <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-cpu" class="size-8" /> {{ t.devices }}</p>
          <ul class="mt-3 space-y-1 text-xl">
            <li v-for="d in devices" :key="d.id" class="flex justify-between gap-3">
              <span class="truncate">{{ d.name }}</span>
              <b class="shrink-0 text-white/80">{{ !d.available ? t.deviceOffline : summary(d) }}</b>
            </li>
          </ul>
        </div>
      </template>
    </div>

    <p v-if="empty" class="relative text-2xl text-white/60">{{ t.empty }}</p>
  </div>
  <div v-else class="flex min-h-screen items-center justify-center bg-black text-2xl text-white/60">{{ t.invalid }}</div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
const route = useRoute()
const { data, refresh } = await useFetch(`/api/tv/${route.params.token}`)
if (import.meta.server && !data.value) setResponseStatus(useRequestEvent()!, 404)
const c = computed(() => data.value?.content ?? {} as Record<string, string>)
const { lang, t } = useGuestLang()
const SECTIONS = computed<Record<string, { key: string; label: string; icon: string }>>(() => ({
  checkin: { key: 'checkinInfo', label: t.checkin, icon: 'i-lucide-log-in' },
  checkout: { key: 'checkoutInfo', label: t.checkout, icon: 'i-lucide-log-out' },
  access: { key: 'accessDirections', label: t.access, icon: 'i-lucide-map-pin' },
  rules: { key: 'houseRules', label: t.rules, icon: 'i-lucide-list-checks' },
  tips: { key: 'localTips', label: t.tips, icon: 'i-lucide-compass' },
  faq: { key: 'faq', label: t.faq, icon: 'i-lucide-circle-help' },
}))
const showWeather = computed(() => data.value?.widgetOrder?.includes('weather') ?? true)
const gridOrder = computed(() => (data.value?.widgetOrder ?? []).filter(id => id !== 'weather'))
const empty = computed(() => !!data.value && !data.value.guest && !c.value.wifiSsid && !c.value.welcomeText && !c.value.localTips && !c.value.checkoutInfo)

// Domotique mise à disposition : affichage seul (pas d'interaction tactile prévue sur une TV)
interface DeviceCtrl { capabilityId: string; kind: 'onoff' | 'dim' | 'target_temperature'; value: unknown; units: string | null }
interface DeviceView { id: string; name: string; available: boolean; controls: DeviceCtrl[] }
const { data: devicesData } = await useFetch<{ devices: DeviceView[] }>(`/api/g/${route.params.token}/devices`)
const devices = computed(() => devicesData.value?.devices ?? [])
function summary(d: DeviceView) {
  const onoff = d.controls.find(c => c.kind === 'onoff')
  const temp = d.controls.find(c => c.kind === 'target_temperature')
  const parts = []
  if (onoff) parts.push(onoff.value ? t.deviceOn : t.deviceOff)
  if (temp && temp.value !== null) parts.push(`${temp.value}°C`)
  return parts.join(' · ') || '—'
}

// Reste affiche des jours d'affilee sur une TV : on rafraichit les donnees regulierement (meteo, contenu modifie),
// et on recharge la PAGE ENTIERE (pas juste les donnees) un peu avant l'arrivee du prochain voyageur (data.reloadAt,
// calcule cote serveur) pour repartir sur un etat propre, sans dependre d'un reseau local ni d'une app tierce (Fully Kiosk).
// Verification periodique plutot qu'un setTimeout unique : un setTimeout de plusieurs jours peut deborder en JS.
if (import.meta.client) {
  const id = setInterval(async () => {
    if (data.value?.reloadAt && Date.now() >= new Date(data.value.reloadAt).getTime()) { window.location.reload(); return }
    await refresh()
  }, 10 * 60 * 1000)
  onUnmounted(() => clearInterval(id))
}
</script>

<style scoped>
.tv-bg {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
}
</style>
