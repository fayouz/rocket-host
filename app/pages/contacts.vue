<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">{{ t('nav.contacts') }}</h1>
    <p class="mb-4 text-sm text-muted">{{ t('daily.contacts.pageIntro') }}</p>
    <ContactsPanel />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>
