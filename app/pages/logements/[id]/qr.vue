<template>
  <div v-if="data" class="space-y-3">
    <h2 class="section-title !mt-0 print:hidden">QR code ménage</h2>
    <p class="text-sm text-muted print:hidden">À imprimer et à coller dans le logement (placard, local ménage). La personne qui fait le ménage le scanne pour indiquer l'état du stock, sans compte.</p>
    <UCard class="mx-auto max-w-xs text-center">
      <p class="mb-2 text-lg font-semibold">{{ data.logement.name }}</p>
      <img :src="`/api/stock/qr/${data.propertyId}?v=${data.token.slice(0, 6)}`" :alt="`QR code ${data.logement.name}`" class="mx-auto h-56 w-56 rounded bg-white p-1">
      <p class="mt-2 text-sm">Scanne pour indiquer le stock</p>
      <p class="mt-1 break-all text-xs text-muted print:hidden">/r/{{ data.token }}</p>
    </UCard>
    <div class="flex flex-wrap justify-center gap-2 print:hidden">
      <UButton icon="i-lucide-printer" label="Imprimer" @click="print()" />
      <UButton color="neutral" variant="outline" label="Ouvrir la page ménage" :to="`/r/${data.token}`" target="_blank" />
      <UButton color="neutral" variant="outline" label="Nouveau lien" @click="regenerate()" />
    </div>
    <p v-if="error" class="text-center text-sm text-error print:hidden">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/stock`)
const error = ref('')
const print = () => window.print()
async function regenerate() {
  if (!data.value || !confirm(`Générer un nouveau lien pour ${data.value.logement.name} ? Le QR code imprimé actuel cessera de fonctionner.`)) return
  error.value = ''
  try { await $fetch('/api/stock/token', { method: 'POST', body: { propertyId: data.value.propertyId } }); await refresh() }
  catch { error.value = 'Échec, réessaie.' }
}
</script>
