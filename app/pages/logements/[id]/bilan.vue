<template>
  <div v-if="data" class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="section-title !mt-0">Bilan {{ data.year }}</h2>
      <div class="flex items-center gap-2">
        <USelect v-model="year" :items="data.years.map(y => ({ label: String(y), value: y }))" class="w-28" />
        <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-download" label="Export CSV comptable" :to="`/api/logements/${route.params.id}/documents.csv?year=${data.year}`" external target="_blank" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <UCard><p class="text-sm text-muted">Revenus Lodgify</p><p class="text-xl font-semibold">{{ eur(data.revenue) }}</p><p class="text-xs text-muted">bruts, répartis par nuit</p></UCard>
      <UCard><p class="text-sm text-muted">Charges</p><p class="text-xl font-semibold text-warning">− {{ eur(data.chargesTotal) }}</p><p class="text-xs text-muted">{{ data.documents }} fichier{{ data.documents > 1 ? 's' : '' }} comptable{{ data.documents > 1 ? 's' : '' }} de l'année</p></UCard>
      <UCard><p class="text-sm text-muted">Autres recettes</p><p class="text-xl font-semibold">{{ eur(data.otherIncome) }}</p><p class="text-xs text-muted">hors Lodgify</p></UCard>
      <UCard :class="data.result < 0 ? 'border-l-4 border-l-error' : 'border-l-4 border-l-success'">
        <p class="text-sm text-muted">Résultat estimé</p><p class="text-xl font-semibold">{{ eur(data.result) }}</p>
      </UCard>
    </div>

    <UCard>
      <p class="text-sm">
        <b>{{ data.nights }}</b> nuits vendues sur <b>{{ data.stays }}</b> séjours · occupation <b>{{ data.occupancy }} %</b>
        <span class="text-muted">(sur {{ data.daysConsidered }} jours{{ data.since ? `, depuis le ${fr(data.since)}` : '' }})</span>
      </p>
    </UCard>

    <p v-if="data.chargesWithoutAmount" class="text-sm text-warning">
      ⚠ {{ data.chargesWithoutAmount }} charge{{ data.chargesWithoutAmount > 1 ? 's' : '' }} sans montant : non comptée{{ data.chargesWithoutAmount > 1 ? 's' : '' }} dans le résultat (à renseigner dans Documents, clic droit → « Type et montant… »).
    </p>
    <p v-if="data.withoutDate" class="text-sm text-warning">
      ⚠ {{ data.withoutDate }} fichier{{ data.withoutDate > 1 ? 's' : '' }} comptable{{ data.withoutDate > 1 ? 's' : '' }} sans date : non compté{{ data.withoutDate > 1 ? 's' : '' }} dans une année (à dater dans Documents).
    </p>

    <template v-if="data.platform.has || data.platform.unassigned">
      <h3 class="section-title">Relevés de plateformes importés</h3>
      <UCard>
        <ul class="space-y-1 text-sm">
          <li class="flex justify-between"><span>Reversements reçus</span><b>{{ eur(data.platform.payouts) }}</b></li>
          <li class="flex justify-between"><span>Frais retenus (comptés dans les charges)</span><b>{{ eur(data.platform.fees) }}</b></li>
          <li class="flex justify-between"><span class="text-muted">Taxe de séjour collectée (indicatif, non comptée)</span><span>{{ eur(data.platform.touristTax) }}</span></li>
          <li v-if="data.platform.refunds" class="flex justify-between"><span class="text-muted">Remboursements (indicatif, non comptés)</span><span>{{ eur(data.platform.refunds) }}</span></li>
        </ul>
        <p v-if="data.platform.unassigned" class="mt-2 text-sm text-warning">
          ⚠ {{ data.platform.unassigned }} ligne{{ data.platform.unassigned > 1 ? 's' : '' }} de relevé non affectée{{ data.platform.unassigned > 1 ? 's' : '' }} à un logement : non comptée{{ data.platform.unassigned > 1 ? 's' : '' }} ici (Réglages, Imports).
        </p>
      </UCard>
    </template>

    <h3 class="section-title">Charges par catégorie</h3>
    <UCard v-if="data.charges.length">
      <ul class="space-y-3">
        <li v-for="c in data.charges" :key="c.key">
          <div class="flex justify-between gap-2 text-sm"><span>{{ c.label }} <span class="text-muted">· {{ c.count }} document{{ c.count > 1 ? 's' : '' }}</span></span><b>{{ eur(c.total) }}</b></div>
          <UProgress :model-value="data.chargesTotal ? (100 * c.total) / data.chargesTotal : 0" size="xs" color="warning" />
        </li>
      </ul>
    </UCard>
    <UCard v-else><p class="text-sm text-muted">Aucune charge enregistrée pour {{ data.year }} : dépose tes factures dans l'onglet Documents et donne-leur un type comptable (clic droit → « Type et montant… »).</p></UCard>

    <h3 class="section-title">Revenus par mois</h3>
    <UCard>
      <ul class="space-y-2">
        <li v-for="(m, i) in data.months" :key="i" class="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-2 text-sm">
          <span class="text-muted">{{ monthName(i) }}</span>
          <UProgress :model-value="maxMonth ? (100 * m.revenue) / maxMonth : 0" size="xs" />
          <span class="text-right">{{ m.nights ? eur(m.revenue) : '—' }}</span>
        </li>
      </ul>
    </UCard>

    <p class="text-xs text-muted">
      Le résultat est une estimation : les revenus sont les montants de réservation Lodgify (avant frais de plateforme, taxes et remboursements),
      répartis sur les nuits de l'année. Les frais de plateforme, taxes de séjour et autres dépenses n'y figurent que si tu les ajoutes dans Documents.
      À confirmer avec ton comptable.
    </p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const year = ref<number>(new Date().getFullYear())
const { data } = await useFetch(() => `/api/logements/${route.params.id}/bilan`, { query: { year } })
const maxMonth = computed(() => Math.max(0, ...(data.value?.months ?? []).map(m => m.revenue)))
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const monthName = (i: number) => new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' })
</script>
