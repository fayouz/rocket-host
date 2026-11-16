<template>
  <div v-if="data" class="space-y-3">
    <h2 class="section-title !mt-0 print:hidden">{{ t('daily.lg.qrCleaning') }}</h2>
    <p class="text-sm text-muted print:hidden">{{ t('daily.qr.intro') }}</p>
    <UCard class="mx-auto max-w-xs text-center">
      <p class="mb-2 text-lg font-semibold">{{ data.logement.name }}</p>
      <img :src="`/api/stock/qr/${data.propertyId}?v=${data.token.slice(0, 6)}`" :alt="t('daily.qr.alt', { name: data.logement.name })" class="mx-auto h-56 w-56 rounded bg-white p-1">
      <p class="mt-2 text-sm">{{ t('daily.qr.scan') }}</p>
      <p class="mt-1 break-all text-xs text-muted print:hidden">/r/{{ data.token }}</p>
    </UCard>
    <div class="flex flex-wrap justify-center gap-2 print:hidden">
      <UButton icon="i-lucide-printer" :label="t('daily.qr.print')" @click="print()" />
      <UButton color="neutral" variant="outline" :label="t('daily.qr.openPage')" :to="`/r/${data.token}`" target="_blank" />
      <UButton color="neutral" variant="outline" :label="t('daily.qr.newLink')" @click="regenerate()" />
    </div>
    <p v-if="error" class="text-center text-sm text-error print:hidden">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { data, refresh } = await useFetch(() => `/api/logements/${route.params.id}/stock`)
const error = ref('')
const print = () => window.print()
async function regenerate() {
  if (!data.value || !confirm(t('daily.qr.confirm', { name: data.value.logement.name }))) return
  error.value = ''
  try { await $fetch('/api/stock/token', { method: 'POST', body: { propertyId: data.value.propertyId } }); await refresh() }
  catch { error.value = t('daily.contacts.failed') }
}
</script>
