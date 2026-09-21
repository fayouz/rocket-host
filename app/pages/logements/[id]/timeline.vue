<template>
  <div v-if="data">
    <h2 class="section-title !mt-0">Timeline</h2>
    <p class="mb-2 text-sm text-muted">Les 3 derniers jours et les 45 prochains : séjours, codes clavier, ménages, messages envoyés et prévus, réassort. Heure de Paris.</p>
    <EventTimeline :events="data.events" :now="data.now" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data } = await useFetch(() => `/api/logements/${route.params.id}/timeline`)
const demo = useState('demo')
watchEffect(() => { demo.value = !!data.value?.demo })
</script>
