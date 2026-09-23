<template>
  <div v-if="data" class="relative min-h-screen overflow-hidden">
    <div v-if="data.background" class="absolute inset-0 bg-cover bg-center" :class="{ 'bg-kenburns': data.background.animated }" :style="{ backgroundImage: `url(${data.background.url})` }" />
    <div v-if="data.background" class="absolute inset-0 bg-black/40" />
    <div class="relative mx-auto max-w-lg space-y-4 px-4 py-6" :class="{ 'text-white': data.background }">
      <div class="text-center">
        <h1 class="text-2xl font-semibold">{{ t.welcomeTo }} {{ data.logement }}</h1>
        <p v-if="c.welcomeText" class="mt-2 whitespace-pre-line" :class="data.background ? 'text-white/80' : 'text-muted'">{{ c.welcomeText }}</p>
      </div>

      <template v-if="data.layout.navMode === 'tabs'">
        <UCarousel
          v-if="visibleWidgets.length" ref="carouselRef" :items="visibleWidgets" dots
          :ui="{ item: 'basis-full', dots: 'mt-3', dot: data.background ? 'bg-white/30 data-[state=active]:bg-white' : undefined }"
          class="pb-20" @select="onSelect"
        >
          <template #default="{ item }">
            <GuestWidgetCard :id="item" :content="c" :weather="data.weather" :devices="devices" :card-ui="cardUi" :busy="busy" :dark="!!data.background" @send="send" />
          </template>
        </UCarousel>

        <!-- Barre de navigation fixe (icônes), pour sauter directement à un widget sans balayer -->
        <div v-if="visibleWidgets.length > 1" class="fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <div class="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-gray-900/80 p-1.5 text-white backdrop-blur-xl">
            <button
              v-for="(id, i) in visibleWidgets" :key="id" type="button"
              class="flex shrink-0 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] transition-colors"
              :class="i === activeIndex ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'"
              @click="goTo(i)"
            >
              <UIcon :name="WIDGET_CATALOG.find(w => w.id === id)?.icon ?? 'i-lucide-circle'" class="size-4" />
              {{ widgetLabel(id) }}
            </button>
          </div>
        </div>
      </template>

      <div v-else class="grid gap-4" :class="data.layout.gridColumns === 2 ? 'grid-cols-2' : 'grid-cols-1'">
        <GuestWidgetCard v-for="id in data.widgetOrder" :id="id" :key="id" :content="c" :weather="data.weather" :devices="devices" :card-ui="cardUi" :busy="busy" :dark="!!data.background" @send="send" />
      </div>

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
const cardUi = computed(() => data.value?.background ? { root: 'bg-white/10 backdrop-blur-xl ring-white/20 text-white' } : {})

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
// pour construire la liste des onglets et savoir si le livret est vide)
const SECTION_KEYS: Record<string, string> = { checkin: 'checkinInfo', checkout: 'checkoutInfo', access: 'accessDirections', rules: 'houseRules', tips: 'localTips', faq: 'faq' }
function hasContent(id: string) {
  if (id === 'weather') return !!data.value?.weather
  if (id === 'wifi') return !!(c.value.wifiSsid || c.value.wifiPassword)
  if (id === 'devices') return devices.value.length > 0
  return !!c.value[SECTION_KEYS[id] ?? '']
}
const visibleWidgets = computed(() => (data.value?.widgetOrder ?? []).filter(hasContent))
const empty = computed(() => !!data.value && !c.value.welcomeText && !visibleWidgets.value.length)

// --- Navigation par carrousel (option, livret mobile seulement) : balayage tactile + barre de navigation fixe ---
const carouselRef = ref<{ emblaApi?: { scrollTo: (i: number) => void } } | null>(null)
const activeIndex = ref(0)
watch(visibleWidgets, () => { activeIndex.value = 0 }) // nouvelle liste (widget ajoute/retire) : repart au debut
function onSelect(i: number) { activeIndex.value = i }
function goTo(i: number) { carouselRef.value?.emblaApi?.scrollTo(i) }
</script>
