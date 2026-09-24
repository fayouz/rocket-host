<template>
  <div v-if="data" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">Bibliothèque de plugins</h2>
      <UTabs v-model="category" :items="categories" :content="false" size="sm" />
    </div>
    <p class="text-sm text-muted">
      Les plugins sont les services que l'appli sait brancher. Dans chaque logement (onglet <b>Connecteurs</b>), tu crées un ou plusieurs connecteurs
      à partir de ces plugins — par exemple deux Homey, ou plusieurs services web pour récupérer des documents.
    </p>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UCard v-for="p in shown" :key="p.id" :ui="{ body: 'flex h-full flex-col gap-3' }">
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><UIcon :name="p.icon" class="size-6 text-primary" /></span>
          <div class="min-w-0">
            <h3 class="font-semibold">{{ p.name }}</h3>
            <UBadge size="sm" color="neutral" variant="subtle" :label="CATEGORY_LABEL[p.category]" />
          </div>
        </div>
        <p class="flex-1 text-sm text-muted">{{ p.description }}</p>
        <div class="flex flex-wrap gap-1">
          <UBadge v-for="c in p.capabilities" :key="c" size="sm" variant="outline" :icon="CAP[c].icon" :label="CAP[c].label" />
        </div>
        <p class="text-xs text-muted">{{ p.connectors ? `Utilisé par ${p.connectors} connecteur${p.connectors > 1 ? 's' : ''}` : 'Pas encore utilisé' }}</p>
      </UCard>
    </div>
    <p class="text-xs text-muted">
      Pour brancher un service qui n'a pas de plugin dédié, utilise « Service web » (n'importe quelle API web). Les secrets (jetons, clés) ne sont
      jamais saisis dans l'appli : tu les ajoutes toi-même dans <code>.env</code> sous un nom commençant par <code>CONNECTOR_</code>.
    </p>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/plugins')
const CATEGORY_LABEL: Record<string, string> = { domotique: 'Domotique', documents: 'Documents', general: 'Général' }
const CAP: Record<string, { label: string; icon: string }> = {
  info: { label: 'Infos', icon: 'i-lucide-info' }, actions: { label: 'Actions', icon: 'i-lucide-zap' }, documents: { label: 'Documents', icon: 'i-lucide-folder-down' },
}
const categories = [{ label: 'Tous', value: 'all' }, { label: 'Domotique', value: 'domotique' }, { label: 'Documents', value: 'documents' }, { label: 'Général', value: 'general' }]
const category = ref('all')
// « Documents » montre aussi les plugins generaux capables de recuperer des documents (ex. Service web)
const shown = computed(() => (data.value?.plugins ?? []).filter(p => category.value === 'all' || p.category === category.value || (category.value === 'documents' && p.capabilities.includes('documents'))))
</script>
