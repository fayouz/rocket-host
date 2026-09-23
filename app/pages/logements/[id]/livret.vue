<template>
  <div v-if="data" class="space-y-3">
    <h2 class="section-title !mt-0">Livret d'accueil</h2>
    <p class="text-sm text-muted">Une page pour le voyageur, sans compte à créer, accessible par lien ou QR code. Infos du logement seulement : pour personnaliser par séjour (code de porte, dates), voir plus tard.</p>
    <p class="text-sm text-muted">Le règlement intérieur se gère maintenant à part : <ULink :to="`/logements/${route.params.id}/reglement`" class="text-primary">page Règlement intérieur</ULink>. Il est repris automatiquement ici.</p>

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
          <p class="text-xs text-muted">Régénérer invalide l'ancien lien immédiatement (utile si le QR affiché quelque part doit être remplacé) : le lien TV ci-dessous change aussi.</p>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header><b>Écran TV</b></template>
      <p class="text-sm text-muted">Même lien, en plein écran, pensé pour être ouvert sur la TV du logement (grand texte, voyageur du jour affiché s'il y en a un).</p>
      <UButton class="mt-2" size="sm" color="neutral" variant="outline" icon="i-lucide-tv" label="Ouvrir l'écran TV" :to="tvLink" external target="_blank" />
    </UCard>

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
      <ul class="mt-3 divide-y divide-default">
        <li v-for="w in displayList" :key="w.id" class="flex items-center gap-3 py-2">
          <UCheckbox :model-value="w.enabled" @update:model-value="toggleWidget(w.id, $event)" />
          <UIcon :name="w.icon" class="size-4 text-muted" />
          <span class="flex-1 text-sm" :class="{ 'text-muted': !w.enabled }">{{ w.label }}</span>
          <div v-if="w.enabled" class="flex gap-1">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-up" :disabled="w.isFirst" @click="move(w.id, -1)" />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-down" :disabled="w.isLast" @click="move(w.id, 1)" />
          </div>
        </li>
      </ul>
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
</template>

<script setup lang="ts">
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/livret`, { key: `livret-${route.params.id}` })

const sections = [
  { key: 'welcomeText', label: 'Mot de bienvenue', hint: 'Affiché en haut de la page.', rows: 3, placeholder: 'Bienvenue chez nous !' },
  { key: 'checkinInfo', label: 'Arrivée', hint: 'Horaire habituel, comment entrer (au-delà du code, déjà géré ailleurs).', rows: 4, placeholder: 'Arrivée à partir de 15h. …' },
  { key: 'checkoutInfo', label: 'Départ', hint: 'Horaire limite, consignes (clés, poubelles…).', rows: 4, placeholder: 'Départ avant 11h. …' },
  { key: 'accessDirections', label: 'Accès', hint: 'Adresse, parking, digicode, étage…', rows: 4, placeholder: '' },
  { key: 'localTips', label: 'Conseils du quartier', hint: 'Boulangerie, restaurants, transports…', rows: 5, placeholder: '' },
  { key: 'faq', label: 'Questions fréquentes', hint: '', rows: 5, placeholder: '' },
] as const

const form = reactive({ wifiSsid: '', wifiPassword: '', welcomeText: '', checkinInfo: '', checkoutInfo: '', accessDirections: '', localTips: '', faq: '' })
watch(() => data.value?.content, (c) => { if (c) Object.assign(form, c) }, { immediate: true })

const origin = useRequestURL().origin
const link = computed(() => data.value ? `${origin}/g/${data.value.token}` : '')
const tvLink = computed(() => data.value ? `${origin}/tv/${data.value.token}` : '')
const qrUrl = computed(() => `/api/logements/${route.params.id}/livret/qr`)
const copied = ref(false)
async function copy() { try { await navigator.clipboard.writeText(link.value); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch { /* copie manuelle possible */ } }
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
}
async function pickWeb(r: { url: string; attribution: string }) {
  bgBusy.value = true; bgError.value = ''
  try { await $fetch(`/api/logements/${route.params.id}/livret/background-web`, { method: 'PUT', body: { url: r.url, attribution: r.attribution } }) }
  catch (err: any) { bgError.value = err?.data?.statusMessage || 'Échec, réessaie.' }
  bgBusy.value = false
  bgVersion.value++
  await refresh()
}
async function setMode(mode: 'inherit' | 'none') {
  bgBusy.value = true
  try { await $fetch(`/api/logements/${route.params.id}/livret/background-mode`, { method: 'PUT', body: { mode } }) }
  finally { bgBusy.value = false }
  bgVersion.value++
  await refresh()
}
async function setAnimated(animated: boolean) {
  await $fetch(`/api/logements/${route.params.id}/livret/animated`, { method: 'PUT', body: { animated } })
  await refresh()
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
}
</script>
