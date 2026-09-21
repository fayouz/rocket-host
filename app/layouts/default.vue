<template>
  <div>
    <UHeader title="LoussaHousing" to="/" class="print:hidden">
      <UNavigationMenu :items="links" />
      <template #right>
        <UBadge v-if="demo" color="warning" variant="subtle" label="Mode démo" />
        <UColorModeButton />
      </template>
      <template #body>
        <UNavigationMenu :items="links" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>
    <UMain>
      <UContainer class="py-6">
        <slot />
      </UContainer>
    </UMain>
  </div>
</template>

<script setup lang="ts">
const demo = useState('demo', () => false)
const { data: lg } = await useFetch('/api/logements', { key: 'logements' })
const links = computed(() => [
  { label: 'Aujourd\'hui', to: '/' },
  { label: 'Logements', to: '/logements', children: (lg.value?.logements ?? []).map(l => ({ label: l.name, to: `/logements/${l.id}` })) },
  { label: 'E-mails', to: '/mail' },
  { label: 'Contacts', to: '/contacts' },
  { label: 'Rentabilité', to: '/profit' },
  { label: 'Réglages', to: '/settings' },
])
</script>
