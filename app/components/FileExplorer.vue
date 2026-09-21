<!--
  Explorateur de fichiers façon Finder (module indépendant).
  Props : logementId (optionnel). Sans lui : barre latérale + racine « Documents » (un dossier par logement).
  Avec lui : verrouillé sur ce logement (utilisé dans la page d'un logement).
  Ne dépend que de l'API /api/explorer/* ; aucun état partagé avec le reste de l'appli.
-->
<template>
  <div class="flex min-h-[28rem] flex-col overflow-hidden rounded-lg border border-default bg-default" :style="{ height: height }"
       @dragover.prevent="onDragOverRoot" @dragleave.self="dropHint = ''" @drop.prevent="onDropRoot">
    <!-- Barre d'outils -->
    <div class="flex flex-wrap items-center gap-1 border-b border-default bg-elevated/50 px-2 py-1.5">
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-chevron-left" :disabled="!canBack" aria-label="Précédent" @click="back" />
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-chevron-right" :disabled="!canForward" aria-label="Suivant" @click="forward" />
      <div class="mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm">
        <template v-for="(c, i) in crumbs" :key="i">
          <UIcon v-if="i" name="i-lucide-chevron-right" class="size-3.5 shrink-0 text-muted" />
          <button type="button" class="shrink-0 rounded px-1.5 py-0.5 hover:bg-elevated" :class="[i === crumbs.length - 1 ? 'font-semibold' : 'text-muted', dropHint === `crumb${i}` ? 'drop' : '']"
                  @click="go(c.loc)" @dragover.prevent.stop="c.loc.logement !== undefined && !c.search && (dropHint = `crumb${i}`)" @dragleave.stop="dropHint = ''" @drop.prevent.stop="dropOnCrumb(c, $event)">
            {{ c.label }}
          </button>
        </template>
      </div>
      <UInput v-model="query" size="sm" icon="i-lucide-search" placeholder="Rechercher" class="w-40 sm:w-52" :ui="{ trailing: 'pe-1' }">
        <template v-if="query" #trailing><UButton size="xs" color="neutral" variant="link" icon="i-lucide-x" aria-label="Effacer" @click="query = ''" /></template>
      </UInput>
      <UFieldGroup size="sm">
        <UButton color="neutral" :variant="view === 'icons' ? 'solid' : 'outline'" icon="i-lucide-layout-grid" aria-label="Icônes" @click="view = 'icons'" />
        <UButton color="neutral" :variant="view === 'list' ? 'solid' : 'outline'" icon="i-lucide-list" aria-label="Liste" @click="view = 'list'" />
      </UFieldGroup>
      <UButton v-if="!readonly" size="sm" color="neutral" variant="outline" icon="i-lucide-folder-plus" label="Dossier" :disabled="!canWrite" @click="newFolder" />
      <UButton v-if="!readonly" size="sm" icon="i-lucide-upload" label="Ajouter" :disabled="!canWrite" :loading="uploading" @click="fileInput?.click()" />
      <input ref="fileInput" type="file" multiple class="hidden" @change="onPick">
    </div>

    <!-- Étiquettes : un clic filtre (dans le logement ouvert, ou partout depuis la racine) -->
    <div class="flex flex-wrap items-center gap-1.5 border-b border-default px-3 py-1.5 text-xs">
      <span class="text-muted">Étiquettes :</span>
      <button v-for="t in tags" :key="t.id" type="button" class="flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-elevated"
              :class="tagFilter === t.id ? 'border-primary bg-primary/15 font-medium' : 'border-default'" :aria-pressed="tagFilter === t.id" @click="toggleFilter(t.id)">
        <span class="size-2 rounded-full" :class="DOT[t.color]" /> {{ t.name }} <span class="text-muted">{{ t.count }}</span>
      </button>
      <span v-if="!tags.length" class="text-muted">aucune pour l'instant</span>
      <button v-if="!readonly" type="button" class="flex items-center gap-1 rounded-full px-2 py-0.5 text-muted hover:bg-elevated" @click="manageOpen = true"><UIcon name="i-lucide-settings-2" class="size-3" /> Gérer</button>
    </div>

    <div class="flex min-h-0 flex-1">
      <!-- Barre latérale -->
      <aside v-if="!lockedLogement" class="hidden w-44 shrink-0 space-y-0.5 overflow-y-auto border-r border-default bg-elevated/30 p-2 text-sm sm:block">
        <p class="px-2 pb-1 pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">Favoris</p>
        <button type="button" class="side" :class="{ on: loc.logement === undefined }" @click="go({})"><UIcon name="i-lucide-hard-drive" /> Tous les logements</button>
        <p class="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Logements</p>
        <button v-for="l in data?.logements ?? []" :key="l.id" type="button" class="side" :class="{ on: loc.logement === l.id, drop: dropHint === `side${l.id}` }"
                @click="go({ logement: l.id })" @dragover.prevent.stop="dropHint = `side${l.id}`" @dragleave.stop="dropHint = ''" @drop.prevent.stop="dropOnLogement(l.id, $event)">
          <UIcon name="i-lucide-house" /> <span class="truncate">{{ l.name }}</span>
        </button>
      </aside>

      <!-- Contenu -->
      <UContextMenu :items="menuItems" class="min-w-0 flex-1" :ui="{ content: 'min-w-44' }">
        <div ref="pane" class="relative h-full min-w-0 overflow-y-auto p-3 outline-none" tabindex="0" @click.self="selected = []" @keydown="onKey" @contextmenu="onContextBlank">
          <div v-if="dropHint === 'root'" class="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
            Déposer ici pour ajouter à « {{ here }} »
          </div>

          <p v-if="error" class="mb-2 rounded bg-error/10 px-2 py-1 text-sm text-error">{{ error }}</p>
          <ul v-if="notes.length" class="mb-2 space-y-0.5 rounded bg-warning/10 px-2 py-1 text-sm text-warning"><li v-for="n in notes" :key="n">{{ n }}</li></ul>

          <p v-if="!items.length && !creating" class="py-16 text-center text-sm text-muted">
            <template v-if="searching">Aucun résultat.</template>
            <template v-else-if="loc.logement === undefined">Aucun logement.</template>
            <template v-else>Dossier vide — glisse des fichiers ici, ou utilise « Ajouter ».</template>
          </p>

          <!-- Icônes -->
          <div v-if="view === 'icons'" class="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1">
            <div v-if="creating" class="cell">
              <UIcon name="i-lucide-folder" class="size-12 text-sky-500" />
              <input ref="newInput" v-model="creating.name" class="rename" @keydown.enter.prevent="commitNew" @keydown.esc.prevent="creating = null" @blur="commitNew">
            </div>
            <div v-for="it in items" :key="key(it)" class="cell" :class="{ sel: isSel(it), drop: dropHint === key(it) }" :draggable="!readonly"
                 @click.stop="select(it, $event)" @dblclick.stop="open(it)" @contextmenu="onContextItem(it)" @dragstart="onDragStart(it, $event)"
                 @dragover.prevent.stop="onDragOverItem(it)" @dragleave.stop="dropHint = ''" @drop.prevent.stop="onDropItem(it, $event)">
              <UIcon :name="iconOf(it)" class="size-12" :class="colorOf(it)" />
              <input v-if="renaming === key(it)" ref="renameInput" v-model="renameValue" class="rename" @click.stop @dblclick.stop @keydown.enter.prevent="commitRename(it)" @keydown.esc.prevent="renaming = ''" @blur="commitRename(it)">
              <span v-else class="line-clamp-2 break-all text-center text-xs leading-tight">{{ it.name }}</span>
              <span v-if="it.tags?.length" class="flex flex-wrap justify-center gap-0.5"><span v-for="t in it.tags" :key="t.id" class="size-2 rounded-full" :class="DOT[t.color]" :title="t.name" /></span>
              <span v-if="it.where" class="line-clamp-1 text-[10px] text-muted">{{ it.where }}</span>
            </div>
          </div>

          <!-- Liste -->
          <table v-else-if="items.length || creating" class="w-full text-sm">
            <thead class="text-left text-xs text-muted">
              <tr>
                <th v-for="c in cols" :key="c.k" class="cursor-pointer select-none whitespace-nowrap px-2 py-1 font-medium" :class="c.cls" @click="sortBy(c.k)">
                  {{ c.label }} <UIcon v-if="sort.key === c.k" :name="sort.dir === 1 ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 align-middle" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="creating" class="row">
                <td class="px-2 py-1" colspan="4"><span class="flex items-center gap-2"><UIcon name="i-lucide-folder" class="size-5 text-sky-500" />
                  <input ref="newInput" v-model="creating.name" class="rename !text-left" @keydown.enter.prevent="commitNew" @keydown.esc.prevent="creating = null" @blur="commitNew"></span></td>
              </tr>
              <tr v-for="it in items" :key="key(it)" class="row" :class="{ sel: isSel(it), drop: dropHint === key(it) }" :draggable="!readonly"
                  @click.stop="select(it, $event)" @dblclick.stop="open(it)" @contextmenu="onContextItem(it)" @dragstart="onDragStart(it, $event)"
                  @dragover.prevent.stop="onDragOverItem(it)" @dragleave.stop="dropHint = ''" @drop.prevent.stop="onDropItem(it, $event)">
                <td class="px-2 py-1">
                  <span class="flex min-w-0 items-center gap-2">
                    <UIcon :name="iconOf(it)" class="size-5 shrink-0" :class="colorOf(it)" />
                    <input v-if="renaming === key(it)" ref="renameInput" v-model="renameValue" class="rename !text-left" @click.stop @dblclick.stop @keydown.enter.prevent="commitRename(it)" @keydown.esc.prevent="renaming = ''" @blur="commitRename(it)">
                    <span v-else class="truncate">{{ it.name }}<span v-if="it.where" class="ml-2 text-xs text-muted">{{ it.where }}</span></span>
                    <span v-for="t in it.tags" :key="t.id" class="flex shrink-0 items-center gap-1 rounded-full border border-default px-1.5 text-[11px] text-muted"><span class="size-1.5 rounded-full" :class="DOT[t.color]" />{{ t.name }}</span>
                  </span>
                </td>
                <td class="whitespace-nowrap px-2 py-1 text-muted">{{ it.updatedAt ? dateFr(it.updatedAt) : '—' }}</td>
                <td class="whitespace-nowrap px-2 py-1 text-right text-muted">{{ sizeOf(it) }}</td>
                <td class="whitespace-nowrap px-2 py-1 text-muted">{{ kindOf(it) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UContextMenu>
    </div>

    <!-- Barre d'état -->
    <div class="flex items-center justify-between border-t border-default bg-elevated/50 px-3 py-1 text-xs text-muted">
      <span>{{ status }}</span>
      <span class="hidden sm:inline">Double-clic : ouvrir · Espace : aperçu · Entrée : renommer · Suppr : supprimer · Glisser-déposer : ajouter / déplacer</span>
    </div>

    <!-- Gestion des étiquettes -->
    <UModal v-model:open="manageOpen" title="Étiquettes" description="Communes à tous les logements. Supprimer une étiquette ne supprime aucun fichier.">
      <template #body>
        <ul class="space-y-2">
          <li v-for="t in tags" :key="t.id" class="flex items-center gap-2">
            <span class="flex shrink-0 gap-1">
              <button v-for="c in colors" :key="c" type="button" class="size-4 rounded-full" :class="[DOT[c], t.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-default' : '']" :aria-label="c" @click="recolor(t, c)" />
            </span>
            <UInput :model-value="t.name" size="sm" class="min-w-0 flex-1" :maxlength="30" @change="onRename(t, $event)" />
            <span class="w-6 text-right text-xs text-muted">{{ t.count }}</span>
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Supprimer l'étiquette" @click="removeTag(t)" />
          </li>
          <li v-if="!tags.length" class="text-sm text-muted">Aucune étiquette.</li>
        </ul>
        <form class="mt-4 flex flex-wrap items-center gap-2 border-t border-default pt-3" @submit.prevent="addTag">
          <UInput v-model="newTag.name" size="sm" class="min-w-0 flex-1" placeholder="Nouvelle étiquette" :maxlength="30" @keydown.enter.prevent="addTag" />
          <span class="flex gap-1">
            <button v-for="c in colors" :key="c" type="button" class="size-4 rounded-full" :class="[DOT[c], newTag.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-default' : '']" :aria-label="c" @click="newTag.color = c" />
          </span>
          <UButton type="submit" size="sm" label="Ajouter" :disabled="!newTag.name.trim()" />
        </form>
        <p v-if="tagError" class="mt-2 text-sm text-error">{{ tagError }}</p>
      </template>
    </UModal>

    <!-- Aperçu (Coup d'œil) -->
    <UModal v-model:open="previewOpen" :title="preview?.name" :ui="{ content: 'sm:max-w-4xl' }">
      <template #body>
        <div v-if="preview" class="flex min-h-64 items-center justify-center">
          <img v-if="isImage(preview)" :src="fileUrl(preview)" :alt="preview.name" class="max-h-[70vh] max-w-full rounded">
          <iframe v-else-if="preview.ext === 'pdf'" :src="fileUrl(preview)" class="h-[70vh] w-full rounded border border-default" title="Aperçu PDF" />
          <div v-else class="space-y-2 text-center text-sm text-muted">
            <UIcon :name="iconOf(preview)" class="size-16" />
            <p>Pas d'aperçu pour ce type de fichier.</p>
          </div>
        </div>
      </template>
      <template #footer>
        <UButton v-if="preview" color="neutral" variant="outline" icon="i-lucide-download" label="Télécharger" :to="fileUrl(preview, true)" external />
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
interface Tag { id: number; name: string; color: string; count?: number }
interface Item { tags?: Tag[]; id: number; kind: 'folder' | 'file' | 'logement'; name: string; size: number; updatedAt: string; createdAt: string; parentId: number | null; logementId: number; ext: string; inline: boolean; where?: string }
interface Loc { logement?: number; folder?: number | null }
interface TagList { colors: string[]; tags: (Tag & { count: number })[] }
interface ListResult { root: boolean; search?: string; logement: { id: number; name: string } | null; path: { id: number; name: string }[]; logements: { id: number; name: string }[]; items: Item[] }

const props = withDefaults(defineProps<{ logementId?: number; height?: string; readonly?: boolean }>(), { logementId: undefined, height: '32rem', readonly: false })
const lockedLogement = computed(() => props.logementId !== undefined)

// --- Position, historique (précédent / suivant) ---
const loc = ref<Loc>(props.logementId !== undefined ? { logement: props.logementId } : {})
const history = ref<Loc[]>([{ ...loc.value }])
const hpos = ref(0)
const canBack = computed(() => hpos.value > 0)
const canForward = computed(() => hpos.value < history.value.length - 1)
function go(to: Loc) {
  if (lockedLogement.value && to.logement !== props.logementId) return
  query.value = ''
  debounced.value = ''
  tagFilter.value = null
  loc.value = { ...to }
  history.value = [...history.value.slice(0, hpos.value + 1), { ...to }]
  hpos.value = history.value.length - 1
}
function back() { if (canBack.value) { hpos.value--; query.value = ''; debounced.value = ''; tagFilter.value = null; loc.value = { ...history.value[hpos.value]! } } }
function forward() { if (canForward.value) { hpos.value++; query.value = ''; debounced.value = ''; tagFilter.value = null; loc.value = { ...history.value[hpos.value]! } } }

// --- Chargement ---
const query = ref('')
const debounced = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (v) => { clearTimeout(timer); timer = setTimeout(() => { debounced.value = v.trim() }, 250) })
onBeforeUnmount(() => clearTimeout(timer))
const tagFilter = ref<number | null>(null)
const searching = computed(() => !!debounced.value || tagFilter.value !== null)
const { data, refresh, error: loadError } = await useFetch<ListResult>('/api/explorer/list', {
  key: `explorer-${props.logementId ?? 'all'}`,
  query: computed(() => ({ logement: loc.value.logement, folder: loc.value.folder ?? undefined, q: debounced.value || undefined, tag: tagFilter.value ?? undefined })),
})
const { data: tagData, refresh: refreshTags } = await useFetch<TagList>('/api/explorer/tags', { key: 'explorer-tags' })
const tags = computed(() => tagData.value?.tags ?? [])
const colors = computed(() => tagData.value?.colors ?? [])
// Classes complètes (Tailwind ne devine pas les noms de classes assemblés)
const DOT: Record<string, string> = { red: 'bg-red-500', orange: 'bg-orange-500', amber: 'bg-amber-500', green: 'bg-green-500', teal: 'bg-teal-500', blue: 'bg-blue-500', violet: 'bg-violet-500', pink: 'bg-pink-500', gray: 'bg-gray-400' }
function toggleFilter(id: number) { tagFilter.value = tagFilter.value === id ? null : id }
const error = ref('')
const msg = (e: any) => e?.data?.statusMessage || 'Échec, réessaie.'
watch(loadError, (e) => { error.value = e ? msg(e) : '' })
watch(loc, () => { selected.value = []; renaming.value = ''; creating.value = null; notes.value = []; error.value = '' })
const canWrite = computed(() => !props.readonly && loc.value.logement !== undefined && !searching.value) // readonly : rôle en lecture seule (le serveur refuse aussi)

// --- Fil d'Ariane ---
const crumbs = computed(() => {
  const out: { label: string; loc: Loc; search?: boolean }[] = []
  if (!lockedLogement.value) out.push({ label: 'Documents', loc: {} })
  if (loc.value.logement !== undefined) {
    const name = data.value?.logement?.name ?? data.value?.logements.find(l => l.id === loc.value.logement)?.name ?? '…'
    out.push({ label: name, loc: { logement: loc.value.logement } })
    for (const p of data.value?.path ?? []) out.push({ label: p.name, loc: { logement: loc.value.logement, folder: p.id } })
  }
  if (searching.value) {
    const tn = tags.value.find(t => t.id === tagFilter.value)?.name
    out.push({ label: [tn ? `Étiquette : ${tn}` : '', debounced.value ? `Recherche : ${debounced.value}` : ''].filter(Boolean).join(' + '), loc: loc.value, search: true })
  }
  return out
})
const here = computed(() => crumbs.value.at(-1)?.label ?? 'Documents')

// --- Tri ---
const view = ref<'icons' | 'list'>('icons')
const sort = reactive<{ key: 'name' | 'date' | 'size' | 'kind'; dir: 1 | -1 }>({ key: 'name', dir: 1 })
const cols = [{ k: 'name' as const, label: 'Nom', cls: '' }, { k: 'date' as const, label: 'Modifié', cls: '' }, { k: 'size' as const, label: 'Taille', cls: 'text-right' }, { k: 'kind' as const, label: 'Type', cls: '' }]
function sortBy(k: typeof sort.key) { if (sort.key === k) sort.dir = sort.dir === 1 ? -1 : 1; else { sort.key = k; sort.dir = 1 } }
const items = computed<Item[]>(() => {
  const list = [...(data.value?.items ?? [])]
  const cmp = (a: Item, b: Item) => {
    if (sort.key === 'date') return a.updatedAt.localeCompare(b.updatedAt)
    if (sort.key === 'size') return a.size - b.size
    if (sort.key === 'kind') return kindOf(a).localeCompare(kindOf(b), 'fr')
    return a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' })
  }
  // Dossiers d'abord (comme le Finder), puis le tri choisi
  return list.sort((a, b) => (a.kind === 'file' ? 1 : 0) - (b.kind === 'file' ? 1 : 0) || cmp(a, b) * sort.dir)
})

// --- Affichage d'un élément ---
const key = (it: Item) => `${it.kind}${it.id}`
const isFolderish = (it: Item) => it.kind !== 'file'
const EXT_ICON: Record<string, [string, string]> = {
  pdf: ['i-lucide-file-text', 'text-red-500'], png: ['i-lucide-file-image', 'text-emerald-500'], jpg: ['i-lucide-file-image', 'text-emerald-500'], jpeg: ['i-lucide-file-image', 'text-emerald-500'], webp: ['i-lucide-file-image', 'text-emerald-500'],
  xlsx: ['i-lucide-file-spreadsheet', 'text-green-600'], csv: ['i-lucide-file-spreadsheet', 'text-green-600'], docx: ['i-lucide-file-text', 'text-blue-500'], txt: ['i-lucide-file-text', 'text-muted'],
}
const iconOf = (it: Item) => it.kind === 'logement' ? 'i-lucide-folder-closed' : it.kind === 'folder' ? 'i-lucide-folder' : (EXT_ICON[it.ext]?.[0] ?? 'i-lucide-file')
const colorOf = (it: Item) => isFolderish(it) ? 'text-sky-500' : (EXT_ICON[it.ext]?.[1] ?? 'text-muted')
const KIND: Record<string, string> = { pdf: 'Document PDF', png: 'Image PNG', jpg: 'Image JPEG', jpeg: 'Image JPEG', webp: 'Image WebP', csv: 'Tableur CSV', xlsx: 'Feuille Excel', docx: 'Document Word', txt: 'Texte' }
const kindOf = (it: Item) => it.kind === 'logement' ? 'Logement' : it.kind === 'folder' ? 'Dossier' : (KIND[it.ext] ?? 'Fichier')
const sizeOf = (it: Item) => it.kind === 'file' ? (it.size >= 1048576 ? `${(it.size / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(it.size / 1024))} Ko`) : it.kind === 'logement' ? `${it.size} élément${it.size > 1 ? 's' : ''}` : '—'
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const isImage = (it: Item) => ['png', 'jpg', 'jpeg', 'webp'].includes(it.ext)
const fileUrl = (it: Item, download = false) => `/api/explorer/${it.id}/file${download ? '?download=1' : ''}`

// --- Sélection, ouverture ---
const selected = ref<string[]>([])
const isSel = (it: Item) => selected.value.includes(key(it))
const selItems = computed(() => items.value.filter(isSel))
const status = computed(() => {
  const n = items.value.length
  const s = selected.value.length
  return `${n} élément${n > 1 ? 's' : ''}${s ? ` · ${s} sélectionné${s > 1 ? 's' : ''}` : ''}`
})
let anchor = ''
function select(it: Item, e: MouseEvent) {
  const k = key(it)
  if (e.shiftKey && anchor) {
    const ks = items.value.map(key)
    const [a, b] = [ks.indexOf(anchor), ks.indexOf(k)].sort((x, y) => x - y) as [number, number]
    selected.value = ks.slice(a, b + 1)
  } else if (e.metaKey || e.ctrlKey) {
    selected.value = isSel(it) ? selected.value.filter(x => x !== k) : [...selected.value, k]
    anchor = k
  } else { selected.value = [k]; anchor = k }
  pane.value?.focus()
}
function open(it: Item) {
  if (it.kind === 'logement') go({ logement: it.id })
  else if (it.kind === 'folder') go({ logement: it.logementId, folder: it.id })
  else if (it.inline) showPreview(it)
  else window.location.assign(fileUrl(it, true))
}
const preview = ref<Item | null>(null)
const previewOpen = ref(false)
function showPreview(it: Item) { preview.value = it; previewOpen.value = true }

// --- Actions ---
const pane = ref<HTMLElement | null>(null)
const notes = ref<string[]>([])
const renaming = ref('')
const renameValue = ref('')
const renameInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null)
const newInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null)
const focusIn = (r: () => typeof renameInput.value) => nextTick(() => { const v = r(); const el = Array.isArray(v) ? v[0] : v; el?.focus(); el?.select() })
const creating = ref<{ name: string } | null>(null)

function startRename(it: Item) {
  if (props.readonly || it.kind === 'logement') return
  renaming.value = key(it); renameValue.value = it.name
  focusIn(() => renameInput.value)
}
async function commitRename(it: Item) {
  if (renaming.value !== key(it)) return
  renaming.value = ''
  const name = renameValue.value.trim()
  if (!name || name === it.name) return
  await call(() => $fetch(`/api/explorer/${it.id}`, { method: 'PATCH', body: { name } }))
}
function newFolder() {
  if (!canWrite.value) return
  creating.value = { name: 'Nouveau dossier' }
  focusIn(() => newInput.value)
}
async function commitNew() {
  const c = creating.value
  if (!c) return
  creating.value = null
  const name = c.name.trim()
  if (!name) return
  await call(() => $fetch('/api/explorer/folder', { method: 'POST', body: { logement: loc.value.logement, parent: loc.value.folder ?? null, name } }))
}
async function removeSel() {
  if (props.readonly) return
  const list = selItems.value.filter(i => i.kind !== 'logement')
  if (!list.length) return
  const hasFolder = list.some(i => i.kind === 'folder')
  if (!confirm(`Supprimer définitivement ${list.length > 1 ? `ces ${list.length} éléments` : `« ${list[0]!.name} »`}${hasFolder ? ' (dossiers : tout leur contenu sera effacé)' : ''} ? Cette action est irréversible.`)) return
  await call(async () => { for (const i of list) await $fetch(`/api/explorer/${i.id}`, { method: 'DELETE' }); selected.value = [] })
}
async function call(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() } catch (e) { error.value = msg(e) }
  await refresh()
}

