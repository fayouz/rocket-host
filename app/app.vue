<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { fr, en } from '@nuxt/ui/locale'
// Langue de l'interface (FR/EN) : composants Nuxt UI + attribut lang de la page suivent la langue choisie
const { locale } = useI18n()
const uiLocale = computed(() => (locale.value === 'en' ? en : fr))
useHead({ htmlAttrs: { lang: locale } })
</script>
