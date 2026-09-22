<template>
  <div v-if="data" class="mx-auto max-w-lg space-y-4 px-4 py-6">
    <div class="text-center">
      <h1 class="text-2xl font-semibold">{{ data.logement }}</h1>
      <p v-if="c.welcomeText" class="mt-2 whitespace-pre-line text-muted">{{ c.welcomeText }}</p>
    </div>

    <UCard v-if="c.wifiSsid || c.wifiPassword">
      <template #header><span class="flex items-center gap-2 font-medium"><UIcon name="i-lucide-wifi" /> Wi-Fi</span></template>
      <p v-if="c.wifiSsid" class="text-sm">Réseau : <b class="font-mono">{{ c.wifiSsid }}</b></p>
      <p v-if="c.wifiPassword" class="text-sm">Mot de passe : <b class="font-mono">{{ c.wifiPassword }}</b></p>
    </UCard>

    <UCard v-for="s in sections" :key="s.key" v-show="c[s.key]">
      <template #header><span class="flex items-center gap-2 font-medium"><UIcon :name="s.icon" /> {{ s.label }}</span></template>
      <p class="whitespace-pre-line text-sm">{{ c[s.key] }}</p>
    </UCard>

    <p v-if="empty" class="py-12 text-center text-sm text-muted">Le livret de ce logement n'a pas encore été rempli.</p>
  </div>
  <div v-else class="pt-12 text-center text-muted">Lien invalide.</div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'bare' })
const route = useRoute()
const { data } = await useFetch(`/api/g/${route.params.token}`)
if (import.meta.server && !data.value) setResponseStatus(useRequestEvent()!, 404)
const c = computed(() => data.value?.content ?? {} as Record<string, string>)
const sections = [
  { key: 'checkinInfo', label: 'Arrivée', icon: 'i-lucide-log-in' },
  { key: 'checkoutInfo', label: 'Départ', icon: 'i-lucide-log-out' },
  { key: 'accessDirections', label: 'Accès', icon: 'i-lucide-map-pin' },
  { key: 'houseRules', label: 'Règlement intérieur', icon: 'i-lucide-list-checks' },
  { key: 'localTips', label: 'Conseils du quartier', icon: 'i-lucide-compass' },
  { key: 'faq', label: 'Questions fréquentes', icon: 'i-lucide-circle-help' },
] as const
const empty = computed(() => !!data.value && !c.value.wifiSsid && !c.value.welcomeText && sections.every(s => !c.value[s.key]))
</script>
