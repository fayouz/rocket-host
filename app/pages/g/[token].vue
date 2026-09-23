<template>
  <div v-if="data" class="relative min-h-screen" :style="bgStyle">
    <div v-if="data.hasBackground" class="absolute inset-0 bg-black/40" />
    <div class="relative mx-auto max-w-lg space-y-4 px-4 py-6" :class="{ 'text-white': data.hasBackground }">
      <div class="text-center">
        <h1 class="text-2xl font-semibold">{{ t.welcomeTo }} {{ data.logement }}</h1>
        <p v-if="c.welcomeText" class="mt-2 whitespace-pre-line" :class="data.hasBackground ? 'text-white/80' : 'text-muted'">{{ c.welcomeText }}</p>
      </div>

      <UCard v-if="data.weather" :ui="cardUi">
        <template #header><span class="flex items-center gap-2 font-medium"><UIcon :name="weatherIcon(data.weather.code, data.weather.isDay)" /> {{ t.weather }}</span></template>
        <p class="text-sm">{{ data.weather.tempC }}°C · {{ weatherLabel(data.weather.code, lang) }}</p>
      </UCard>

      <UCard v-if="c.wifiSsid || c.wifiPassword" :ui="cardUi">
        <template #header><span class="flex items-center gap-2 font-medium"><UIcon name="i-lucide-wifi" /> {{ t.wifi }}</span></template>
        <p v-if="c.wifiSsid" class="text-sm">{{ t.network }} : <b class="font-mono">{{ c.wifiSsid }}</b></p>
        <p v-if="c.wifiPassword" class="text-sm">{{ t.password }} : <b class="font-mono">{{ c.wifiPassword }}</b></p>
      </UCard>

      <UCard v-for="s in sections" :key="s.key" v-show="c[s.key]" :ui="cardUi">
        <template #header><span class="flex items-center gap-2 font-medium"><UIcon :name="s.icon" /> {{ s.label }}</span></template>
        <p class="whitespace-pre-line text-sm">{{ c[s.key] }}</p>
      </UCard>

      <p v-if="empty" class="py-12 text-center text-sm" :class="data.hasBackground ? 'text-white/70' : 'text-muted'">{{ t.empty }}</p>
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
const sections = computed(() => [
  { key: 'checkinInfo', label: t.checkin, icon: 'i-lucide-log-in' },
  { key: 'checkoutInfo', label: t.checkout, icon: 'i-lucide-log-out' },
  { key: 'accessDirections', label: t.access, icon: 'i-lucide-map-pin' },
  { key: 'houseRules', label: t.rules, icon: 'i-lucide-list-checks' },
  { key: 'localTips', label: t.tips, icon: 'i-lucide-compass' },
  { key: 'faq', label: t.faq, icon: 'i-lucide-circle-help' },
] as const)
const empty = computed(() => !!data.value && !c.value.wifiSsid && !c.value.welcomeText && sections.value.every(s => !c.value[s.key]))
const bgStyle = computed(() => data.value?.hasBackground
  ? { backgroundImage: `url(/api/g/${route.params.token}/background)`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
  : {})
// Widgets en verre dépoli quand un fond est configuré (sinon cartes Nuxt UI normales, sur fond uni)
const cardUi = computed(() => data.value?.hasBackground ? { root: 'bg-white/10 backdrop-blur-xl ring-white/20 text-white' } : {})
</script>
