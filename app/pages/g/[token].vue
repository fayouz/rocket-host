<template>
  <div v-if="data" class="relative min-h-screen overflow-hidden">
    <Transition name="bg-fade">
      <div v-if="pageLevelBackground" :key="pageLevelBackground.url" class="absolute inset-0 bg-cover bg-center" :class="{ 'bg-kenburns': pageLevelBackground.animated }" :style="{ backgroundImage: `url(${pageLevelBackground.url})` }" />
    </Transition>
    <div v-if="pageLevelBackground" class="absolute inset-0 bg-black/40" />
    <div class="relative mx-auto max-w-lg space-y-4 px-4 py-6" :class="{ 'text-white': pageLevelBackground }">
      <div class="text-center">
        <h1 class="text-2xl font-semibold">{{ t.welcomeTo }} {{ data.logement }}</h1>
        <p v-if="c.welcomeText" class="mt-2 whitespace-pre-line" :class="pageLevelBackground ? 'text-white/80' : 'text-muted'">{{ c.welcomeText }}</p>
      </div>

      <template v-if="data.layout.navMode === 'tabs'">
        <UCarousel
          v-if="visiblePages.length" ref="carouselRef" :items="visiblePages" dots
          :ui="{ item: 'basis-full', dots: 'mt-3', dot: pageLevelBackground ? 'bg-white/30 data-[state=active]:bg-white' : undefined }"
          class="pb-20" @select="onSelect"
        >
          <template #default="{ item: page }">
            <div class="space-y-3">
              <GuestWidgetCard
                v-for="id in page.widgets" :id="id" :key="id" :content="c" :weather="data.weather" :devices="devices"
                :card-ui="pageLevelBackground ? CARD_UI_DARK : {}" :busy="busy" :dark="!!pageLevelBackground" @send="send"
              />
            </div>
          </template>
        </UCarousel>

        <!-- Barre de navigation fixe (icônes), pour sauter directement à une page sans balayer -->
        <div v-if="visiblePages.length > 1" class="fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <div class="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-gray-900/80 p-1.5 text-white backdrop-blur-xl">
            <button
              v-for="(page, i) in visiblePages" :key="page.id" type="button"
              class="flex shrink-0 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] transition-colors"
              :class="i === activeIndex ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'"
              :aria-current="i === activeIndex || undefined"
              @click="goTo(i)"
            >
              <UIcon :name="page.icon" class="size-4" />
              <span class="whitespace-nowrap">{{ page.label }}</span>
            </button>
          </div>
        </div>
      </template>

      <div v-else class="space-y-4">
        <section v-for="page in visiblePages" :key="page.id" class="overflow-hidden rounded-2xl" :class="{ relative: pageBg(page) }">
          <div v-if="pageBg(page)" class="absolute inset-0 bg-cover bg-center" :class="{ 'bg-kenburns': pageBg(page)!.animated }" :style="{ backgroundImage: `url(${pageBg(page)!.url})` }" />
          <div v-if="pageBg(page)" class="absolute inset-0 bg-black/40" />
          <div class="relative space-y-3 p-3" :class="{ 'text-white': pageBg(page) }">
            <h2 v-if="visiblePages.length > 1" class="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide" :class="pageBg(page) ? 'text-white/80' : 'text-muted'">
              <UIcon :name="page.icon" class="size-4" /> {{ page.label }}
            </h2>
            <div class="grid gap-4" :class="data.layout.gridColumns === 2 ? 'grid-cols-2' : 'grid-cols-1'">
              <GuestWidgetCard
                v-for="id in page.widgets" :id="id" :key="id" :content="c" :weather="data.weather" :devices="devices"
                :card-ui="pageBg(page) ? CARD_UI_DARK : {}" :busy="busy" :dark="!!pageBg(page)" @send="send"
              />
            </div>
          </div>
        </section>
      </div>

      <p v-if="empty" class="py-12 text-center text-sm" :class="pageLevelBackground ? 'text-white/70' : 'text-muted'">{{ t.empty }}</p>
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
const CARD_UI_DARK = { root: 'bg-white/10 backdrop-blur-xl ring-white/20 text-white' }

