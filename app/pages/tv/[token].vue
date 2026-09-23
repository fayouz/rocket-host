<template>
  <div v-if="data" class="tv-bg flex min-h-screen flex-col justify-between px-16 py-12 text-white">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-3xl text-white/70">{{ t.welcomeTo }}</p>
        <h1 class="text-6xl font-semibold">{{ data.logement }}</h1>
      </div>
      <div v-if="data.weather" class="flex items-center gap-3 text-white/80">
        <UIcon :name="weatherIcon(data.weather.code, data.weather.isDay)" class="size-10" />
        <div>
          <p class="text-3xl font-semibold text-white">{{ data.weather.tempC }}°C</p>
          <p class="text-lg">{{ weatherLabel(data.weather.code, lang) }}</p>
        </div>
      </div>
    </div>

    <div v-if="data.guest" class="space-y-2">
      <p class="text-4xl">{{ t.hello }} <b>{{ data.guest.firstName }}</b> !</p>
      <p class="text-2xl text-white/80">{{ formatGuestDate(data.guest.arrival, lang) }} → {{ formatGuestDate(data.guest.departure, lang) }}</p>
    </div>

    <div class="grid grid-cols-2 gap-10">
      <div v-if="c.wifiSsid || c.wifiPassword" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-wifi" class="size-8" /> {{ t.wifi }}</p>
        <p v-if="c.wifiSsid" class="mt-3 text-3xl font-mono">{{ c.wifiSsid }}</p>
        <p v-if="c.wifiPassword" class="text-3xl font-mono text-white/80">{{ c.wifiPassword }}</p>
      </div>

      <div v-if="c.localTips" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-compass" class="size-8" /> {{ t.tips }}</p>
        <p class="mt-3 whitespace-pre-line text-2xl">{{ c.localTips }}</p>
      </div>

      <div v-if="c.checkoutInfo" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-log-out" class="size-8" /> {{ t.checkout }}</p>
        <p class="mt-3 whitespace-pre-line text-2xl">{{ c.checkoutInfo }}</p>
      </div>

      <div v-if="c.welcomeText" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-heart" class="size-8" /> {{ t.welcomeText }}</p>
        <p class="mt-3 whitespace-pre-line text-2xl">{{ c.welcomeText }}</p>
      </div>
    </div>

    <p v-if="empty" class="text-2xl text-white/60">{{ t.empty }}</p>
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
const empty = computed(() => !!data.value && !data.value.guest && !c.value.wifiSsid && !c.value.welcomeText && !c.value.localTips && !c.value.checkoutInfo)

// Reste affiche des jours d'affilee sur une TV : on rafraichit tout seul (nouveau voyageur, contenu modifie).
if (import.meta.client) {
  const id = setInterval(() => refresh(), 10 * 60 * 1000)
  onUnmounted(() => clearInterval(id))
}
</script>

<style scoped>
.tv-bg {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
}
</style>
