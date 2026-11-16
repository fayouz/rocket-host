<template>
  <!-- Rappel en tete d'une page locale remplacee par une brique LoussaSuite quand Loussa Réservations est branche -->
  <UAlert
    v-if="pms?.configured"
    color="info" variant="subtle" icon="i-lucide-rocket" class="mb-4 print:hidden"
    :title="t('admin.brick.managedIn', { name: brick === 'place' ? t('admin.brick.place') : t('admin.brick.pms') })"
    :description="description || t('admin.brick.default')"
    :actions="url ? [{ label: t('admin.brick.open'), icon: 'i-lucide-external-link', to: url, target: '_blank', color: 'info', variant: 'outline' }] : []"
  />
</template>

<script setup lang="ts">
const { t } = useI18n()
const props = defineProps<{ brick: 'pms' | 'place'; description?: string }>()
const { data: pms } = await useFetch('/api/pms/status', { key: 'pms-status' })
const cfg = useRuntimeConfig().public
const url = computed(() => (props.brick === 'place' ? cfg.placeFrontUrl : cfg.pmsFrontUrl) || '')
</script>
