<template>
  <div v-if="data" class="tv-bg flex min-h-screen flex-col justify-between px-16 py-12 text-white">
    <div>
      <p class="text-3xl text-white/70">Bienvenue au</p>
      <h1 class="text-6xl font-semibold">{{ data.logement }}</h1>
    </div>

    <div v-if="data.guest" class="space-y-2">
      <p class="text-4xl">Bonjour <b>{{ data.guest.firstName }}</b> !</p>
      <p class="text-2xl text-white/80">Du {{ fmt(data.guest.arrival) }} au {{ fmt(data.guest.departure) }}</p>
    </div>

    <div class="grid grid-cols-2 gap-10">
      <div v-if="c.wifiSsid || c.wifiPassword" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-wifi" class="size-8" /> Wi-Fi</p>
        <p v-if="c.wifiSsid" class="mt-3 text-3xl font-mono">{{ c.wifiSsid }}</p>
        <p v-if="c.wifiPassword" class="text-3xl font-mono text-white/80">{{ c.wifiPassword }}</p>
      </div>

      <div v-if="c.localTips" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-compass" class="size-8" /> Conseils du quartier</p>
        <p class="mt-3 whitespace-pre-line text-2xl">{{ c.localTips }}</p>
      </div>

      <div v-if="c.checkoutInfo" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-log-out" class="size-8" /> Départ</p>
        <p class="mt-3 whitespace-pre-line text-2xl">{{ c.checkoutInfo }}</p>
      </div>

      <div v-if="c.welcomeText" class="rounded-2xl bg-white/10 p-8">
        <p class="flex items-center gap-3 text-2xl text-white/70"><UIcon name="i-lucide-heart" class="size-8" /> Mot de bienvenue</p>
        <p class="mt-3 whitespace-pre-line text-2xl">{{ c.welcomeText }}</p>
      </div>
    </div>

    <p v-if="empty" class="text-2xl text-white/60">Le livret de ce logement n'a pas encore été rempli.</p>
  </div>
  <div v-else class="flex min-h-screen items-center justify-center bg-black text-2xl text-white/60">Lien invalide.</div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
const route = useRoute()
const { data, refresh } = await useFetch(`/api/tv/${route.params.token}`)
if (import.meta.server && !data.value) setResponseStatus(useRequestEvent()!, 404)
const c = computed(() => data.value?.content ?? {} as Record<string, string>)
const empty = computed(() => !!data.value && !data.value.guest && !c.value.wifiSsid && !c.value.welcomeText && !c.value.localTips && !c.value.checkoutInfo)
const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

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
