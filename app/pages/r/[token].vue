<template>
  <div v-if="data" class="space-y-3">
    <h1 class="text-xl font-semibold">{{ data.property }}</h1>
    <p class="text-sm text-muted">{{ t('admin.restock.intro') }}</p>
    <UCard v-for="it in data.items" :key="it.id">
      <p class="mb-2 font-medium">{{ it.name }}</p>
      <div class="grid grid-cols-3 gap-2">
        <UButton v-for="l in levels" :key="l.value" :label="l.label" :color="l.color" :variant="it.level === l.value ? 'solid' : 'outline'"
                 size="xl" block :disabled="busy === it.id" @click="set(it, l.value)" />
      </div>
    </UCard>
    <p v-if="!data.items.length" class="text-sm text-muted">{{ t('admin.restock.none') }}</p>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
  </div>
  <div v-else class="pt-12 text-center text-muted">{{ t('admin.restock.invalid') }}</div>
</template>

<script setup lang="ts">
const { t } = useI18n()
definePageMeta({ layout: 'bare' })
const route = useRoute()
const { data } = await useFetch(`/api/r/${route.params.token}`)
// Lien inconnu : vrai code 404 (et non 200 avec un message)
if (import.meta.server && !data.value) setResponseStatus(useRequestEvent()!, 404)
const levels = computed(() => [
  { value: 'ok', label: 'OK', color: 'success' },
  { value: 'low', label: t('admin.restock.low'), color: 'warning' },
  { value: 'empty', label: t('admin.restock.empty'), color: 'error' },
] as const)
const busy = ref<number | null>(null)
const error = ref('')
async function set(it: { id: number; level: string }, level: string) {
  const previous = it.level
  it.level = level // affichage immediat, annule si l'envoi echoue
  busy.value = it.id
  error.value = ''
  try { await $fetch(`/api/r/${route.params.token}`, { method: 'PUT', body: { itemId: it.id, level } }) }
  catch { it.level = previous; error.value = t('admin.restock.failed') }
  busy.value = null
}
</script>
