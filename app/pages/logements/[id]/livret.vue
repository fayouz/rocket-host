<template>
  <div v-if="data" class="space-y-3">
    <h2 class="section-title !mt-0">{{ t('manage.livret.title') }}</h2>
    <template v-if="pms">
      <PmsLivretCard :logement-id="String(route.params.id)" />
      <p class="text-xs text-muted">{{ t('manage.livret.legacy') }}</p>
    </template>
    <UTabs v-model="tab" :items="tabs" :content="false" />

    <!-- ONGLET LIVRET ACCUEIL -->
    <template v-if="tab === 'accueil'">
      <p class="text-sm text-muted">{{ t('manage.livret.intro') }}</p>
      <p class="text-sm text-muted"><i18n-t keypath="manage.livret.bgNote" tag="span"><template #tab><b>{{ t('manage.livret.tabTv') }}</b></template></i18n-t></p>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-3 lg:col-span-2">
          <UCard>
            <template #header><b>{{ t('manage.livret.linkTitle') }}</b></template>
            <div class="flex flex-wrap items-center gap-3">
              <img :src="qrUrl" :alt="t('manage.livret.qrAlt')" class="size-32 rounded bg-white p-1">
              <div class="min-w-0 flex-1 space-y-2">
                <UInput :model-value="link" readonly class="w-full font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
                <div class="flex flex-wrap gap-2">
                  <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-copy" :label="copied ? t('manage.livret.copied') : t('manage.livret.copyLink')" @click="copy" />
                  <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-eye" :label="t('manage.livret.preview')" :to="link" external target="_blank" />
                  <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :label="t('manage.livret.regen')" @click="regenerate" />
                </div>
                <p class="text-xs text-muted">{{ t('manage.livret.regenNote') }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header><b>Wi-Fi</b></template>
            <div class="grid gap-2 sm:grid-cols-2">
              <UFormField :label="t('manage.livret.ssid')"><UInput v-model="form.wifiSsid" class="w-full" /></UFormField>
              <UFormField :label="t('manage.livret.password')"><UInput v-model="form.wifiPassword" class="w-full" /></UFormField>
            </div>
          </UCard>

          <UCard v-for="s in sections" :key="s.key">
            <template #header><b>{{ s.label }}</b></template>
            <p class="mb-2 text-xs text-muted">{{ s.hint }}</p>
            <UTextarea v-model="(form as any)[s.key]" :rows="s.rows" class="w-full" :placeholder="s.placeholder" />
          </UCard>

          <div class="sticky bottom-4 flex items-center gap-2">
            <UButton icon="i-lucide-save" :label="t('manage.livret.save')" :loading="busy" @click="save" />
            <span v-if="saved" class="text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> {{ t('manage.livret.saved') }}</span>
            <span v-if="error" class="text-sm text-error">{{ error }}</span>
          </div>
        </div>

        <div class="lg:col-span-1">
          <UCard class="lg:sticky lg:top-4" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header><b>{{ t('manage.livret.preview') }}</b></template>
            <div class="livret-preview-frame overflow-hidden bg-black">
              <iframe :src="livretPreviewLink" class="livret-preview-iframe" :title="t('manage.livret.previewTitle')" />
            </div>
            <div class="flex flex-wrap gap-2 p-3">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-refresh-cw" :label="t('manage.livret.refresh')" @click="livretPreviewKey++" />
            </div>
          </UCard>
        </div>
      </div>
    </template>

    <!-- ONGLET RÈGLEMENT INTÉRIEUR -->
    <template v-else-if="tab === 'reglement'">
      <p class="text-sm text-muted">{{ t('manage.livret.rulesIntro', { tag: rentalRulesTag }) }}</p>

      <UCard>
        <UTextarea v-model="form.houseRules" :rows="10" class="w-full" :placeholder="t('manage.livret.rulesPh')" />
      </UCard>

      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-save" :label="t('manage.livret.save')" :loading="busy" @click="save" />
        <span v-if="saved" class="text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> {{ t('manage.livret.saved') }}</span>
        <span v-if="error" class="text-sm text-error">{{ error }}</span>
      </div>
    </template>

    <!-- ONGLET ÉCRAN TV -->
    <template v-else>
      <p class="text-sm text-muted"><i18n-t keypath="manage.livret.tvIntro" tag="span"><template #code><code>docs/ecran-tv-android.md</code></template></i18n-t></p>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <UCard>
            <template #header><b>{{ t('manage.livret.tvLinkTitle') }}</b></template>
            <div class="flex items-center gap-2">
              <UInput :model-value="tvLinkBase" readonly class="w-full font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-copy" :label="tvCopied ? t('manage.livret.copied') : t('manage.livret.copy')" @click="copyTv" />
            </div>
            <p class="mt-2 text-xs text-muted">{{ t('manage.livret.tvLinkNote') }}</p>
          </UCard>

          <UCard>
            <template #header><b>{{ t('manage.livret.layout') }}</b></template>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField :label="t('manage.livret.nav')">
                <USelect :model-value="data.layout.navMode" :items="navItems" class="w-full" @update:model-value="setLayout($event, data.layout.gridColumns, data.layout.tvColumns)" />
              </UFormField>
              <UFormField :label="t('manage.livret.gridLayout')">
                <USelect :model-value="data.layout.gridColumns" :items="colItems" class="w-full" @update:model-value="setLayout(data.layout.navMode, $event, data.layout.tvColumns)" />
              </UFormField>
              <UFormField :label="t('manage.livret.tvLayout')">
                <USelect :model-value="data.layout.tvColumns" :items="colItems" class="w-full" @update:model-value="setLayout(data.layout.navMode, data.layout.gridColumns, $event)" />
              </UFormField>
            </div>
            <p class="mt-2 text-xs text-muted">{{ t('manage.livret.tabsNote') }}</p>
          </UCard>

          <UCard>
            <template #header><b>{{ t('manage.livret.bgTitle') }}</b></template>
            <p class="text-sm text-muted">{{ t('manage.livret.bgIntro') }}</p>

            <div class="mt-2 rounded-lg border border-default p-3 text-sm">
              <template v-if="data.background.mode === 'custom'">
                <p>{{ t('manage.livret.bgCustom') }}
                  <UButton size="xs" color="neutral" variant="link" :label="t('manage.livret.bgBack')" @click="setMode('inherit')" />
                </p>
              </template>
              <template v-else-if="data.background.mode === 'none'">
                <p>{{ t('manage.livret.bgNone') }}
                  <UButton size="xs" color="neutral" variant="link" :label="t('manage.livret.bgBack')" @click="setMode('inherit')" />
                </p>
              </template>
              <template v-else>
                <p v-if="data.hasDefaultBackground">{{ t('manage.livret.bgInherit') }}
                  <UButton size="xs" color="neutral" variant="link" :label="t('manage.livret.bgForceNone')" @click="setMode('none')" />
                </p>
                <p v-else>{{ t('manage.livret.bgPlain') }}</p>
              </template>
            </div>

            <div v-if="data.background.hasFile || data.background.webUrl" class="mt-3 flex items-center gap-3">
              <img :src="backgroundPreviewUrl" :alt="t('manage.livret.bgAlt')" class="h-20 w-32 rounded object-cover ring ring-default">
              <p v-if="data.background.attribution" class="text-xs text-muted">{{ data.background.attribution }}</p>
            </div>

            <UCheckbox class="mt-3" :model-value="data.background.animated" :label="t('manage.livret.animated')" @update:model-value="setAnimated" />

            <div class="mt-4 space-y-3">
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-image-up" :label="t('manage.livret.upload')" :loading="bgBusy" @click="fileInput?.click()" />
              <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadBackground">
              <BackgroundSearchGrid :search-url="`/api/logements/${route.params.id}/livret/search`" @pick="pickWeb" />
            </div>
            <p v-if="bgError" class="mt-2 text-sm text-error">{{ bgError }}</p>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <b>{{ t('manage.livret.pages') }}</b>
                <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plus" :label="t('manage.livret.addPage')" @click="addPage" />
              </div>
            </template>
            <p class="text-sm text-muted">{{ t('manage.livret.pagesNote') }}</p>
            <p class="mt-1 text-xs text-muted"><i18n-t keypath="manage.livret.pageBgNote" tag="span"><template #icon><UIcon name="i-lucide-image" class="align-middle" /></template></i18n-t></p>

            <div class="mt-3 space-y-3">
              <div v-for="(page, pi) in data.pages" :key="page.id" class="rounded-lg border border-default p-3">
                <div class="flex items-center gap-2">
                  <UInput :model-value="page.label" class="flex-1" :placeholder="t('manage.livret.pageName')" @change="renamePageLabel(page, ($event.target as HTMLInputElement).value)" />
                  <UButton
                    size="xs" color="neutral" :variant="hasPageBg(page) ? 'soft' : 'ghost'" icon="i-lucide-image"
                    :title="hasPageBg(page) ? t('manage.livret.customBg') : t('manage.livret.setBg')" @click="openPageBg(page)"
                  />
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-up" :disabled="pi === 0" @click="movePage(pi, -1)" />
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-down" :disabled="pi === data.pages.length - 1" @click="movePage(pi, 1)" />
                  <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="data.pages.length <= 1" :title="t('manage.livret.deletePage')" @click="removePage(page)" />
                </div>
                <ul class="mt-2 divide-y divide-default">
                  <li v-for="w in WIDGET_CATALOG" :key="w.id" class="flex items-center gap-2 py-1.5 text-sm">
                    <UCheckbox :model-value="page.widgets.includes(w.id)" @update:model-value="assignWidget(w.id, page, $event)" />
                    <UIcon :name="w.icon" class="size-4 text-muted" />
                    <span class="flex-1" :class="{ 'text-muted': !page.widgets.includes(w.id) }">{{ t(w.labelKey) }}</span>
                    <span v-if="widgetPageLabel(w.id) && widgetPageLabel(w.id) !== page.label" class="text-xs text-muted">{{ t('manage.livret.alreadyIn', { page: widgetPageLabel(w.id) }) }}</span>
                    <template v-if="page.widgets.includes(w.id)">
                      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-up" :disabled="page.widgets[0] === w.id" @click="moveWidgetInPage(page, w.id, -1)" />
                      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-down" :disabled="page.widgets[page.widgets.length - 1] === w.id" @click="moveWidgetInPage(page, w.id, 1)" />
                    </template>
                  </li>
                </ul>
              </div>
            </div>
          </UCard>
        </div>

        <div class="lg:col-span-1">
          <UCard class="lg:sticky lg:top-4" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header><b>{{ t('manage.livret.preview') }}</b></template>
            <div ref="tvFrameEl" class="tv-preview-frame overflow-hidden bg-black">
              <iframe :src="tvLink" class="tv-preview-iframe" :style="{ transform: `scale(${tvPreviewScale})` }" :title="t('manage.livret.tvPreviewTitle')" />
            </div>
            <div class="flex flex-wrap gap-2 p-3">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-refresh-cw" :label="t('manage.livret.refresh')" @click="tvPreviewKey++" />
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-expand" :label="t('manage.livret.fullscreen')" :to="tvLink" external target="_blank" />
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </div>

  <UModal v-model:open="pageBgOpen" :title="t('manage.livret.pageBgTitle', { page: pageBgLabel })">
    <template #body>
      <div class="space-y-3">
        <p class="text-xs text-muted">{{ t('manage.livret.pageBgIntro') }}</p>
        <div v-if="pageBgPreviewUrl" class="flex items-center gap-3">
          <img :src="pageBgPreviewUrl" :alt="t('manage.livret.pageBgAlt')" class="h-20 w-32 rounded object-cover ring ring-default">
          <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :label="t('manage.livret.remove')" :loading="pageBgBusy" @click="removePageBg" />
        </div>
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-upload" :label="t('manage.livret.upload')" :loading="pageBgBusy" @click="pageBgFileInput?.click()" />
        <input ref="pageBgFileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadPageBg">
        <BackgroundSearchGrid :search-url="`/api/logements/${route.params.id}/livret/search`" @pick="pickPageBgWeb" />
        <p v-if="pageBgError" class="text-sm text-error">{{ pageBgError }}</p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const pms = useState<boolean>('pms', () => false)
const router = useRouter()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/livret`, { key: `livret-${route.params.id}` })

const tabs = computed(() => [
  { label: t('manage.livret.title'), icon: 'i-lucide-book-heart', value: 'accueil' },
  { label: t('manage.livret.tabRules'), icon: 'i-lucide-list-checks', value: 'reglement' },
  { label: t('manage.livret.tabTv'), icon: 'i-lucide-tv', value: 'tv' },
])
const tab = ref<string>(typeof route.query.onglet === 'string' && tabs.value.some(x => x.value === route.query.onglet) ? route.query.onglet : 'accueil')
watch(tab, (v) => { router.replace({ query: { ...route.query, onglet: v } }) })

const sections = computed(() => [
  { key: 'welcomeText', label: t('manage.livret.sWelcome'), hint: t('manage.livret.sWelcomeHint'), rows: 3, placeholder: t('manage.livret.sWelcomePh') },
  { key: 'checkinInfo', label: t('manage.livret.sCheckin'), hint: t('manage.livret.sCheckinHint'), rows: 4, placeholder: t('manage.livret.sCheckinPh') },
  { key: 'checkoutInfo', label: t('manage.livret.sCheckout'), hint: t('manage.livret.sCheckoutHint'), rows: 4, placeholder: t('manage.livret.sCheckoutPh') },
  { key: 'accessDirections', label: t('manage.livret.sAccess'), hint: t('manage.livret.sAccessHint'), rows: 4, placeholder: '' },
  { key: 'localTips', label: t('manage.livret.sTips'), hint: t('manage.livret.sTipsHint'), rows: 5, placeholder: '' },
  { key: 'faq', label: t('manage.livret.sFaq'), hint: '', rows: 5, placeholder: '' },
])

const form = reactive({ wifiSsid: '', wifiPassword: '', welcomeText: '', checkinInfo: '', checkoutInfo: '', accessDirections: '', localTips: '', faq: '', houseRules: '' })
// once: true — sinon un refresh() declenche par une action sans rapport (fond, mise en page, widgets, sur l'autre
// onglet) reecrase silencieusement une saisie texte pas encore enregistree (ex. reglement interieur en cours de frappe).
watch(() => data.value?.content, (c) => { if (c) Object.assign(form, c) }, { immediate: true, once: true })
const rentalRulesTag = '{{RentalRules}}'

const origin = useRequestURL().origin
const link = computed(() => data.value ? `${origin}/g/${data.value.token}` : '')
const livretPreviewKey = ref(0)
const livretPreviewLink = computed(() => livretPreviewKey.value ? `${link.value}?v=${livretPreviewKey.value}` : link.value)
const tvLinkBase = computed(() => data.value ? `${origin}/tv/${data.value.token}` : '')
const tvPreviewKey = ref(0)
const tvLink = computed(() => tvPreviewKey.value ? `${tvLinkBase.value}?v=${tvPreviewKey.value}` : tvLinkBase.value)
// L'aperçu (encart 1/3 large) n'a plus une largeur garantie (avant : colonne fixe 480px) : l'échelle de l'iframe
// (rendue à sa taille réelle 1920x1080 puis réduite visuellement) s'ajuste à la largeur du cadre plutôt qu'un
// facteur fixe, pour ne pas être rognée quand la colonne est plus étroite que 480px.
const tvFrameEl = ref<HTMLElement>()
const tvPreviewScale = ref(0.25)
if (import.meta.client) {
  const updateScale = () => { if (tvFrameEl.value) tvPreviewScale.value = tvFrameEl.value.clientWidth / 1920 }
  const ro = new ResizeObserver(updateScale)
  onMounted(() => { if (tvFrameEl.value) ro.observe(tvFrameEl.value) })
  onUnmounted(() => ro.disconnect())
}
// Les deux aperçus (livret mobile, écran TV) doivent se recharger tout seuls après un enregistrement (contenu, fond,
// mise en page, widgets) : sinon ils restent figés sur l'état d'avant tant qu'on ne clique pas "Rafraîchir" à la main.
function bumpPreviews() { livretPreviewKey.value++; tvPreviewKey.value++ }
const qrUrl = computed(() => `/api/logements/${route.params.id}/livret/qr`)
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(link.value); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { /* copie manuelle possible */ } }
const tvCopied = ref(false)
async function copyTv() { try { await navigator.clipboard.writeText(tvLinkBase.value); tvCopied.value = true; setTimeout(() => { tvCopied.value = false }, 2000) } catch { /* copie manuelle possible */ } }
async function regenerate() {
  if (!confirm(t('manage.livret.confirmRegen'))) return
  await $fetch(`/api/logements/${route.params.id}/livret/token`, { method: 'POST' })
  await refresh()
}

const fileInput = ref<HTMLInputElement>()
const bgVersion = ref(0)
const backgroundPreviewUrl = computed(() => {
  if (!data.value) return ''
  if (data.value.background.hasFile) return `/api/g/${data.value.token}/background?v=${bgVersion.value}`
  return data.value.background.webUrl
})
const bgBusy = ref(false)
const bgError = ref('')
async function uploadBackground(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  bgBusy.value = true; bgError.value = ''
  try {
    const body = new FormData(); body.append('file', file)
    await $fetch(`/api/logements/${route.params.id}/livret/background`, { method: 'POST', body })
  } catch (err: any) { bgError.value = err?.data?.statusMessage || t('manage.livret.failed') }
  bgBusy.value = false
  if (fileInput.value) fileInput.value.value = ''
  bgVersion.value++
  await refresh()
  bumpPreviews()
}
async function pickWeb(r: { url: string; attribution: string }) {
  bgBusy.value = true; bgError.value = ''
  try { await $fetch(`/api/logements/${route.params.id}/livret/background-web`, { method: 'PUT', body: { url: r.url, attribution: r.attribution } }) }
  catch (err: any) { bgError.value = err?.data?.statusMessage || t('manage.livret.failed') }
  bgBusy.value = false
  bgVersion.value++
  await refresh()
  bumpPreviews()
}
async function setMode(mode: 'inherit' | 'none') {
  bgBusy.value = true
  try { await $fetch(`/api/logements/${route.params.id}/livret/background-mode`, { method: 'PUT', body: { mode } }) }
  finally { bgBusy.value = false }
  bgVersion.value++
  await refresh()
  bumpPreviews()
}
async function setAnimated(animated: boolean) {
  await $fetch(`/api/logements/${route.params.id}/livret/animated`, { method: 'PUT', body: { animated } })
  await refresh()
  bumpPreviews()
}

// Pages (regroupement de widgets) : chaque action ecrit au serveur puis rafraichit data.value.pages en entier
// (pas d'etat local separe a resynchroniser, plus simple qu'avant avec le widgetOrder a plat).
type Page = NonNullable<typeof data.value>['pages'][number]
async function addPage() {
  await $fetch(`/api/logements/${route.params.id}/livret/pages`, { method: 'POST', body: { label: t('manage.livret.newPage'), icon: 'i-lucide-file' } })
  await refresh()
  bumpPreviews()
}
async function renamePageLabel(page: Page, label: string) {
  if (!label.trim() || label === page.label) return
  await $fetch(`/api/logements/${route.params.id}/livret/pages/${page.id}`, { method: 'PUT', body: { label, icon: page.icon } })
  await refresh()
  bumpPreviews()
}
async function movePage(pi: number, dir: -1 | 1) {
  if (!data.value) return
  const order = data.value.pages.map(p => p.id)
  const j = pi + dir
  if (j < 0 || j >= order.length) return
  ;[order[pi], order[j]] = [order[j]!, order[pi]!]
  await $fetch(`/api/logements/${route.params.id}/livret/pages-order`, { method: 'PUT', body: { order } })
  await refresh()
  bumpPreviews()
}
async function removePage(page: Page) {
  if (!confirm(t('manage.livret.confirmDeletePage', { page: page.label }))) return
  await $fetch(`/api/logements/${route.params.id}/livret/pages/${page.id}`, { method: 'DELETE' })
  await refresh()
  bumpPreviews()
}
function widgetPageLabel(widgetId: string) {
  return data.value?.pages.find(p => p.widgets.includes(widgetId))?.label ?? ''
}
async function assignWidget(widgetId: string, page: Page, on: boolean) {
  await $fetch(`/api/logements/${route.params.id}/livret/widgets/${widgetId}/page`, { method: 'PUT', body: { pageId: on ? page.id : null } })
  await refresh()
  bumpPreviews()
}
async function moveWidgetInPage(page: Page, widgetId: string, dir: -1 | 1) {
  const i = page.widgets.indexOf(widgetId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= page.widgets.length) return
  const order = [...page.widgets]
  ;[order[i], order[j]] = [order[j]!, order[i]!]
  await $fetch(`/api/logements/${route.params.id}/livret/pages/${page.id}/widgets-order`, { method: 'PUT', body: { order } })
  await refresh()
  bumpPreviews()
}

// Fond par page (carrousel) : un seul jeu de champs/modale reutilise pour la page en cours d'edition (pageBgId).
const pageBgId = ref<number | null>(null)
const pageBgOpen = ref(false)
const pageBgBusy = ref(false)
const pageBgError = ref('')
const pageBgFileInput = ref<HTMLInputElement>()
const pageBgVersion = ref(0)
function hasPageBg(page: Page) { return page.hasFile || !!page.webUrl }
const pageBgLabel = computed(() => data.value?.pages.find(p => p.id === pageBgId.value)?.label ?? '')
const pageBgPreviewUrl = computed(() => {
  if (!data.value || pageBgId.value === null) return ''
  const p = data.value.pages.find(p => p.id === pageBgId.value)
  if (!p) return ''
  if (p.hasFile) return `/api/g/${data.value.token}/pages/${pageBgId.value}/background?v=${pageBgVersion.value}`
  return p.webUrl
})
function openPageBg(page: Page) {
  pageBgId.value = page.id
  pageBgError.value = ''
  pageBgOpen.value = true
}
async function uploadPageBg(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || pageBgId.value === null) return
  pageBgBusy.value = true; pageBgError.value = ''
  try {
    const body = new FormData(); body.append('file', file)
    await $fetch(`/api/logements/${route.params.id}/livret/pages/${pageBgId.value}/background`, { method: 'POST', body })
  } catch (err: any) { pageBgError.value = err?.data?.statusMessage || t('manage.livret.failed') }
  pageBgBusy.value = false
  if (pageBgFileInput.value) pageBgFileInput.value.value = ''
  pageBgVersion.value++
  await refresh()
  bumpPreviews()
}
async function pickPageBgWeb(r: { url: string; attribution: string }) {
  if (pageBgId.value === null) return
  pageBgBusy.value = true; pageBgError.value = ''
  try { await $fetch(`/api/logements/${route.params.id}/livret/pages/${pageBgId.value}/background-web`, { method: 'PUT', body: { url: r.url, attribution: r.attribution } }) }
  catch (err: any) { pageBgError.value = err?.data?.statusMessage || t('manage.livret.failed') }
  pageBgBusy.value = false
  await refresh()
  bumpPreviews()
}
async function removePageBg() {
  if (pageBgId.value === null) return
  pageBgBusy.value = true
  try { await $fetch(`/api/logements/${route.params.id}/livret/pages/${pageBgId.value}/background`, { method: 'DELETE' }) }
  finally { pageBgBusy.value = false }
  await refresh()
  bumpPreviews()
}

const navItems = computed(() => [{ label: t('manage.livret.navScroll'), value: 'scroll' }, { label: t('manage.livret.navTabs'), value: 'tabs' }])
const colItems = computed(() => [{ label: t('manage.livret.col1'), value: 1 }, { label: t('manage.livret.col2'), value: 2 }])
async function setLayout(navMode: unknown, gridColumns: unknown, tvColumns: unknown) {
  await $fetch(`/api/logements/${route.params.id}/livret/layout`, { method: 'PUT', body: { navMode, gridColumns, tvColumns } })
  await refresh()
  bumpPreviews()
}

const busy = ref(false)
const saved = ref(false)
const error = ref('')
async function save() {
  busy.value = true; error.value = ''; saved.value = false
  try {
    await $fetch(`/api/logements/${route.params.id}/livret`, { method: 'PUT', body: { ...form } })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e: any) { error.value = e?.data?.statusMessage || t('manage.livret.failed') }
  busy.value = false
  await refresh()
  bumpPreviews()
}
</script>

<style scoped>
/* Aperçu réduit de l'écran TV (1920x1080 mis à l'échelle) sans avoir à ouvrir un nouvel onglet */
.tv-preview-frame {
  width: 100%;
  aspect-ratio: 1920 / 1080;
  max-width: 480px;
}
.tv-preview-iframe {
  width: 1920px;
  height: 1080px;
  border: 0;
  transform-origin: top left;
}

/* Aperçu réduit du livret mobile (format téléphone, 375x660 mis à l'échelle) */
.livret-preview-frame {
  width: 100%;
  aspect-ratio: 260 / 460;
  max-width: 260px;
  margin: 0 auto;
}
.livret-preview-iframe {
  width: 375px;
  height: 660px;
  border: 0;
  transform: scale(0.6933);
  transform-origin: top left;
}
</style>
