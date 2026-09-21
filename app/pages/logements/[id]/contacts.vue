<template>
  <div class="space-y-3">
    <h2 class="section-title !mt-0">Contacts</h2>
    <p class="text-sm text-muted">Les contacts de ce logement, plus ceux qui valent pour tous les logements (comptable, assurance…).</p>
    <ContactsPanel :logement-id="Number(route.params.id)" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
