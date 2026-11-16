<template>
  <div class="space-y-3">
    <h2 class="section-title !mt-0">{{ t('nav.contacts') }}</h2>
    <p class="text-sm text-muted">{{ t('daily.lg.contactsIntro') }}</p>
    <ContactsPanel :logement-id="Number(route.params.id)" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
</script>
