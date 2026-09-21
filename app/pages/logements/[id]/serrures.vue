<template>
  <div v-if="data" class="space-y-2">
    <h2 class="section-title !mt-0">Serrures Nuki</h2>
    <UCard v-for="l in data.locks" :key="l.id" :class="{ 'border-l-4 border-l-error': l.batteryCritical || l.keypadBatteryCritical }">
      <div class="flex justify-between gap-3">
        <b>{{ l.name }}</b>
        <UBadge :color="l.locked ? 'success' : 'warning'" variant="subtle" :label="l.state" />
      </div>
      <p class="text-sm text-muted">
        Batterie {{ l.battery === null ? 'inconnue' : l.battery + ' %' }}
        <template v-if="l.batteryCritical"> · ⚠ critique</template>
        <template v-if="l.keypadBatteryCritical"> · ⚠ pile du clavier faible</template>
      </p>
      <p v-for="(g, i) in l.logs" :key="i" class="text-sm text-muted">{{ when(g.date) }} · {{ actions[g.action] || 'Action ' + g.action }}<template v-if="g.who"> · {{ g.who }}</template></p>
    </UCard>
    <UCard v-if="!data.locks.length"><p class="text-sm text-muted">Aucune serrure liée à ce logement (voir Réglages).</p></UCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(() => `/api/logements/${route.params.id}/locks`)
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
const actions: Record<number, string> = { 1: 'Déverrouillage', 2: 'Verrouillage', 3: 'Ouverture (pêne)', 4: 'Lock’n’Go', 5: 'Lock’n’Go + ouverture' }
const when = (d: string) => new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>
