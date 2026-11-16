<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="q" icon="i-lucide-search" :placeholder="t('daily.contacts.search')" class="min-w-56 flex-1" />
      <USelect v-model="kind" :items="kindItems" class="w-56" />
      <USelect v-if="!logementId" v-model="lg" :items="logementFilterItems" class="w-56" />
      <UButton icon="i-lucide-user-plus" :label="t('daily.dashboard.newContact')" @click="startNew" />
    </div>

    <UCard v-if="editing">
      <p class="mb-2 text-sm font-medium">{{ form.id ? t('daily.contacts.edit') : t('daily.dashboard.newContact') }}</p>
      <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="save">
        <UInput v-model="form.name" :placeholder="t('daily.contacts.namePh')" />
        <USelect v-model="form.kind" :items="kindOptions" />
        <UInput v-model="form.company" :placeholder="t('daily.contacts.company')" />
        <UInput v-model="form.email" type="email" :placeholder="t('daily.res.email')" />
        <UInput v-model="form.phone" type="tel" :placeholder="t('daily.contacts.phone')" />
        <UInput v-model="form.phone2" type="tel" :placeholder="t('daily.contacts.phone2')" />
        <UInput v-model="form.website" :placeholder="t('daily.contacts.website')" />
        <UInput v-model="form.followUp" type="date" :title="t('daily.contacts.followUpOn')" />
        <UInput v-model="form.address" class="sm:col-span-2" :placeholder="t('daily.contacts.address')" />
        <UTextarea v-model="form.note" class="sm:col-span-2" :placeholder="t('daily.contacts.notesPh')" :rows="2" />
        <USelectMenu v-model="form.logementIds" multiple value-key="value" :items="logementOptions" :placeholder="t('daily.contacts.allLeaveEmpty')" class="sm:col-span-2" />
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" :label="form.id ? t('daily.contacts.save') : t('daily.contacts.addContact')" :loading="busy" />
          <UButton color="neutral" variant="ghost" :label="t('daily.contacts.cancel')" @click="editing = false" />
        </div>
      </form>
      <p class="mt-2 text-xs text-muted">{{ t('daily.contacts.scopeNote') }}</p>
    </UCard>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <UCard v-for="c in data?.contacts ?? []" :key="c.id">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="font-medium">{{ c.name }}<span v-if="c.company" class="text-muted"> · {{ c.company }}</span></p>
          <p class="mt-1 flex flex-wrap gap-1">
            <UBadge color="primary" variant="subtle" :label="c.kindLabel" />
            <UBadge v-if="c.all" color="neutral" variant="outline" :label="t('daily.dashboard.allLogements')" />
            <UBadge v-for="i in c.logementIds" :key="i" color="neutral" variant="outline" :label="logementName(i)" />
            <UBadge v-if="c.followUp" :color="c.followUp < (data?.today ?? '') ? 'error' : c.followUp <= soon ? 'warning' : 'neutral'" variant="subtle"
                    :label="t(c.followUp < (data?.today ?? '') ? 'daily.contacts.followLate' : 'daily.contacts.followDue', { date: fr(c.followUp) })" />
          </p>
        </div>
        <div class="flex gap-1">
          <UButton v-if="c.email" size="xs" color="neutral" variant="outline" icon="i-lucide-mails" :label="t('daily.pms.emails')" :to="`/mail?contact=${c.id}`" />
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-pencil" :label="t('daily.contacts.modify')" @click="startEdit(c)" />
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="remove(c)" />
        </div>
      </div>

      <ul class="mt-2 space-y-0.5 text-sm">
        <li v-if="c.phone"><UIcon name="i-lucide-phone" class="mr-1 align-[-2px]" /><a :href="`tel:${tel(c.phone)}`" class="hover:underline">{{ c.phone }}</a></li>
        <li v-if="c.phone2"><UIcon name="i-lucide-phone" class="mr-1 align-[-2px]" /><a :href="`tel:${tel(c.phone2)}`" class="hover:underline">{{ c.phone2 }}</a></li>
        <li v-if="c.email"><UIcon name="i-lucide-mail" class="mr-1 align-[-2px]" /><a :href="`mailto:${c.email}`" class="hover:underline">{{ c.email }}</a></li>
        <li v-if="c.website"><UIcon name="i-lucide-globe" class="mr-1 align-[-2px]" /><a :href="c.website" target="_blank" rel="noopener noreferrer" class="hover:underline">{{ c.website }}</a></li>
        <li v-if="c.address" class="text-muted"><UIcon name="i-lucide-map-pin" class="mr-1 align-[-2px]" />{{ c.address }}</li>
      </ul>
      <p v-if="c.note" class="mt-2 whitespace-pre-line text-sm text-muted">{{ c.note }}</p>

      <div class="mt-3 border-t border-default pt-2">
        <details :open="c.interactions.length > 0 && c.interactions.length <= 2">
          <summary class="cursor-pointer text-sm text-muted">{{ t('daily.contacts.history', { n: c.interactions.length }) }}</summary>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="i in c.interactions" :key="i.id" class="flex items-start justify-between gap-2">
              <span><span class="text-muted">{{ fr(i.at) }}</span> — {{ i.note }}</span>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :title="t('daily.contacts.deleteExchange')" @click="removeInteraction(c, i)" />
            </li>
          </ul>
        </details>
        <form class="mt-2 flex flex-wrap gap-2" @submit.prevent="addInteraction(c)">
          <UInput v-model="notes[c.id]" :placeholder="t('daily.contacts.noteExchange')" class="min-w-56 flex-1" />
          <UButton type="submit" size="sm" color="neutral" variant="outline" :label="t('daily.stock.add')" :disabled="!(notes[c.id] || '').trim()" />
        </form>
      </div>
    </UCard>
    <UCard v-if="data && !data.contacts.length"><p class="text-sm text-muted">{{ q || kind !== 'all' || lg !== 0 ? t('daily.contacts.noneSearch') : t('daily.contacts.none') }}</p></UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ logementId?: number }>()
