<template>
  <div v-if="data" class="space-y-2">
    <h2 class="section-title !mt-0 print:hidden">À racheter</h2>
    <div class="space-y-2 print:hidden">
      <UCard v-for="s in data.shopping" :key="s.itemId">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <b>{{ s.name }}</b> <span class="text-sm text-muted">× {{ s.qty }}</span>
            <UBadge v-if="s.subscription" class="ml-2" color="info" variant="subtle" label="Abonnement Amazon" />
            <p class="mt-1 flex flex-wrap gap-1">
              <UBadge v-for="n in s.needing" :key="n.propertyId" :color="n.level === 'empty' ? 'error' : 'warning'" variant="subtle" :label="`${n.property} · ${n.level === 'empty' ? 'Vide' : 'Bas'}`" />
            </p>
          </div>
          <UButton label="Réapprovisionné" color="neutral" variant="outline" @click="restocked(s)" />
        </div>
      </UCard>
      <UCard v-if="!data.shopping.length"><p class="text-sm text-muted">Rien à racheter.</p></UCard>
      <div class="flex flex-wrap items-center gap-3">
        <UButton v-if="data.amazonUrl" :to="data.amazonUrl" target="_blank" icon="i-lucide-shopping-cart" label="Ouvrir le panier Amazon" />
        <UButton v-else label="Ouvrir le panier Amazon" icon="i-lucide-shopping-cart" disabled />
        <span class="text-sm text-muted">{{ data.amazonUrl ? 'Le panier s’ouvre pré-rempli : tu vérifies et tu valides toi-même la commande.' : 'Renseigne la référence Amazon (ASIN) des articles à racheter dans le catalogue.' }}</span>
      </div>
    </div>

    <p class="text-sm text-muted print:hidden">Niveaux par logement et QR codes : dans le menu de chaque logement (Stock, QR code ménage).</p>

    <h2 class="section-title print:hidden">Catalogue</h2>
    <div class="space-y-2 print:hidden">
      <UCard v-for="it in data.items" :key="it.id">
        <div class="grid gap-2 sm:grid-cols-[2fr_1.5fr_5rem_auto_auto] sm:items-center">
          <UInput v-model="it.name" placeholder="Nom" @change="save(it, { name: it.name })" />
          <UInput v-model="it.asin" placeholder="Réf. Amazon (ASIN)" @change="save(it, { asin: it.asin })" />
          <UInput v-model.number="it.reorderQty" type="number" min="1" max="99" title="Quantité à racheter par logement" @change="save(it, { reorderQty: it.reorderQty })" />
          <USwitch v-model="it.subscription" label="Abonnement" @update:model-value="save(it, { subscription: it.subscription })" />
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" title="Supprimer" @click="remove(it)" />
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-default pt-3">
          <span class="text-sm text-muted">Suivi dans :</span>
          <USwitch v-for="p in data.properties" :key="p.id" size="sm" :label="p.name" :model-value="it.propertyIds.includes(p.id)"
                   @update:model-value="track(p.id, it.id, $event)" />
        </div>
      </UCard>
      <div class="flex gap-2">
        <UInput v-model="newName" placeholder="Nouvel article" class="flex-1" @keyup.enter="add" />
        <UButton label="Ajouter" @click="add" />
      </div>
      <p class="text-sm text-muted">Chaque logement suit ses propres articles : les interrupteurs « Suivi dans » choisissent lesquels (un nouvel article est suivi partout par défaut). La quantité est le nombre à racheter par logement quand l'article est bas ou vide (ex. un lot de 12 = 1). Coche « Abonnement » si Amazon te le livre déjà tout seul : il n'ira pas dans le panier.</p>
      <p v-if="error" class="text-sm text-error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data, refresh } = await useFetch('/api/stock')
const newName = ref('')
const error = ref('')
const msg = (e: any) => e?.data?.statusMessage || 'Échec de l’enregistrement'
async function call(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() } catch (e) { error.value = msg(e) }
  await refresh()
}
const track = (propertyId: number, itemId: number, tracked: boolean) => call(() => $fetch('/api/stock/track', { method: 'PUT', body: { propertyId, itemId, tracked } }))
const save = (it: { id: number }, body: object) => call(() => $fetch(`/api/stock/items/${it.id}`, { method: 'PUT', body }))
const add = () => { const name = newName.value.trim(); if (!name) return; newName.value = ''; return call(() => $fetch('/api/stock/items', { method: 'POST', body: { name } })) }
const remove = (it: { id: number; name: string }) => { if (confirm(`Supprimer « ${it.name} » du catalogue (pour tous les logements) ?`)) return call(() => $fetch(`/api/stock/items/${it.id}`, { method: 'DELETE' })) }
const restocked = (s: { itemId: number; needing: { propertyId: number }[] }) =>
  call(() => Promise.all(s.needing.map(n => $fetch('/api/stock/level', { method: 'PUT', body: { propertyId: n.propertyId, itemId: s.itemId, level: 'ok' } }))))
</script>