// --- Envoi de fichiers ---
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
async function upload(files: File[], target: Loc = loc.value) {
  if (props.readonly || !files.length || target.logement === undefined) return
  uploading.value = true
  error.value = ''
  notes.value = []
  const body = new FormData()
  body.append('logement', String(target.logement))
  if (target.folder) body.append('parent', String(target.folder))
  for (const f of files) body.append('file', f)
  try {
    const r = await $fetch<{ added: number; errors: string[] }>('/api/explorer/upload', { method: 'POST', body })
    notes.value = r.errors
  } catch (e) { error.value = msg(e) }
  uploading.value = false
  await refresh()
}
function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  const files = [...(el.files ?? [])]
  el.value = ''
  upload(files)
}

// --- Glisser-déposer : fichiers du Bureau (dépôt) et éléments internes (déplacement, dans un même logement) ---
const MIME = 'application/x-explorer-items'
const dropHint = ref('')
const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')
function onDragStart(it: Item, e: DragEvent) {
  if (props.readonly || it.kind === 'logement') { e.preventDefault(); return }
  if (!isSel(it)) selected.value = [key(it)]
  e.dataTransfer?.setData(MIME, JSON.stringify(selItems.value.filter(i => i.kind !== 'logement').map(i => ({ id: i.id, logement: i.logementId }))))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOverRoot(e: DragEvent) { if (hasFiles(e) && canWrite.value) dropHint.value = 'root' }
function onDragOverItem(it: Item) { if (it.kind !== 'file') dropHint.value = key(it) }
async function onDropRoot(e: DragEvent) {
  dropHint.value = ''
  if (!canWrite.value) return
  if (hasFiles(e)) await upload([...(e.dataTransfer?.files ?? [])])
  else await moveTo({ logement: loc.value.logement, folder: loc.value.folder ?? null }, e)
}
async function onDropItem(it: Item, e: DragEvent) {
  dropHint.value = ''
  if (it.kind === 'file') return
  const target: Loc = it.kind === 'logement' ? { logement: it.id } : { logement: it.logementId, folder: it.id }
  if (hasFiles(e)) await upload([...(e.dataTransfer?.files ?? [])], target)
  else await moveTo({ logement: target.logement, folder: target.folder ?? null }, e)
}
async function dropOnLogement(id: number, e: DragEvent) {
  dropHint.value = ''
  if (hasFiles(e)) await upload([...(e.dataTransfer?.files ?? [])], { logement: id })
  else await moveTo({ logement: id, folder: null }, e)
}
async function dropOnCrumb(c: { loc: Loc; search?: boolean }, e: DragEvent) {
  dropHint.value = ''
  if (c.search || c.loc.logement === undefined) return
  if (hasFiles(e)) await upload([...(e.dataTransfer?.files ?? [])], c.loc)
  else await moveTo({ logement: c.loc.logement, folder: c.loc.folder ?? null }, e)
}
async function moveTo(target: { logement?: number; folder: number | null }, e: DragEvent) {
  if (props.readonly) return
  let moved: { id: number; logement: number }[] = []
  try { moved = JSON.parse(e.dataTransfer?.getData(MIME) || '[]') } catch { /* rien à déplacer */ }
  if (!moved.length) return
  if (moved.some(m => m.logement !== target.logement)) { error.value = 'Un élément reste dans son logement : le déplacement entre logements n\'est pas possible.'; return }
  await call(async () => { for (const m of moved) if (m.id !== target.folder) await $fetch(`/api/explorer/${m.id}`, { method: 'PATCH', body: { parent: target.folder } }) })
}

// --- Étiquettes : pose sur la sélection, gestion (créer, renommer, recolorer, supprimer) ---
async function setTag(id: number, on: boolean) {
  if (props.readonly) return
  const nodes = selItems.value.filter(i => i.kind !== 'logement').map(i => i.id)
  if (!nodes.length) return
  await call(() => $fetch('/api/explorer/tags/assign', { method: 'POST', body: { nodes, [on ? 'add' : 'remove']: [id] } }))
  await refreshTags()
}
const manageOpen = ref(false)
const tagError = ref('')
const newTag = reactive({ name: '', color: 'blue' })
async function tagCall(fn: () => Promise<unknown>) {
  tagError.value = ''
  try { await fn() } catch (e) { tagError.value = msg(e) }
  await Promise.all([refreshTags(), refresh()])
}
const addTag = () => newTag.name.trim() && tagCall(async () => { await $fetch('/api/explorer/tags', { method: 'POST', body: { name: newTag.name, color: newTag.color } }); newTag.name = '' })
const recolor = (t: Tag, color: string) => tagCall(() => $fetch(`/api/explorer/tags/${t.id}`, { method: 'PATCH', body: { color } }))
const onRename = (t: Tag, e: Event) => {
  const name = (e.target as HTMLInputElement).value.trim()
  if (name && name !== t.name) return tagCall(() => $fetch(`/api/explorer/tags/${t.id}`, { method: 'PATCH', body: { name } }))
  ;(e.target as HTMLInputElement).value = t.name
}
async function removeTag(t: Tag & { count?: number }) {
  if (!confirm(`Supprimer l'étiquette « ${t.name} » ? Elle sera retirée de ${t.count ?? 0} élément(s) ; aucun fichier n'est supprimé.`)) return
  if (tagFilter.value === t.id) tagFilter.value = null
  await tagCall(() => $fetch(`/api/explorer/tags/${t.id}`, { method: 'DELETE' }))
}

// --- Clavier et menu contextuel ---
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement).tagName === 'INPUT') return
  const one = selItems.value.length === 1 ? selItems.value[0]! : null
  if (e.key === ' ' && one && one.kind === 'file' && one.inline) { e.preventDefault(); showPreview(one) }
  else if (e.key === 'Enter' && one) { e.preventDefault(); startRename(one) }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selItems.value.length) { e.preventDefault(); removeSel() }
  else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); selected.value = items.value.map(key) }
  else if (e.key === 'Escape') selected.value = []
  else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const ks = items.value.map(key)
    const i = ks.indexOf(selected.value.at(-1) ?? '')
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? Math.min(ks.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1)
    if (ks[next]) { selected.value = [ks[next]!]; anchor = ks[next]! }
  }
}
function onContextItem(it: Item) { if (!isSel(it)) selected.value = [key(it)] }
function onContextBlank(e: MouseEvent) { if (e.target === pane.value) selected.value = [] }
const menuItems = computed(() => {
  const one = selItems.value.length === 1 ? selItems.value[0]! : null
  if (!selItems.value.length) {
    return [[
      { label: 'Nouveau dossier', icon: 'i-lucide-folder-plus', disabled: !canWrite.value, onSelect: newFolder },
      { label: 'Ajouter des fichiers…', icon: 'i-lucide-upload', disabled: !canWrite.value, onSelect: () => fileInput.value?.click() },
    ]]
  }
  const real = selItems.value.some(i => i.kind !== 'logement') && !props.readonly
  return [
    [
      { label: 'Ouvrir', icon: 'i-lucide-folder-open', disabled: !one, onSelect: () => one && open(one) },
      { label: 'Aperçu', icon: 'i-lucide-eye', disabled: !one || one.kind !== 'file' || !one.inline, onSelect: () => one && showPreview(one) },
      { label: 'Télécharger', icon: 'i-lucide-download', disabled: !one || one.kind !== 'file', onSelect: () => one && window.location.assign(fileUrl(one, true)) },
    ],
    [
      { label: 'Renommer', icon: 'i-lucide-pencil', disabled: !one || one.kind === 'logement', onSelect: () => one && startRename(one) },
      { label: 'Supprimer', icon: 'i-lucide-trash-2', color: 'error' as const, disabled: !real, onSelect: removeSel },
    ],
    [
      {
        label: 'Étiquettes', icon: 'i-lucide-tag', disabled: !real,
        children: [
          ...tags.value.map(t => {
            const all = selItems.value.length > 0 && selItems.value.every(i => i.tags?.some(x => x.id === t.id))
            return { label: t.name, type: 'checkbox' as const, checked: all, onUpdateChecked: (v: boolean) => setTag(t.id, v) }
          }),
          ...(tags.value.length ? [{ type: 'separator' as const }] : []),
          { label: 'Gérer les étiquettes…', icon: 'i-lucide-settings-2', onSelect: () => { manageOpen.value = true } },
        ],
      },
    ],
  ]
})
</script>

<style scoped>
.side { display: flex; width: 100%; align-items: center; gap: 0.5rem; border-radius: 0.375rem; padding: 0.25rem 0.5rem; text-align: left; }
.side:hover { background: var(--ui-bg-elevated); }
.side.on { background: color-mix(in oklab, var(--ui-primary) 18%, transparent); font-weight: 600; }
.drop { outline: 2px solid var(--ui-primary); outline-offset: -2px; }
.cell { display: flex; cursor: default; flex-direction: column; align-items: center; gap: 0.25rem; border-radius: 0.5rem; padding: 0.5rem 0.25rem; user-select: none; }
.cell:hover, .row:hover { background: var(--ui-bg-elevated); }
.cell.sel, .row.sel { background: color-mix(in oklab, var(--ui-primary) 22%, transparent); }
.row { cursor: default; user-select: none; }
.rename { width: 100%; min-width: 0; border-radius: 0.25rem; border: 1px solid var(--ui-primary); background: var(--ui-bg); padding: 0 0.25rem; text-align: center; font-size: 0.75rem; outline: none; }
</style>
