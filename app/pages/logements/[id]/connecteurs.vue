<template>
  <div v-if="data" class="flex flex-col gap-4 lg:h-[calc(100vh-17rem)] lg:flex-row">
    <!-- Colonne gauche : connecteurs du logement -->
    <div class="min-w-0 space-y-1 overflow-y-auto lg:w-80 lg:shrink-0 lg:border-r lg:border-default lg:pr-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="section-title !mt-0">Connecteurs</h2>
        <UButton size="xs" icon="i-lucide-plus" label="Ajouter" @click="pickerOpen = true" />
      </div>
      <button
        v-for="c in data.connectors" :key="c.id" type="button" class="block w-full rounded-md p-2.5 text-left transition-colors"
        :class="[selected === c.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-elevated', { 'opacity-60': !c.enabled }]"
        @click="select(c.id)"
      >
        <div class="flex items-center gap-2">
          <UIcon :name="pluginOf(c.pluginId)?.icon ?? 'i-lucide-plug'" class="size-4 shrink-0 text-primary" />
          <b class="truncate text-sm">{{ c.name }}</b>
        </div>
        <p class="truncate text-xs text-muted">{{ pluginOf(c.pluginId)?.name }}<template v-if="c.lastResult"> · {{ c.lastResult }}</template></p>
      </button>
      <p v-if="!data.connectors.length" class="text-sm text-muted">Aucun connecteur. « Ajouter » pour brancher un service (Homey, service web…).</p>
    </div>

    <!-- Colonne droite : connecteur choisi -->
    <div v-if="current && plugin" class="grid min-w-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-3 lg:content-start">
      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex flex-wrap items-center gap-2">
            <UIcon :name="plugin.icon" class="size-5 text-primary" />
            <h3 class="text-lg font-semibold">{{ current.name }}</h3>
            <UBadge size="sm" color="neutral" variant="subtle" :label="plugin.name" />
            <USwitch v-model="form.enabled" class="ml-auto" label="Actif" />
          </div>
          <p v-if="current.lastRunAt" class="mt-1 text-xs text-muted">Dernier appel {{ when(current.lastRunAt) }} : {{ current.lastResult }}</p>
        </template>
        <ConnectorForm v-model:name="form.name" v-model:config="form.config" :plugin="plugin" :secrets="current.secrets" />
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <UButton icon="i-lucide-save" label="Enregistrer" :loading="busy === 'save'" @click="save" />
          <UButton color="neutral" variant="outline" icon="i-lucide-plug-zap" label="Tester" :loading="busy === 'test'" @click="test" />
          <UButton color="error" variant="ghost" icon="i-lucide-trash-2" label="Supprimer" class="ml-auto" @click="remove" />
        </div>
        <p v-if="message" class="mt-3 text-sm" :class="messageError ? 'text-error' : 'text-success'">{{ message }}</p>
      </UCard>

      <div class="space-y-4 lg:col-span-1">
        <UCard v-if="plugin.capabilities.includes('actions') && current.actions.length">
          <template #header><p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-zap" class="size-3.5" /> Actions</p></template>
          <div class="space-y-2">
            <UButton v-for="a in current.actions" :key="a.id" block color="neutral" variant="outline" :label="a.label" :loading="busy === `a${a.id}`" @click="run(a)" />
          </div>
        </UCard>
        <UCard v-if="plugin.capabilities.includes('documents')">
          <template #header><p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><UIcon name="i-lucide-folder-down" class="size-3.5" /> Documents</p></template>
          <p class="text-sm text-muted">Récupère les documents du service dans l'onglet Documents (dossier « Connecteurs / {{ current.name }} »), sans doublon.</p>
          <UButton class="mt-3" block icon="i-lucide-download" label="Récupérer les documents" :loading="busy === 'import'" @click="importDocs" />
          <ul v-if="importErrors.length" class="mt-2 space-y-0.5 text-xs text-warning"><li v-for="e in importErrors" :key="e">{{ e }}</li></ul>
        </UCard>
      </div>

      <!-- Informations lues sur le service (lecture seule) -->
      <div v-if="plugin.capabilities.includes('info')" class="space-y-2 lg:col-span-3">
        <div class="flex items-center justify-between gap-2">
          <h3 class="section-title !m-0">Informations</h3>
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-refresh-cw" label="Lire" :loading="busy === 'info'" @click="loadInfo" />
        </div>
        <p v-if="!cards" class="text-sm text-muted">Clique sur « Lire » pour interroger le service (lecture seule).</p>
        <p v-else-if="!cards.length" class="text-sm text-muted">Rien à afficher.</p>
        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="(card, i) in cards" :key="i">
            <p class="mb-2 flex items-center gap-1.5 font-medium"><UIcon v-if="card.icon" :name="card.icon" class="size-4 text-muted" /> {{ card.title }}</p>
            <dl class="space-y-1 text-sm">
              <div v-for="(it, j) in card.items" :key="j" class="flex justify-between gap-2"><dt class="truncate text-muted">{{ it.label }}</dt><dd class="text-right">{{ it.value }}</dd></div>
            </dl>
            <p v-if="!card.items.length" class="text-sm text-muted">Aucune valeur.</p>
          </UCard>
        </div>
      </div>
    </div>
    <UCard v-else class="min-w-0 flex-1"><p class="text-sm text-muted">Choisis un connecteur, ou ajoute-en un depuis la bibliothèque de plugins.</p></UCard>

    <!-- Ajout : choix du plugin puis configuration -->
    <UModal v-model:open="pickerOpen" :title="newPlugin ? `Nouveau connecteur ${newPlugin.name}` : 'Ajouter un connecteur'" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div v-if="!newPlugin" class="grid gap-2 sm:grid-cols-2">
          <button v-for="p in data.plugins" :key="p.id" type="button" class="flex items-start gap-3 rounded-lg border border-default p-3 text-left hover:bg-elevated" @click="startNew(p.id)">
            <UIcon :name="p.icon" class="size-6 shrink-0 text-primary" />
            <span><b class="text-sm">{{ p.name }}</b><span class="block text-xs text-muted">{{ p.description }}</span></span>
          </button>
        </div>
        <ConnectorForm v-else v-model:name="draft.name" v-model:config="draft.config" :plugin="newPlugin" :secrets="{}" />
        <p v-if="newError" class="mt-3 text-sm text-error">{{ newError }}</p>
      </template>
      <template v-if="newPlugin" #footer>
        <UButton color="neutral" variant="ghost" label="Retour" @click="newPluginId = ''" />
        <UButton label="Créer le connecteur" :loading="busy === 'create'" @click="create" />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Connecteurs du logement : plugins de la bibliotheque configures ici (plusieurs possibles, y compris du meme plugin)
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/connectors`)
type Connector = NonNullable<typeof data.value>['connectors'][number]
const pluginOf = (id: string) => data.value?.plugins.find(p => p.id === id)

const selected = ref<number | null>(null)
watchEffect(() => {
  const list = data.value?.connectors ?? []
  if (!list.some(c => c.id === selected.value)) selected.value = list[0]?.id ?? null
})
const current = computed(() => data.value?.connectors.find(c => c.id === selected.value) ?? null)
const plugin = computed(() => current.value ? pluginOf(current.value.pluginId) : undefined)

// Formulaire du connecteur choisi (copie locale, enregistree sur demande)
const form = reactive<{ name: string; config: Record<string, string>; enabled: boolean }>({ name: '', config: {}, enabled: true })
watch(current, (c) => { if (c) Object.assign(form, { name: c.name, config: { ...c.config }, enabled: c.enabled }) }, { immediate: true })
const cards = ref<{ title: string; icon?: string; items: { label: string; value: string }[] }[] | null>(null)
const message = ref('')
const messageError = ref(false)
const importErrors = ref<string[]>([])
function select(id: number) { selected.value = id; cards.value = null; message.value = ''; importErrors.value = [] }
watch(selected, () => { cards.value = null; message.value = ''; importErrors.value = [] })

const busy = ref('')
async function act<T>(key: string, fn: () => Promise<T>, ok?: (r: T) => string) {
  busy.value = key
  message.value = ''
  try {
    const r = await fn()
    if (ok) { message.value = ok(r); messageError.value = false }
    return r
  } catch (e: any) { message.value = e?.data?.statusMessage || 'Échec'; messageError.value = true }
  finally { busy.value = '' }
}
const base = () => `/api/connectors/${selected.value}`
const save = () => act('save', async () => { await $fetch(base(), { method: 'PUT', body: { ...form } }); await refresh() }, () => 'Enregistré.')
const test = () => act('test', async () => { const r = await $fetch<{ message: string }>(`${base()}/test`, { method: 'POST' }); await refresh(); return r }, r => r.message)
async function loadInfo() {
  const r = await act('info', () => $fetch<{ cards: NonNullable<typeof cards.value> }>(`${base()}/info`))
  if (r) cards.value = r.cards
}
async function run(a: Connector['actions'][number]) {
  if (!confirm(`Lancer « ${a.label} » sur ${current.value?.name} ?\n(${a.confirm})`)) return
  await act(`a${a.id}`, async () => { const r = await $fetch<{ message: string }>(`${base()}/actions/${a.id}`, { method: 'POST' }); await refresh(); return r }, r => r.message)
}
async function importDocs() {
  importErrors.value = []
  const r = await act('import', async () => { const x = await $fetch<{ message: string; errors: string[] }>(`${base()}/import`, { method: 'POST' }); await refresh(); return x }, x => `Documents : ${x.message}.`)
  if (r) importErrors.value = r.errors
}
async function remove() {
  if (!current.value || !confirm(`Supprimer le connecteur « ${current.value.name} » ? Les documents déjà récupérés restent dans l'onglet Documents.`)) return
  await act('delete', async () => { await $fetch(base(), { method: 'DELETE' }); selected.value = null; await refresh() })
}

// Ajout d'un connecteur
const pickerOpen = ref(false)
const newPluginId = ref('')
const newPlugin = computed(() => newPluginId.value ? pluginOf(newPluginId.value) : undefined)
const draft = reactive<{ name: string; config: Record<string, string> }>({ name: '', config: {} })
const newError = ref('')
watch(pickerOpen, (o) => { if (!o) { newPluginId.value = ''; newError.value = '' } })
function startNew(id: string) {
  const p = pluginOf(id)!
  const defaults: Record<string, string> = {}
  for (const f of p.fields) if (f.type === 'select' && f.options?.length) defaults[f.key] = f.default ?? f.options[0]!.value
  Object.assign(draft, { name: p.name, config: defaults })
  newError.value = ''
  newPluginId.value = id
}
async function create() {
  busy.value = 'create'
  newError.value = ''
  try {
    const c = await $fetch<Connector>(`/api/logements/${route.params.id}/connectors`, { method: 'POST', body: { pluginId: newPluginId.value, ...draft } })
    pickerOpen.value = false
    await refresh()
    selected.value = c.id
  } catch (e: any) { newError.value = e?.data?.statusMessage || 'Échec' }
  finally { busy.value = '' }
}
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>
