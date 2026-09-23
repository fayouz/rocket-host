<template>
  <UDashboardGroup unit="rem" class="print:static print:block print:inset-auto print:overflow-visible">
    <UDashboardSidebar id="default" v-model:open="mobileOpen" collapsible resizable class="bg-elevated/25 print:hidden" :ui="{ footer: 'lg:border-t lg:border-default' }">
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2 px-0.5" :class="{ 'justify-center': collapsed }">
          <UIcon name="i-lucide-house" class="size-6 shrink-0 text-primary" />
          <span v-if="!collapsed" class="truncate font-bold">LoussaHousing</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />
        <UNavigationMenu :collapsed="collapsed" :items="links" orientation="vertical" tooltip popover />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu v-if="user" :items="userMenu" :content="{ align: 'start' }" class="w-full">
          <UButton color="neutral" variant="ghost" block :square="collapsed" :label="collapsed ? undefined : user.displayName" icon="i-lucide-circle-user" />
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="searchGroups" />

    <UDashboardPanel id="main" :ui="{ root: 'print:h-auto print:overflow-visible', body: 'print:h-auto print:overflow-visible' }">
      <template #header>
        <UDashboardNavbar class="print:hidden" :ui="{ right: 'gap-2' }">
          <template #leading><UDashboardSidebarCollapse /></template>
          <template #right>
            <UBadge v-if="demo" color="warning" variant="subtle" label="Mode démo" />
            <ThemeColorPicker v-if="can('A')" />
            <UColorModeSelect />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <UContainer class="max-w-none py-6">
          <slot />
        </UContainer>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

<script setup lang="ts">
const demo = useState('demo', () => false)
const { data: lg } = await useFetch('/api/logements', { key: 'logements' })
const { user, refresh, logout, can } = useAuth()
await refresh()
useTheme()

const mobileOpen = ref(false)
const userMenu = computed(() => [[{ label: user.value?.username ?? '', type: 'label' as const }], [
  { label: 'Mon compte', icon: 'i-lucide-user-cog', to: '/mon-compte' },
  { label: 'Se déconnecter', icon: 'i-lucide-log-out', onSelect: logout },
]])

interface NavItem { label: string; icon?: string; to?: string; type?: 'trigger'; defaultOpen?: boolean; children?: NavItem[] }
const links = computed(() => [
  can('AG') && { label: 'Aujourd\'hui', icon: 'i-lucide-layout-dashboard', to: '/' },
  {
    label: 'Logements', icon: 'i-lucide-building-2', to: '/logements',
    children: (lg.value?.logements ?? []).map(l => ({ label: l.name, to: `/logements/${l.id}` })),
  },
  can('AGC') && { label: 'Documents', icon: 'i-lucide-folder', to: '/documents' },
  can('A') && { label: 'E-mails', icon: 'i-lucide-mail', to: '/mail' },
  can('A') && { label: 'Contacts', icon: 'i-lucide-contact', to: '/contacts' },
  can('A') && { label: 'Rentabilité', icon: 'i-lucide-line-chart', to: '/profit' },
  can('A') && {
    label: 'Réglages', icon: 'i-lucide-settings', to: '/settings', type: 'trigger' as const, defaultOpen: false,
    children: [
      { label: 'Logements et serrures', to: '/settings' },
      { label: 'Utilisateurs', to: '/settings/utilisateurs' },
      { label: 'Stock', to: '/settings/stock' },
      { label: 'Livret & écran TV', to: '/settings/welcomescreen' },
      { label: 'Imports', to: '/settings/imports' },
      { label: 'E-mail (IMAP)', to: '/settings/imap' },
      { label: 'API (Swagger)', to: '/docs-api' },
      { label: 'Nouveautés', icon: 'i-lucide-sparkles', to: '/changelog' },
      { label: 'Manuel', icon: 'i-lucide-book-marked', to: '/docs' },
    ],
  },
].filter(Boolean) as NavItem[])

// Recherche (⌘K) : jusqu'aux logements et aux sous-pages Réglages, pas de contenu (juste sauter d'une page à l'autre)
const searchGroups = computed(() => [{
  id: 'links',
  label: 'Aller à',
  items: links.value.flatMap(l => (l.children?.length ? l.children : [l])).filter(l => l.to).map(l => ({ label: l.label, icon: l.icon, to: l.to })),
}])
</script>
