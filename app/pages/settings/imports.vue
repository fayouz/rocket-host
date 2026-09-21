<template>
  <div v-if="data" class="space-y-3">
    <h2 class="section-title !mt-0">À classer</h2>
    <p class="text-sm text-muted">
      Documents importés (workflows n8n, e-mails…) sans logement reconnu. Choisis le logement, vérifie la catégorie, la date et le montant, puis classe-les :
      ils apparaissent alors dans l'onglet Documents du logement et comptent dans son bilan.
    </p>
    <UCard v-for="d in data.inbox" :key="d.id">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate font-medium">{{ d.title }}</p>
          <p class="text-sm text-muted">{{ fr(d.date) }} · {{ d.fileName }} · {{ size(d.size) }}</p>
          <p v-if="d.note" class="text-sm text-muted">{{ d.note }}</p>
        </div>
        <UBadge color="neutral" variant="outline" :label="d.source" />
      </div>
      <div class="mt-2 flex flex-wrap gap-1">
        <UButton v-if="d.inline" size="xs" color="neutral" variant="outline" icon="i-lucide-eye" label="Voir" :to="`/api/documents/${d.id}/file`" external target="_blank" />
        <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-download" label="Télécharger" :to="`/api/documents/${d.id}/file?download=1`" external />
      </div>
      <form class="mt-3 grid gap-2 sm:grid-cols-2" @submit.prevent="classify(d.id)">
        <USelect v-model="forms[d.id]!.logementId" :items="logementItems" placeholder="Logement" />
        <USelect v-model="forms[d.id]!.category" :items="categoryItems" />
        <UInput v-model="forms[d.id]!.date" type="date" />
        <UInput v-model="forms[d.id]!.amount" inputmode="decimal" placeholder="Montant en € (facultatif)" />
        <div class="flex gap-2 sm:col-span-2">
          <UButton type="submit" label="Classer" :disabled="!forms[d.id]!.logementId" />
          <UButton color="error" variant="ghost" icon="i-lucide-trash-2" label="Supprimer" @click="removeDoc(d)" />
        </div>
      </form>
    </UCard>
    <UCard v-if="!data.inbox.length"><p class="text-sm text-muted">Rien à classer.</p></UCard>

    <template v-if="data.unassignedTransactions.length">
      <h2 class="section-title">Relevés non affectés</h2>
      <p class="text-sm text-muted">Lignes de relevé importées sans logement reconnu : elles ne sont comptées dans aucun bilan tant qu'elles ne sont pas affectées.</p>
      <UCard v-for="u in data.unassignedTransactions" :key="u.source">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span><b>{{ u.source }}</b> · {{ u.count }} ligne{{ u.count > 1 ? 's' : '' }} · {{ eur(u.total) }}</span>
          <span class="flex gap-2">
            <USelect v-model="assign[u.source]" :items="logementItems" placeholder="Logement" class="w-48" />
            <UButton label="Affecter" :disabled="!assign[u.source]" @click="assignTx(u.source)" />
          </span>
        </div>
      </UCard>
    </template>

    <h2 class="section-title">Sources</h2>
    <UCard v-for="s in data.sources" :key="s.source">
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span><b>{{ s.source }}</b> · {{ s.documents }} document{{ s.documents > 1 ? 's' : '' }} · {{ s.transactions }} ligne{{ s.transactions > 1 ? 's' : '' }} de relevé
          <span v-if="s.last" class="text-muted">· dernier import {{ when(s.last) }}</span></span>
        <UButton v-if="s.transactions" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" label="Supprimer les relevés importés" @click="removeTx(s.source)" />
      </div>
    </UCard>
    <UCard v-if="!data.sources.length"><p class="text-sm text-muted">Aucun import pour le moment.</p></UCard>

    <h2 class="section-title">Comment brancher un workflow</h2>
    <UCard>
      <p v-if="!data.webhookConfigured" class="mb-2 text-sm text-error">⚠ Le jeton <code>WEBHOOK_TOKEN</code> n'est pas défini dans <code>.env</code> : les imports sont refusés.</p>
      <p class="text-sm text-muted">
        Un workflow n8n envoie ses documents à <code>POST /api/import/documents</code> et ses lignes de relevé à <code>POST /api/import/transactions</code>,
        avec l'en-tête <code>Authorization: Bearer &lt;WEBHOOK_TOKEN&gt;</code> (le jeton est dans <code>.env</code>, jamais affiché ici).
        Une <b>source</b> par plateforme (airbnb, booking…) ; un <b>externalId</b> évite les doublons si le workflow réessaie.
        Détails et exemples : <code>docs/imports-n8n.md</code>.
      </p>
    </UCard>

    <div class="flex items-center justify-between">
      <h2 class="section-title">Journal des imports</h2>
      <UButton v-if="data.log.length" size="xs" color="neutral" variant="ghost" label="Vider le journal" @click="clearLog" />
    </div>
    <UCard>
      <ul v-if="data.log.length" class="space-y-1 text-sm">
        <li v-for="l in data.log" :key="l.id" class="flex flex-wrap items-baseline gap-2">
          <UBadge size="sm" :color="l.status === 'ok' ? 'success' : l.status === 'error' ? 'error' : 'neutral'" variant="subtle" :label="l.status === 'ok' ? 'OK' : l.status === 'error' ? 'Erreur' : 'Déjà connu'" />
          <span class="text-muted">{{ when(l.at) }}</span><b>{{ l.source }}</b><span class="text-muted">{{ l.type }}</span><span class="min-w-0 break-words">{{ l.detail }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">Journal vide.</p>
    </UCard>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const { data, refresh } = await useFetch('/api/imports')
const error = ref('')
const forms = reactive<Record<number, { logementId?: number; category: string; date: string; amount: string }>>({})
const assign = reactive<Record<string, number | undefined>>({})
// Un petit formulaire par document a classer, prerempli avec ce que l'import a fourni
watchEffect(() => {
  for (const d of data.value?.inbox ?? []) forms[d.id] ??= { logementId: undefined, category: d.category, date: d.date, amount: d.amount === null ? '' : String(d.amount) }
})
const logementItems = computed(() => (data.value?.logements ?? []).map(l => ({ label: l.name, value: l.id })))
const categoryItems = computed(() => {
  const groups: Record<string, string> = { charge: 'Charges', recette: 'Recettes', doc: 'Justificatifs' }
  return Object.entries(groups).map(([kind, label]) => [
    { type: 'label' as const, label },
    ...(data.value?.categories ?? []).filter(c => c.kind === kind).map(c => ({ label: c.label, value: c.key })),
  ])
})
async function run(fn: () => Promise<unknown>) {
  error.value = ''
  try { await fn() } catch (e: any) { error.value = e?.data?.statusMessage || 'Échec, réessaie.' }
  await refresh()
}
const classify = (id: number) => run(() => $fetch(`/api/documents/${id}`, { method: 'PUT', body: { ...forms[id], amount: forms[id]!.amount } }))
const removeDoc = (d: { id: number; title: string }) => { if (confirm(`Supprimer définitivement « ${d.title} » ? Le fichier sera effacé.`)) return run(() => $fetch(`/api/documents/${d.id}`, { method: 'DELETE' })) }
const assignTx = (source: string) => run(() => $fetch('/api/imports/assign-transactions', { method: 'POST', body: { source, logementId: assign[source] } }))
const removeTx = (source: string) => { if (confirm(`Supprimer toutes les lignes de relevé importées de « ${source} » ? Tu pourras les ré-importer.`)) return run(() => $fetch('/api/imports/transactions', { method: 'DELETE', query: { source } })) }
const clearLog = () => run(() => $fetch('/api/imports/log', { method: 'DELETE' }))

const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`)
</script>