// --- Domotique mise à disposition (V3) ---
interface DeviceCtrl { capabilityId: string; kind: 'onoff' | 'dim' | 'target_temperature'; value: unknown; min?: number; max?: number; units: string | null }
interface DeviceView { id: string; name: string; class: string; available: boolean; controls: DeviceCtrl[]; info: { title: string; value: unknown; units: string | null }[] }
const { data: devicesData, refresh: refreshDevices } = await useFetch<{ devices: DeviceView[] }>(`/api/g/${route.params.token}/devices`)
const devices = computed(() => devicesData.value?.devices ?? [])
const busy = reactive<Record<string, boolean>>({})
async function send(deviceId: string, capabilityId: string, value: unknown) {
  busy[deviceId] = true
  try { await $fetch(`/api/g/${route.params.token}/devices/${deviceId}`, { method: 'PUT', body: { capabilityId, value } }) }
  catch { /* la commande a echoue : l'affichage revient a l'etat reel au prochain rafraichissement */ }
  busy[deviceId] = false
  await refreshDevices()
}

// Widget a du contenu ? (meme logique que GuestWidgetCard.vue, dupliquee ici car necessaire au niveau de la page
// pour savoir quels widgets/pages afficher et si le livret est vide)
const SECTION_KEYS: Record<string, string> = { checkin: 'checkinInfo', checkout: 'checkoutInfo', access: 'accessDirections', rules: 'houseRules', tips: 'localTips', faq: 'faq' }
function hasContent(id: string) {
  if (id === 'weather') return !!data.value?.weather
  if (id === 'wifi') return !!(c.value.wifiSsid || c.value.wifiPassword)
  if (id === 'devices') return devices.value.length > 0
  return !!c.value[SECTION_KEYS[id] ?? '']
}
// Pages avec au moins un widget ayant du contenu (une page vide de contenu ne s'affiche pas), widgets filtres pareil.
const visiblePages = computed(() => (data.value?.pages ?? [])
  .map(p => ({ ...p, widgets: p.widgets.filter(hasContent) }))
  .filter(p => p.widgets.length > 0))
const empty = computed(() => !!data.value && !c.value.welcomeText && !visiblePages.value.length)
function pageBg(page: { id: number }) { return data.value?.pageBackgrounds?.[page.id] ?? null }

// --- Navigation par carrousel (option, livret mobile seulement) : balayage tactile + barre de navigation fixe ---
const carouselRef = ref<{ emblaApi?: { scrollTo: (i: number) => void } } | null>(null)
const activeIndex = ref(0)
watch(visiblePages, () => { activeIndex.value = 0; carouselRef.value?.emblaApi?.scrollTo(0) }) // nouvelle liste (page ajoutee/retiree) : repart au debut
function onSelect(i: number) { activeIndex.value = i }

// Fond affiche en arriere-plan de toute la page : en mode carrousel, celui de la page active (surcharge par page si
// definie, sinon fond du logement) ; en mode defilement, uniquement le fond du logement (chaque page peut avoir en
// plus son propre fond local dans sa propre section, voir pageBg ci-dessus, sans remplacer ce fond de page globale).
const pageLevelBackground = computed(() => {
  if (!data.value) return null
  if (data.value.layout.navMode !== 'tabs') return data.value.background
  const page = visiblePages.value[activeIndex.value]
  return (page && pageBg(page)) || data.value.background
})
function goTo(i: number) { carouselRef.value?.emblaApi?.scrollTo(i) }
</script>

<style scoped>
.bg-fade-enter-active, .bg-fade-leave-active { transition: opacity 0.4s ease; }
.bg-fade-enter-from, .bg-fade-leave-to { opacity: 0; }
.bg-fade-leave-active { position: absolute; inset: 0; }
</style>