const { t } = useI18n()
const { fmtLocale } = useLocaleFormat()
const q = ref('')
const qd = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(q, (v) => { clearTimeout(timer); timer = setTimeout(() => { qd.value = v }, 250) })
const kind = ref('all')
const lg = ref(0)

const { data: lgData } = await useFetch('/api/logements', { key: 'logements' })
const { data, refresh } = await useFetch('/api/contacts', {
  query: { q: qd, kind: computed(() => (kind.value === 'all' ? undefined : kind.value)), logementId: computed(() => props.logementId || lg.value || undefined) },
})

const kindOptions = computed(() => (data.value?.kinds ?? []).map(k => ({ label: k.label, value: k.key })))
const kindItems = computed(() => [{ label: t('daily.contacts.allTypes'), value: 'all' }, ...kindOptions.value])
const logementOptions = computed(() => (lgData.value?.logements ?? []).map(l => ({ label: l.name, value: l.id })))
const logementFilterItems = computed(() => [{ label: t('daily.dashboard.allLogements'), value: 0 }, ...logementOptions.value])
const logementName = (id: number) => lgData.value?.logements.find(l => l.id === id)?.name ?? t('daily.contacts.logementN', { n: id })
const soon = computed(() => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10))

const blank = () => ({ id: 0, name: '', kind: 'autre', company: '', phone: '', phone2: '', email: '', website: '', address: '', note: '', followUp: '', logementIds: props.logementId ? [props.logementId] : [] as number[] })
const form = reactive(blank())
const editing = ref(false)
const busy = ref(false)
const error = ref('')
const notes = reactive<Record<number, string>>({})

const startNew = () => { Object.assign(form, blank()); error.value = ''; editing.value = true }
const startEdit = (c: any) => { Object.assign(form, { ...blank(), ...c, followUp: c.followUp ?? '', logementIds: [...c.logementIds] }); error.value = ''; editing.value = true }
async function run(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() } catch (e: any) { error.value = e?.data?.statusMessage || t('daily.contacts.failed'); return false }
  await refresh()
  return true
}
async function save() {
  busy.value = true
  const body = { ...form, followUp: form.followUp || null }
  const ok = await run(() => $fetch(form.id ? `/api/contacts/${form.id}` : '/api/contacts', { method: form.id ? 'PUT' : 'POST', body }))
  if (ok) editing.value = false
  busy.value = false
}
const remove = (c: { id: number; name: string }) => { if (confirm(t('daily.contacts.confirmDelete', { name: c.name }))) return run(() => $fetch(`/api/contacts/${c.id}`, { method: 'DELETE' })) }
async function addInteraction(c: { id: number }) {
  const note = (notes[c.id] || '').trim()
  if (note && await run(() => $fetch(`/api/contacts/${c.id}/interactions`, { method: 'POST', body: { note } }))) notes[c.id] = ''
}
const removeInteraction = (c: { id: number }, i: { id: number }) => run(() => $fetch(`/api/contacts/${c.id}/interactions/${i.id}`, { method: 'DELETE' }))

const tel = (p: string) => p.replace(/[^\d+]/g, '')
const fr = (d: string) => new Date(d).toLocaleDateString(fmtLocale.value, { day: 'numeric', month: 'short', year: 'numeric' })
</script>
