<template>
  <div v-if="data" class="relative min-h-screen overflow-hidden">
    <div v-if="data.background" class="absolute inset-0 bg-cover bg-center" :class="{ 'bg-kenburns': data.background.animated }" :style="{ backgroundImage: `url(${data.background.url})` }" />
    <div v-if="data.background" class="absolute inset-0 bg-black/40" />
    <div class="relative mx-auto max-w-lg space-y-4 px-4 py-6" :class="{ 'text-white': data.background }">
      <div class="text-center">
        <h1 class="text-2xl font-semibold">{{ t.welcomeTo }} {{ data.logement }}</h1>
        <p v-if="c.welcomeText" class="mt-2 whitespace-pre-line" :class="data.background ? 'text-white/80' : 'text-muted'">{{ c.welcomeText }}</p>
      </div>

      <template v-for="id in data.widgetOrder" :key="id">
        <UCard v-if="id === 'weather' && data.weather" :ui="cardUi">
          <template #header><span class="flex items-center gap-2 font-medium"><UIcon :name="weatherIcon(data.weather.code, data.weather.isDay)" /> {{ t.weather }}</span></template>
          <p class="text-sm">{{ data.weather.tempC }}°C · {{ weatherLabel(data.weather.code, lang) }}</p>
        </UCard>

        <UCard v-else-if="id === 'wifi' && (c.wifiSsid || c.wifiPassword)" :ui="cardUi">
          <template #header><span class="flex items-center gap-2 font-medium"><UIcon name="i-lucide-wifi" /> {{ t.wifi }}</span></template>
          <p v-if="c.wifiSsid" class="text-sm">{{ t.network }} : <b class="font-mono">{{ c.wifiSsid }}</b></p>
          <p v-if="c.wifiPassword" class="text-sm">{{ t.password }} : <b class="font-mono">{{ c.wifiPassword }}</b></p>
        </UCard>

        <UCard v-else-if="SECTIONS[id] && c[SECTIONS[id]!.key]" :ui="cardUi">
          <template #header><span class="flex items-center gap-2 font-medium"><UIcon :name="SECTIONS[id]!.icon" /> {{ SECTIONS[id]!.label }}</span></template>
          <p class="whitespace-pre-line text-sm">{{ c[SECTIONS[id]!.key] }}</p>
        </UCard>

        <UCard v-else-if="id === 'devices' && devices.length" :ui="cardUi">
          <template #header><span class="flex items-center gap-2 font-medium"><UIcon name="i-lucide-cpu" /> {{ t.devices }}</span></template>
          <div class="divide-y" :class="data.background ? 'divide-white/20' : 'divide-default'">
            <div v-for="d in devices" :key="d.id" class="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ d.name }}</p>
                <p v-if="!d.available" class="text-xs" :class="data.background ? 'text-white/60' : 'text-muted'">{{ t.deviceOffline }}</p>
                <p v-else-if="d.info.length" class="truncate text-xs" :class="data.background ? 'text-white/60' : 'text-muted'">
                  {{ d.info.map(i => `${i.title} : ${fmt(i)}`).join(' · ') }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <template v-for="ctrl in d.controls" :key="ctrl.capabilityId">
                  <USwitch v-if="ctrl.kind === 'onoff'" :model-value="!!ctrl.value" :disabled="!d.available || busy[d.id]" @update:model-value="send(d.id, ctrl.capabilityId, $event)" />
                  <div v-else-if="ctrl.kind === 'target_temperature'" class="flex items-center gap-1">
                    <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-minus" :disabled="!d.available || busy[d.id]" @click="send(d.id, ctrl.capabilityId, Math.max(ctrl.min!, Number(ctrl.value ?? ctrl.min) - 0.5))" />
                    <span class="w-14 text-center text-sm font-medium">{{ ctrl.value ?? '—' }}°C</span>
                    <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plus" :disabled="!d.available || busy[d.id]" @click="send(d.id, ctrl.capabilityId, Math.min(ctrl.max!, Number(ctrl.value ?? ctrl.max) + 0.5))" />
                  </div>
                  <USlider v-else-if="ctrl.kind === 'dim'" :model-value="[Math.round(Number(ctrl.value ?? 0) * 100)]" :disabled="!d.available || busy[d.id]" class="w-24" @update:model-value="send(d.id, ctrl.capabilityId, ($event[0] ?? 0) / 100)" />
                </template>
              </div>
            </div>
          </div>
        </UCard>
      </template>

      <p v-if="empty" class="py-12 text-center text-sm" :class="data.background ? 'text-white/70' : 'text-muted'">{{ t.empty }}</p>
    </div>
  </div>
  <div v-else class="pt-12 text-center text-muted">{{ t.invalid }}</div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const route = useRoute()
const { data } = await useFetch(`/api/g/${route.params.token}`)
if (import.meta.server && !data.value) setResponseStatus(useRequestEvent()!, 404)
const c = computed(() => data.value?.content ?? {} as Record<string, string>)
const { lang, t } = useGuestLang()
// Widgets "section de texte" : cle du contenu + libelle/icone, indexes par identifiant de widget (voir useWidgetCatalog.ts)
const SECTIONS = computed<Record<string, { key: string; label: string; icon: string }>>(() => ({
  checkin: { key: 'checkinInfo', label: t.checkin, icon: 'i-lucide-log-in' },
  checkout: { key: 'checkoutInfo', label: t.checkout, icon: 'i-lucide-log-out' },
  access: { key: 'accessDirections', label: t.access, icon: 'i-lucide-map-pin' },
  rules: { key: 'houseRules', label: t.rules, icon: 'i-lucide-list-checks' },
  tips: { key: 'localTips', label: t.tips, icon: 'i-lucide-compass' },
  faq: { key: 'faq', label: t.faq, icon: 'i-lucide-circle-help' },
}))
const empty = computed(() => !!data.value && !c.value.wifiSsid && !c.value.welcomeText && Object.values(SECTIONS.value).every(s => !c.value[s.key]))
// Widgets en verre dépoli quand un fond est configuré (sinon cartes Nuxt UI normales, sur fond uni)
const cardUi = computed(() => data.value?.background ? { root: 'bg-white/10 backdrop-blur-xl ring-white/20 text-white' } : {})

// --- Domotique mise à disposition (V3) ---
interface DeviceCtrl { capabilityId: string; kind: 'onoff' | 'dim' | 'target_temperature'; value: unknown; min?: number; max?: number; units: string | null }
interface DeviceView { id: string; name: string; class: string; available: boolean; controls: DeviceCtrl[]; info: { title: string; value: unknown; units: string | null }[] }
const { data: devicesData, refresh: refreshDevices } = await useFetch<{ devices: DeviceView[] }>(`/api/g/${route.params.token}/devices`)
const devices = computed(() => devicesData.value?.devices ?? [])
const fmt = (i: { value: unknown; units: string | null }) => i.value === null ? '—' : typeof i.value === 'boolean' ? (i.value ? 'oui' : 'non') : `${i.value}${i.units ? ` ${i.units}` : ''}`
const busy = reactive<Record<string, boolean>>({})
async function send(deviceId: string, capabilityId: string, value: unknown) {
  busy[deviceId] = true
  try { await $fetch(`/api/g/${route.params.token}/devices/${deviceId}`, { method: 'PUT', body: { capabilityId, value } }) }
  catch { /* la commande a echoue : l'affichage revient a l'etat reel au prochain rafraichissement */ }
  busy[deviceId] = false
  await refreshDevices()
}
</script>
