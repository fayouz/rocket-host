<template>
  <div v-if="data" class="space-y-3">
    <h2 class="section-title !mt-0">Livret Accueil</h2>
    <UTabs v-model="tab" :items="tabs" :content="false" />

    <!-- ONGLET LIVRET ACCUEIL -->
    <template v-if="tab === 'accueil'">
      <p class="text-sm text-muted">Une page pour le voyageur, sans compte à créer, accessible par lien ou QR code. Infos du logement seulement : pour personnaliser par séjour (code de porte, dates), voir plus tard.</p>
      <p class="text-sm text-muted">Fond, mise en page et widgets affichés se règlent dans l'onglet <b>Écran TV</b> (communs au livret et à l'écran TV).</p>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="space-y-3 lg:col-span-2">
          <UCard>
            <template #header><b>Lien du livret</b></template>
            <div class="flex flex-wrap items-center gap-3">
              <img :src="qrUrl" alt="QR code du livret" class="size-32 rounded bg-white p-1">
              <div class="min-w-0 flex-1 space-y-2">
                <UInput :model-value="link" readonly class="w-full font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
                <div class="flex flex-wrap gap-2">
                  <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-copy" :label="copied ? 'Copié' : 'Copier le lien'" @click="copy" />
                  <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-eye" label="Aperçu" :to="link" external target="_blank" />
                  <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" label="Régénérer le lien" @click="regenerate" />
                </div>
                <p class="text-xs text-muted">Régénérer invalide l'ancien lien immédiatement (utile si le QR affiché quelque part doit être remplacé) : le lien de l'écran TV change aussi.</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header><b>Wi-Fi</b></template>
            <div class="grid gap-2 sm:grid-cols-2">
              <UFormField label="Nom du réseau (SSID)"><UInput v-model="form.wifiSsid" class="w-full" /></UFormField>
              <UFormField label="Mot de passe"><UInput v-model="form.wifiPassword" class="w-full" /></UFormField>
            </div>
          </UCard>

          <UCard v-for="s in sections" :key="s.key">
            <template #header><b>{{ s.label }}</b></template>
            <p class="mb-2 text-xs text-muted">{{ s.hint }}</p>
            <UTextarea v-model="(form as any)[s.key]" :rows="s.rows" class="w-full" :placeholder="s.placeholder" />
          </UCard>

          <div class="sticky bottom-4 flex items-center gap-2">
            <UButton icon="i-lucide-save" label="Enregistrer" :loading="busy" @click="save" />
            <span v-if="saved" class="text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> Enregistré</span>
            <span v-if="error" class="text-sm text-error">{{ error }}</span>
          </div>
        </div>

        <div class="lg:col-span-1">
          <UCard class="lg:sticky lg:top-4" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header><b>Aperçu</b></template>
            <div class="livret-preview-frame overflow-hidden bg-black">
              <iframe :src="livretPreviewLink" class="livret-preview-iframe" title="Aperçu du livret" />
            </div>
            <div class="flex flex-wrap gap-2 p-3">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-refresh-cw" label="Rafraîchir" @click="livretPreviewKey++" />
            </div>
          </UCard>
        </div>
      </div>
    </template>

    <!-- ONGLET RÈGLEMENT INTÉRIEUR -->
    <template v-else-if="tab === 'reglement'">
      <p class="text-sm text-muted">Affiché automatiquement dans le livret d'accueil du logement. Pas de synchronisation possible avec Lodgify (son API ne donne accès ni en lecture ni en écriture au champ équivalent, {{ rentalRulesTag }}) : si vous voulez qu'il apparaisse aussi dans vos messages automatiques Lodgify, recopiez-le à la main dans Rentals &gt; Messaging placeholders.</p>

      <UCard>
        <UTextarea v-model="form.houseRules" :rows="10" class="w-full" placeholder="Non fumeur, pas de fête, horaires de calme…" />
      </UCard>

      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-save" label="Enregistrer" :loading="busy" @click="save" />
        <span v-if="saved" class="text-sm text-success"><UIcon name="i-lucide-check" class="align-middle" /> Enregistré</span>
        <span v-if="error" class="text-sm text-error">{{ error }}</span>
      </div>
    </template>

    <!-- ONGLET ÉCRAN TV -->
    <template v-else>
      <p class="text-sm text-muted">Même lien que le livret, en plein écran, pensé pour être ouvert sur la TV du logement (grand texte, voyageur du jour affiché s'il y en a un). Voir <code>docs/ecran-tv-android.md</code> pour installer Fully Kiosk Browser dessus. Le fond, la mise en page et les widgets ci-dessous s'appliquent aussi au livret mobile (onglet Livret Accueil).</p>

      <div class="grid gap-4 lg:grid-cols-[480px_1fr]">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header><b>Aperçu</b></template>
          <div class="tv-preview-frame overflow-hidden bg-black">
            <iframe :src="tvLink" class="tv-preview-iframe" title="Aperçu de l'écran TV" />
          </div>
          <div class="flex flex-wrap gap-2 p-4">
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-refresh-cw" label="Rafraîchir l'aperçu" @click="tvPreviewKey++" />
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-expand" label="Ouvrir en plein écran" :to="tvLink" external target="_blank" />
          </div>
        </UCard>

        <div class="space-y-4">
          <UCard>
            <template #header><b>Lien de l'écran TV</b></template>
            <div class="flex items-center gap-2">
              <UInput :model-value="tvLinkBase" readonly class="w-full font-mono text-xs" @focus="($event.target as HTMLInputElement).select()" />
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-copy" :label="tvCopied ? 'Copié' : 'Copier'" @click="copyTv" />
            </div>
            <p class="mt-2 text-xs text-muted">À coller dans l'URL de démarrage de Fully Kiosk Browser sur la TV. Change si le lien du livret est régénéré (onglet Livret Accueil).</p>
          </UCard>

          <UCard>
            <template #header><b>Mise en page</b></template>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Navigation (livret + écran TV)">
                <USelect :model-value="data.layout.navMode" :items="navItems" class="w-full" @update:model-value="setLayout($event, data.layout.gridColumns, data.layout.tvColumns)" />
              </UFormField>
              <UFormField label="Disposition (livret)">
                <USelect :model-value="data.layout.gridColumns" :items="colItems" class="w-full" @update:model-value="setLayout(data.layout.navMode, $event, data.layout.tvColumns)" />
              </UFormField>
              <UFormField label="Disposition (écran TV)">
                <USelect :model-value="data.layout.tvColumns" :items="colItems" class="w-full" @update:model-value="setLayout(data.layout.navMode, data.layout.gridColumns, $event)" />
              </UFormField>
            </div>
            <p class="mt-2 text-xs text-muted">En mode « Onglets », le livret et l'écran TV affichent un carrousel avec une barre de menu pour naviguer entre les widgets.</p>
          </UCard>
        </div>
      </div>

      <UCard>
        <template #header><b>Image de fond</b></template>
        <p class="text-sm text-muted">Affichée en fond du livret et de l'écran TV, avec les blocs en verre dépoli par-dessus.</p>

        <div class="mt-2 rounded-lg border border-default p-3 text-sm">
          <template v-if="data.background.mode === 'custom'">
            <p>Fond propre à ce logement.
              <UButton size="xs" color="neutral" variant="link" label="Revenir au fond général" @click="setMode('inherit')" />
            </p>
          </template>
          <template v-else-if="data.background.mode === 'none'">
            <p>Aucun fond, forcé pour ce logement (même si un fond général existe).
              <UButton size="xs" color="neutral" variant="link" label="Revenir au fond général" @click="setMode('inherit')" />
            </p>
          </template>
          <template v-else>
            <p v-if="data.hasDefaultBackground">Utilise le fond général des réglages.
              <UButton size="xs" color="neutral" variant="link" label="Forcer aucun fond ici" @click="setMode('none')" />
            </p>
            <p v-else>Pas de fond général réglé, et rien de propre à ce logement : fond uni.</p>
          </template>
        </div>

        <div v-if="data.background.hasFile || data.background.webUrl" class="mt-3 flex items-center gap-3">
          <img :src="backgroundPreviewUrl" alt="Fond actuel" class="h-20 w-32 rounded object-cover ring ring-default">
          <p v-if="data.background.attribution" class="text-xs text-muted">{{ data.background.attribution }}</p>
        </div>

        <UCheckbox class="mt-3" :model-value="data.background.animated" label="Fond animé (léger effet de zoom/travelling)" @update:model-value="setAnimated" />

        <div class="mt-4 space-y-3">
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-image-up" label="Déposer une image" :loading="bgBusy" @click="fileInput?.click()" />
          <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadBackground">
          <BackgroundSearchGrid :search-url="`/api/logements/${route.params.id}/livret/search`" @pick="pickWeb" />
        </div>
        <p v-if="bgError" class="mt-2 text-sm text-error">{{ bgError }}</p>
      </UCard>

      <UCard>
        <template #header><b>Widgets affichés</b></template>
        <p class="text-sm text-muted">Choisir lesquels apparaissent sur le livret et l'écran TV, et dans quel ordre. Un widget désactivé ici ne s'affiche jamais, même s'il a du contenu ; un widget activé ne s'affiche que s'il a du contenu (ex. Wi-Fi vide reste masqué).</p>
        <p class="mt-1 text-xs text-muted">En mode « Onglets », chaque widget peut avoir son propre fond (icône <UIcon name="i-lucide-image" class="align-middle" />) ; sans fond propre, il garde le fond du logement.</p>
        <ul class="mt-3 divide-y divide-default">
          <li v-for="w in displayList" :key="w.id" class="flex items-center gap-3 py-2">
            <UCheckbox :model-value="w.enabled" @update:model-value="toggleWidget(w.id, $event)" />
            <UIcon :name="w.icon" class="size-4 text-muted" />
            <span class="flex-1 text-sm" :class="{ 'text-muted': !w.enabled }">{{ w.label }}</span>
            <div v-if="w.enabled" class="flex items-center gap-1">
              <UButton
                size="xs" color="neutral" :variant="hasWidgetBg(w.id) ? 'soft' : 'ghost'" icon="i-lucide-image"
                :title="hasWidgetBg(w.id) ? 'Fond personnalisé' : 'Définir un fond pour ce widget'" @click="openWidgetBg(w.id)"
              />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-up" :disabled="w.isFirst" @click="move(w.id, -1)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-down" :disabled="w.isLast" @click="move(w.id, 1)" />
            </div>
          </li>
        </ul>
      </UCard>
    </template>
  </div>

  <UModal v-model:open="widgetBgOpen" :title="`Fond — ${widgetBgLabel}`">
    <template #body>
      <div class="space-y-3">
        <p class="text-xs text-muted">Remplace le fond du logement uniquement pour ce widget (mode « Onglets »). Sans fond propre, ce widget garde le fond du logement.</p>
        <div v-if="widgetBgPreviewUrl" class="flex items-center gap-3">
          <img :src="widgetBgPreviewUrl" alt="Fond du widget" class="h-20 w-32 rounded object-cover ring ring-default">
          <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" label="Retirer" :loading="widgetBgBusy" @click="removeWidgetBg" />
        </div>
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-upload" label="Déposer une image" :loading="widgetBgBusy" @click="widgetBgFileInput?.click()" />
        <input ref="widgetBgFileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadWidgetBg">
        <BackgroundSearchGrid :search-url="`/api/logements/${route.params.id}/livret/search`" @pick="pickWidgetBgWeb" />
        <p v-if="widgetBgError" class="text-sm text-error">{{ widgetBgError }}</p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/livret`, { key: `livret-${route.params.id}` })

const tabs = [
  { label: 'Livret Accueil', icon: 'i-lucide-book-heart', value: 'accueil' },
  { label: 'Règlement intérieur', icon: 'i-lucide-list-checks', value: 'reglement' },
  { label: 'Écran TV', icon: 'i-lucide-tv', value: 'tv' },
]
const tab = ref<string>(typeof route.query.onglet === 'string' && tabs.some(t => t.value === route.query.onglet) ? route.query.onglet : 'accueil')
watch(tab, (t) => { router.replace({ query: { ...route.query, onglet: t } }) })

const sections = [
  { key: 'welcomeText', label: 'Mot de bienvenue', hint: 'Affiché en haut de la page. Astuce : {{guest}} est remplacé par le prénom du voyageur en cours de séjour.', rows: 3, placeholder: 'Bienvenue chez nous {{guest}} !' },
  { key: 'checkinInfo', label: 'Arrivée', hint: 'Horaire habituel, comment entrer (au-delà du code, déjà géré ailleurs).', rows: 4, placeholder: 'Arrivée à partir de 15h. …' },
  { key: 'checkoutInfo', label: 'Départ', hint: 'Horaire limite, consignes (clés, poubelles…).', rows: 4, placeholder: 'Départ avant 11h. …' },
  { key: 'accessDirections', label: 'Accès', hint: 'Adresse, parking, digicode, étage…', rows: 4, placeholder: '' },
  { key: 'localTips', label: 'Conseils du quartier', hint: 'Boulangerie, restaurants, transports…', rows: 5, placeholder: '' },
  { key: 'faq', label: 'Questions fréquentes', hint: '', rows: 5, placeholder: '' },
] as const

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
// Les deux aperçus (livret mobile, écran TV) doivent se recharger tout seuls après un enregistrement (contenu, fond,
// mise en page, widgets) : sinon ils restent figés sur l'état d'avant tant qu'on ne clique pas "Rafraîchir" à la main.
function bumpPreviews() { livretPreviewKey.value++; tvPreviewKey.value++ }
const qrUrl = computed(() => `/api/logements/${route.params.id}/livret/qr`)
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(link.value); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { /* copie manuelle possible */ } }
const tvCopied = ref(false)
async function copyTv() { try { await navigator.clipboard.writeText(tvLinkBase.value); tvCopied.value = true; setTimeout(() => { tvCopied.value = false }, 2000) } catch { /* copie manuelle possible */ } }
async function regenerate() {
  if (!confirm('Régénérer le lien ? L\'ancien (et le QR déjà imprimé) cessera de fonctionner.')) return
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
  } catch (err: any) { bgError.value = err?.data?.statusMessage || 'Échec, réessaie.' }
  bgBusy.value = false
  if (fileInput.value) fileInput.value.value = ''
  bgVersion.value++
  await refresh()
  bumpPreviews()
}
async function pickWeb(r: { url: string; attribution: string }) {
  bgBusy.value = true; bgError.value = ''
  try { await $fetch(`/api/logements/${route.params.id}/livret/background-web`, { method: 'PUT', body: { url: r.url, attribution: r.attribution } }) }
  catch (err: any) { bgError.value = err?.data?.statusMessage || 'Échec, réessaie.' }
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

const widgetOrder = ref<string[]>([])
watch(() => data.value?.widgetOrder, (o) => { if (o) widgetOrder.value = [...o] }, { immediate: true })
const displayList = computed(() => {
  const enabled = widgetOrder.value
  const disabled = WIDGET_CATALOG.filter(w => !enabled.includes(w.id)).map(w => w.id)
  const ids = [...enabled, ...disabled]
  return ids.map((id, i) => {
    const w = WIDGET_CATALOG.find(c => c.id === id)!
    const isEnabled = enabled.includes(id)
    return { id, label: w.label, icon: w.icon, enabled: isEnabled, isFirst: i === 0, isLast: isEnabled && i === enabled.length - 1 }
  })
})
async function saveWidgets() {
  await $fetch(`/api/logements/${route.params.id}/livret/widgets`, { method: 'PUT', body: { order: widgetOrder.value } })
  bumpPreviews()
}
function toggleWidget(id: string, on: boolean) {
  widgetOrder.value = on ? [...widgetOrder.value, id] : widgetOrder.value.filter(w => w !== id)
  saveWidgets()
}
function move(id: string, dir: -1 | 1) {
  const i = widgetOrder.value.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= widgetOrder.value.length) return
  const next = [...widgetOrder.value]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  widgetOrder.value = next
  saveWidgets()
}

// Fond par widget (carrousel) : un seul jeu de champs/modale reutilise pour le widget en cours d'edition (widgetBgId).
const widgetBgId = ref<string | null>(null)
const widgetBgOpen = ref(false)
const widgetBgBusy = ref(false)
const widgetBgError = ref('')
const widgetBgFileInput = ref<HTMLInputElement>()
const widgetBgVersion = ref(0)
function hasWidgetBg(id: string) {
  const r = data.value?.widgetBackgrounds?.[id]
  return !!(r && (r.hasFile || r.webUrl))
}
const widgetBgLabel = computed(() => WIDGET_CATALOG.find(w => w.id === widgetBgId.value)?.label ?? '')
const widgetBgPreviewUrl = computed(() => {
  if (!data.value || !widgetBgId.value) return ''
  const r = data.value.widgetBackgrounds?.[widgetBgId.value]
  if (!r) return ''
  if (r.hasFile) return `/api/g/${data.value.token}/widgets/${widgetBgId.value}/background?v=${widgetBgVersion.value}`
  return r.webUrl
})
function openWidgetBg(id: string) {
  widgetBgId.value = id
  widgetBgError.value = ''
  widgetBgOpen.value = true
}
async function uploadWidgetBg(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !widgetBgId.value) return
  widgetBgBusy.value = true; widgetBgError.value = ''
  try {
    const body = new FormData(); body.append('file', file)
    await $fetch(`/api/logements/${route.params.id}/livret/widgets/${widgetBgId.value}/background`, { method: 'POST', body })
  } catch (err: any) { widgetBgError.value = err?.data?.statusMessage || 'Échec, réessaie.' }
  widgetBgBusy.value = false
  if (widgetBgFileInput.value) widgetBgFileInput.value.value = ''
  widgetBgVersion.value++
  await refresh()
  bumpPreviews()
}
async function pickWidgetBgWeb(r: { url: string; attribution: string }) {
  if (!widgetBgId.value) return
  widgetBgBusy.value = true; widgetBgError.value = ''
  try { await $fetch(`/api/logements/${route.params.id}/livret/widgets/${widgetBgId.value}/background-web`, { method: 'PUT', body: { url: r.url, attribution: r.attribution } }) }
  catch (err: any) { widgetBgError.value = err?.data?.statusMessage || 'Échec, réessaie.' }
  widgetBgBusy.value = false
  await refresh()
  bumpPreviews()
}
async function removeWidgetBg() {
  if (!widgetBgId.value) return
  widgetBgBusy.value = true
  try { await $fetch(`/api/logements/${route.params.id}/livret/widgets/${widgetBgId.value}/background`, { method: 'DELETE' }) }
  finally { widgetBgBusy.value = false }
  await refresh()
  bumpPreviews()
}

const navItems = [{ label: 'Défilement (toutes les cartes)', value: 'scroll' }, { label: 'Onglets (une à la fois)', value: 'tabs' }]
const colItems = [{ label: '1 colonne', value: 1 }, { label: '2 colonnes', value: 2 }]
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
  } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
  busy.value = false
  await refresh()
  bumpPreviews()
}
</script>

<style scoped>
/* Aperçu réduit de l'écran TV (1920x1080 mis à l'échelle) sans avoir à ouvrir un nouvel onglet */
.tv-preview-frame {
  width: 480px;
  height: 270px;
  max-width: 100%;
}
.tv-preview-iframe {
  width: 1920px;
  height: 1080px;
  border: 0;
  transform: scale(0.25);
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
