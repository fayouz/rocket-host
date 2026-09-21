<template>
  <div v-if="data" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">Documents</h2>
      <div class="flex items-center gap-2">
        <USelect v-model="year" :items="yearItems" class="w-36" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" label="Export CSV" :to="csvUrl" external target="_blank" />
      </div>
    </div>
    <p class="text-sm text-muted">
      Factures, taxes, assurances… déposés par logement, avec une date, une catégorie et un montant : ils alimentent le Bilan de l'année.
      Fichiers acceptés : PDF, images, Excel, Word, CSV, texte — {{ Math.round(data.maxSize / 1048576) }} Mo au plus.
    </p>

    <UCard>
      <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="upload">
        <input ref="fileInput" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.xlsx,.docx"
               class="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-2 file:text-sm sm:col-span-2" @change="onFile">
        <UInput v-model="form.title" placeholder="Titre (par défaut : nom du fichier)" />
        <USelect v-model="form.category" :items="categoryItems" />
        <UInput v-model="form.date" type="date" />
        <UInput v-model="form.amount" inputmode="decimal" placeholder="Montant en € (facultatif)" />
        <UInput v-model="form.note" class="sm:col-span-2" placeholder="Note (facultatif)" />
        <UButton type="submit" class="sm:col-span-2" icon="i-lucide-upload" label="Ajouter le document" :loading="busy" :disabled="!file" block />
      </form>
      <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
    </UCard>

    <UCard v-for="d in data.items" :key="d.id">
      <template v-if="editing !== d.id">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-medium">{{ d.title }}</p>
            <p class="text-sm text-muted">{{ fr(d.date) }} · {{ d.fileName }} · {{ size(d.size) }}</p>
            <p v-if="d.note" class="text-sm text-muted">{{ d.note }}</p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <UBadge :color="d.kind === 'charge' ? 'warning' : d.kind === 'recette' ? 'success' : 'neutral'" variant="subtle" :label="d.categoryLabel" />
            <UBadge v-if="d.source !== 'manuel'" color="info" variant="outline" size="sm" :label="`Import : ${d.source}`" />
            <b v-if="d.amount !== null">{{ eur(d.amount) }}</b>
            <span v-else-if="d.kind !== 'doc'" class="text-xs text-warning">Montant à renseigner</span>
          </div>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          <UButton v-if="d.inline" size="xs" color="neutral" variant="outline" icon="i-lucide-eye" label="Voir" :to="`/api/documents/${d.id}/file`" external target="_blank" />
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-download" label="Télécharger" :to="`/api/documents/${d.id}/file?download=1`" external />
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" label="Modifier" @click="startEdit(d)" />
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" label="Supprimer" @click="remove(d)" />
        </div>
      </template>
      <form v-else class="grid gap-2 sm:grid-cols-2" @submit.prevent="saveEdit(d.id)">
        <UInput v-model="edit.title" placeholder="Titre" />
        <USelect v-model="edit.category" :items="categoryItems" />
        <UInput v-model="edit.date" type="date" />
        <UInput v-model="edit.amount" inputmode="decimal" placeholder="Montant en €" />
        <UInput v-model="edit.note" class="sm:col-span-2" placeholder="Note" />
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" label="Enregistrer" />
          <UButton color="neutral" variant="ghost" label="Annuler" @click="editing = null" />
        </div>
      </form>
    </UCard>
    <UCard v-if="!data.items.length"><p class="text-sm text-muted">Aucun document {{ year === 'all' ? '' : `en ${year}` }}.</p></UCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const year = ref(String(new Date().getFullYear()))
const yearParam = computed(() => (year.value === 'all' ? undefined : year.value))
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/documents`, { query: { year: yearParam } })

const yearItems = computed(() => {
  const ys = new Set([String(new Date().getFullYear()), ...(data.value?.years ?? [])])
  return [{ label: 'Toutes les années', value: 'all' }, ...[...ys].sort().reverse().map(y => ({ label: y, value: y }))]
})
// Categories groupees par nature (charges / recettes / justificatifs)
const categoryItems = computed(() => {
  const groups: Record<string, string> = { charge: 'Charges', recette: 'Recettes', doc: 'Justificatifs' }
  return Object.entries(groups).map(([kind, label]) => [
    { type: 'label' as const, label },
    ...(data.value?.categories ?? []).filter(c => c.kind === kind).map(c => ({ label: c.label, value: c.key })),
  ])
})
const csvUrl = computed(() => `/api/logements/${route.params.id}/documents.csv${yearParam.value ? `?year=${yearParam.value}` : ''}`)

const today = () => new Date().toISOString().slice(0, 10)
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const form = reactive({ title: '', category: 'autre_charge', date: today(), amount: '', note: '' })
const busy = ref(false)
const error = ref('')
const msg = (e: any) => e?.data?.statusMessage || 'Échec, réessaie.'
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''
  if (f && data.value && f.size > data.value.maxSize) { error.value = `Fichier trop volumineux (${Math.round(data.value.maxSize / 1048576)} Mo au plus).`; if (fileInput.value) fileInput.value.value = ''; file.value = null; return }
  file.value = f
}
async function upload() {
  if (!file.value) return
  busy.value = true
  error.value = ''
  const body = new FormData()
  body.append('title', form.title)
  body.append('category', form.category)
  body.append('date', form.date)
  body.append('amount', form.amount)
  body.append('note', form.note)
  body.append('file', file.value)
  try {
    await $fetch(`/api/logements/${route.params.id}/documents`, { method: 'POST', body })
    Object.assign(form, { title: '', amount: '', note: '' })
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
    year.value = form.date.slice(0, 4) // affiche l'annee du document ajoute
    await refresh()
  } catch (e) { error.value = msg(e) }
  busy.value = false
}

const editing = ref<number | null>(null)
const edit = reactive({ title: '', category: 'autre_charge', date: '', amount: '', note: '' })
function startEdit(d: { id: number; title: string; category: string; date: string; amount: number | null; note: string }) {
  Object.assign(edit, { title: d.title, category: d.category, date: d.date, amount: d.amount === null ? '' : String(d.amount), note: d.note })
  editing.value = d.id
}
async function saveEdit(id: number) {
  error.value = ''
  try { await $fetch(`/api/documents/${id}`, { method: 'PUT', body: { ...edit } }); editing.value = null; await refresh() }
  catch (e) { error.value = msg(e) }
}
async function remove(d: { id: number; title: string }) {
  if (!confirm(`Supprimer définitivement « ${d.title} » ? Le fichier sera effacé.`)) return
  error.value = ''
  try { await $fetch(`/api/documents/${d.id}`, { method: 'DELETE' }); await refresh() }
  catch (e) { error.value = msg(e) }
}

const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`)
</script>
