<template>
  <div>
    <h1 class="mb-4 text-xl font-semibold print:hidden">Réglages</h1>
    <div class="grid gap-6 md:grid-cols-[13rem_1fr]">
      <UNavigationMenu orientation="vertical" :items="menu" class="self-start print:hidden" />
      <div class="min-w-0">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const menu = [
  { label: 'Logements et serrures', icon: 'i-lucide-house', to: '/settings', exact: true },
  { label: 'Utilisateurs', icon: 'i-lucide-users', to: '/settings/utilisateurs' },
  { label: 'Stock', icon: 'i-lucide-package', to: '/settings/stock' },
  { label: 'Livret & écran TV', icon: 'i-lucide-image', to: '/settings/welcomescreen' },
  { label: 'Imports', icon: 'i-lucide-inbox', to: '/settings/imports' },
  { label: 'E-mail (IMAP)', icon: 'i-lucide-mail', to: '/settings/imap' },
  { label: 'API (Swagger)', icon: 'i-lucide-book-open', to: '/docs-api' },
  { label: 'Nouveautés', icon: 'i-lucide-sparkles', to: '/changelog' },
  { label: 'Manuel', icon: 'i-lucide-book-marked', to: '/docs' },
]
</script>
