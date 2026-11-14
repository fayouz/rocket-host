<template>
  <USelect :model-value="locale" :items="items" size="sm" :aria-label="t('lang.label')" icon="i-lucide-languages" @update:model-value="v => setLocale(v as 'fr' | 'en')" />
</template>

<script setup lang="ts">
// Choix de la langue (FR/EN) : memorise dans un cookie ; sinon la langue du navigateur est utilisee
const { t, locale, setLocale } = useI18n()
const items = computed(() => [{ label: t('lang.fr'), value: 'fr' }, { label: t('lang.en'), value: 'en' }])
</script>
