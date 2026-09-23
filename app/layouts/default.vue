<template>
  <div>
    <UHeader title="LoussaHousing" to="/" class="print:hidden" :ui="{ container: 'max-w-none' }">
      <UNavigationMenu :items="links" />
      <template #right>
        <UBadge v-if="demo" color="warning" variant="subtle" label="Mode démo" />
        <UDropdownMenu v-if="user" :items="userMenu" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" icon="i-lucide-circle-user" :label="user.displayName" class="hidden sm:inline-flex" />
        </UDropdownMenu>
        <ThemeColorPicker v-if="can('A')" />
        <UColorModeSelect />
      </template>
      <template #body>
        <UNavigationMenu :items="links" orientation="vertical" class="-mx-2.5" />
      </template>
    </UHeader>
    <UMain>
      <UContainer class="max-w-none py-6">
        <slot />
      </UContainer>
    </UMain>
  </div>
</template>

<script setup lang="ts">
const demo = useState('demo', () => false)
const { data: lg } = await useFetch('/api/logements', { key: 'logements' })
const { user, refresh, logout, can } = useAuth()
await refresh()
useTheme()
const userMenu = computed(() => [[{ label: user.value?.username ?? '', type: 'label' as const }], [
  { label: 'Mon compte', icon: 'i-lucide-user-cog', to: '/mon-compte' },
  { label: 'Se déconnecter', icon: 'i-lucide-log-out', onSelect: logout },
]])
const links = computed(() => [
  can('AG') && { label: 'Aujourd\'hui', to: '/' },
  { label: 'Logements', to: '/logements', children: (lg.value?.logements ?? []).map(l => ({ label: l.name, to: `/logements/${l.id}` })) },
  can('AGC') && { label: 'Documents', to: '/documents' },
  can('A') && { label: 'E-mails', to: '/mail' },
  can('A') && { label: 'Contacts', to: '/contacts' },
  can('A') && { label: 'Rentabilité', to: '/profit' },
  can('A') && { label: 'Réglages', to: '/settings' },
].filter(Boolean) as { label: string; to: string; children?: { label: string; to: string }[] }[])
</script>
