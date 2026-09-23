<template>
  <UCard v-if="visible" :ui="cardUi">
    <template #header><span class="flex items-center gap-2 font-medium"><UIcon :name="icon" /> {{ label }}</span></template>

    <p v-if="id === 'weather' && weather" class="text-sm">{{ weather.tempC }}°C · {{ weatherLabel(weather.code, lang) }}</p>

    <template v-else-if="id === 'wifi'">
      <p v-if="content.wifiSsid" class="text-sm">{{ t.network }} : <b class="font-mono">{{ content.wifiSsid }}</b></p>
      <p v-if="content.wifiPassword" class="text-sm">{{ t.password }} : <b class="font-mono">{{ content.wifiPassword }}</b></p>
    </template>

    <p v-else-if="section" class="whitespace-pre-line text-sm">{{ content[section.key] }}</p>

    <div v-else-if="id === 'devices'" class="divide-y" :class="dark ? 'divide-white/20' : 'divide-default'">
      <div v-for="d in devices" :key="d.id" class="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{{ d.name }}</p>
          <p v-if="!d.available" class="text-xs" :class="dark ? 'text-white/60' : 'text-muted'">{{ t.deviceOffline }}</p>
          <p v-else-if="d.info.length" class="truncate text-xs" :class="dark ? 'text-white/60' : 'text-muted'">
            {{ d.info.map((i: any) => `${i.title} : ${fmt(i)}`).join(' · ') }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <template v-for="ctrl in d.controls" :key="ctrl.capabilityId">
            <USwitch v-if="ctrl.kind === 'onoff'" :model-value="!!ctrl.value" :disabled="!d.available || busy[d.id]" @update:model-value="$emit('send', d.id, ctrl.capabilityId, $event)" />
            <div v-else-if="ctrl.kind === 'target_temperature'" class="flex items-center gap-1">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-minus" :disabled="!d.available || busy[d.id]" @click="$emit('send', d.id, ctrl.capabilityId, Math.max(ctrl.min!, Number(ctrl.value ?? ctrl.min) - 0.5))" />
              <span class="w-14 text-center text-sm font-medium">{{ ctrl.value ?? '—' }}°C</span>
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plus" :disabled="!d.available || busy[d.id]" @click="$emit('send', d.id, ctrl.capabilityId, Math.min(ctrl.max!, Number(ctrl.value ?? ctrl.max) + 0.5))" />
            </div>
            <USlider v-else-if="ctrl.kind === 'dim'" :model-value="[Math.round(Number(ctrl.value ?? 0) * 100)]" :disabled="!d.available || busy[d.id]" class="w-24" @update:model-value="$emit('send', d.id, ctrl.capabilityId, ($event[0] ?? 0) / 100)" />
          </template>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
  id: string
  content: Record<string, string>
  weather: { tempC: number; code: number; isDay: boolean } | null
  devices: { id: string; name: string; available: boolean; controls: any[]; info: any[] }[]
  cardUi?: Record<string, string>
  busy: Record<string, boolean>
  dark?: boolean
}>()
defineEmits<{ send: [deviceId: string, capabilityId: string, value: unknown] }>()

const { lang, t } = useGuestLang()
const SECTIONS: Record<string, { key: string; icon: string; labelKey: keyof ReturnType<typeof useGuestLang>['t'] }> = {
  checkin: { key: 'checkinInfo', icon: 'i-lucide-log-in', labelKey: 'checkin' },
  checkout: { key: 'checkoutInfo', icon: 'i-lucide-log-out', labelKey: 'checkout' },
  access: { key: 'accessDirections', icon: 'i-lucide-map-pin', labelKey: 'access' },
  rules: { key: 'houseRules', icon: 'i-lucide-list-checks', labelKey: 'rules' },
  tips: { key: 'localTips', icon: 'i-lucide-compass', labelKey: 'tips' },
  faq: { key: 'faq', icon: 'i-lucide-circle-help', labelKey: 'faq' },
}
const section = computed(() => SECTIONS[props.id])
const fmt = (i: { value: unknown; units: string | null }) => i.value === null ? '—' : typeof i.value === 'boolean' ? (i.value ? 'oui' : 'non') : `${i.value}${i.units ? ` ${i.units}` : ''}`

const visible = computed(() => {
  if (props.id === 'weather') return !!props.weather
  if (props.id === 'wifi') return !!(props.content.wifiSsid || props.content.wifiPassword)
  if (props.id === 'devices') return props.devices.length > 0
  if (section.value) return !!props.content[section.value.key]
  return false
})
const icon = computed(() => props.id === 'weather' ? weatherIcon(props.weather?.code ?? 0, props.weather?.isDay ?? true) : props.id === 'wifi' ? 'i-lucide-wifi' : props.id === 'devices' ? 'i-lucide-cpu' : section.value?.icon ?? 'i-lucide-circle')
const label = computed(() => props.id === 'weather' ? t.weather : props.id === 'wifi' ? t.wifi : props.id === 'devices' ? t.devices : section.value ? t[section.value.labelKey] : '')
defineExpose({ visible })
</script>
