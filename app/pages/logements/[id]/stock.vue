<template>
  <!-- Rocket PMS actif : niveaux du lieu dans Rocket Place (le catalogue se gere dans Rocket Place) -->
  <div v-if="data?.pms" class="space-y-2">
    <h2 class="section-title !mt-0">Stock</h2>
    <p class="text-sm text-muted">
      {{ pmsToBuy ? `${pmsToBuy} article${pmsToBuy > 1 ? 's' : ''} à racheter.` : 'Rien à racheter.' }}
      Stock du lieu dans Rocket Place (via Rocket PMS) : le catalogue et les articles suivis se gèrent là-bas.
    </p>
    <UCard v-for="it in data.lines" :key="it.levelId" :class="{ 'border-l-4 border-l-warning': it.level === 'low', 'border-l-4 border-l-error': it.level === 'empty' }">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="font-medium">{{ it.name }}<UBadge v-if="it.subscription" class="ml-2" color="info" variant="subtle" label="Abonnement Amazon" /></span>
        <div class="flex items-center gap-1">
          <UButton v-for="l in levels" :key="l.value" size="sm" :label="l.label" :color="l.color" :variant="it.level === l.value ? 'solid' : 'outline'" @click="setPms(it, l.value)" />
        </div>
      </div>
    </UCard>
    <UCard v-if="!data.lines.length"><p class="text-sm text-muted">Ce lieu ne suit aucun article dans Rocket Place.</p></UCard>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
  <div v-else-if="data" class="space-y-2">
    <h2 class="section-title !mt-0">Stock</h2>
    <p class="text-sm text-muted">
      {{ toBuy ? `${toBuy} article${toBuy > 1 ? 's' : ''} à racheter.` : 'Rien à racheter.' }}
      Ce logement suit {{ data.items.length }} article{{ data.items.length > 1 ? 's' : '' }}. La personne qui fait le ménage met à jour les niveaux avec le QR code ; tu peux aussi les corriger ici.
      Le catalogue et le panier Amazon sont dans Réglages, Stock.
    </p>
    <UCard v-for="it in data.items" :key="it.id" :class="{ 'border-l-4 border-l-warning': it.level === 'low', 'border-l-4 border-l-error': it.level === 'empty' }">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="font-medium">{{ it.name }}<UBadge v-if="it.subscription" class="ml-2" color="info" variant="subtle" label="Abonnement Amazon" /></span>
        <div class="flex items-center gap-1">
          <UButton v-for="l in levels" :key="l.value" size="sm" :label="l.label" :color="l.color" :variant="it.level === l.value ? 'solid' : 'outline'" @click="set(it, l.value)" />
          <UButton size="sm" icon="i-lucide-x" color="neutral" variant="ghost" title="Ne plus suivre cet article dans ce logement" @click="untrack(it)" />
        </div>
      </div>
    </UCard>
    <UCard v-if="!data.items.length"><p class="text-sm text-muted">Ce logement ne suit aucun article : ajoutes-en ci-dessous.</p></UCard>

    <h2 class="section-title">Ajouter un article à ce logement</h2>
    <div v-if="data.available.length" class="flex gap-2">
      <USelect v-model="pick" :items="data.available.map(a => ({ label: a.name, value: a.id }))" placeholder="Article du catalogue" class="flex-1" />
      <UButton label="Ajouter" :disabled="!pick" @click="addExisting" />
    </div>
    <div class="flex gap-2">
      <UInput v-model="newName" placeholder="Nouvel article (suivi uniquement dans ce logement)" class="flex-1" @keyup.enter="addNew" />
      <UButton label="Créer" :disabled="!newName.trim()" @click="addNew" />
    </div>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/stock`)
const levels = [
  { value: 'ok', label: 'OK', color: 'success' },
  { value: 'low', label: 'Bas', color: 'warning' },
  { value: 'empty', label: 'Vide', color: 'error' },
] as const
const error = ref('')
const pick = ref<number | undefined>()
const newName = ref('')
const toBuy = computed(() => data.value && !data.value.pms ? data.value.items.filter(i => i.level !== 'ok').length : 0)
const pmsToBuy = computed(() => data.value?.pms ? data.value.lines.filter(i => i.level !== 'ok').length : 0)
async function setPms(it: { levelId: string; level: string }, level: string) {
  const previous = it.level
  it.level = level
  try { await $fetch(`/api/logements/${route.params.id}/pms-stock/${it.levelId}`, { method: 'PUT', body: { level } }); error.value = '' }
  catch (e: any) { it.level = previous; error.value = e?.data?.statusMessage || 'Échec de l’enregistrement, réessaie.' }
}
const pid = () => (data.value && !data.value.pms ? data.value.propertyId : 0)
async function run(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec de l’enregistrement, réessaie.' }
  await refresh()
}
async function set(it: { id: number; level: string }, level: string) {
  const previous = it.level
  it.level = level // affichage immediat, annule si l'envoi echoue
  try { await $fetch('/api/stock/level', { method: 'PUT', body: { propertyId: pid(), itemId: it.id, level } }); error.value = '' }
  catch { it.level = previous; error.value = 'Échec de l’enregistrement, réessaie.' }
}
const untrack = (it: { id: number; name: string }) => {
  if (confirm(`Ne plus suivre « ${it.name} » dans ce logement ? Son niveau actuel sera oublié (l'article reste dans le catalogue).`))
    return run(() => $fetch('/api/stock/track', { method: 'PUT', body: { propertyId: pid(), itemId: it.id, tracked: false } }))
}
const addExisting = () => { const itemId = pick.value; pick.value = undefined; if (itemId) return run(() => $fetch('/api/stock/track', { method: 'PUT', body: { propertyId: pid(), itemId, tracked: true } })) }
const addNew = () => { const name = newName.value.trim(); if (!name) return; newName.value = ''; return run(() => $fetch('/api/stock/items', { method: 'POST', body: { name, propertyIds: [pid()] } })) }
</script>
