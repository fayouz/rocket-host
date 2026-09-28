<template>
  <UDashboardGroup unit="rem" class="print:static print:block print:inset-auto print:overflow-visible">
    <UDashboardSidebar id="default" v-model:open="mobileOpen" collapsible resizable class="bg-elevated/25 print:hidden" :ui="{ footer: 'lg:border-t lg:border-default' }">
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2 px-0.5" :class="{ 'justify-center': collapsed }">
          <UIcon name="i-lucide-house" class="size-6 shrink-0 text-primary" />
          <span v-if="!collapsed" class="truncate font-bold">Rocket Host</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <div v-for="group in groups" :key="group.label" class="mb-1">
          <p v-if="!collapsed && group.label" class="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-dimmed">{{ group.label }}</p>
          <div v-if="!collapsed && group.brick" class="flex items-center justify-between gap-2 px-2.5 pb-1 pt-2">
            <span class="flex items-center gap-1.5 text-xs font-medium text-muted"><UIcon :name="group.brick.icon" class="size-3.5" />{{ group.brick.name }}</span>
            <UBadge v-if="group.brick.status" size="sm" variant="subtle" :color="group.brick.status.color" :label="group.brick.status.label" />
          </div>
          <UNavigationMenu :collapsed="collapsed" :items="group.items" orientation="vertical" tooltip popover />
        </div>
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu v-if="user && collapsed" :items="userMenu" :content="{ align: 'start' }" class="w-full">
          <UButton color="neutral" variant="ghost" block square icon="i-lucide-circle-user" />
        </UDropdownMenu>
        <div v-else-if="user" class="w-full space-y-2 px-1 pb-1">
          <NuxtLink to="/mon-compte" class="flex min-w-0 items-center gap-2 rounded-md p-1 hover:bg-elevated">
            <UAvatar :text="userInitials" size="sm" class="shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ user.displayName || user.username }}</p>
              <p v-if="user.email" class="truncate text-xs text-muted">{{ user.email }}</p>
            </div>
          </NuxtLink>
          <div class="flex items-center justify-between px-1 text-xs">
            <span class="flex items-center gap-1.5 text-success"><span class="size-1.5 rounded-full bg-success" /> Connecté</span>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-log-out" label="Déconnexion" @click="logout" />
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="searchGroups" />

    <UDashboardPanel id="main" :ui="{ root: 'print:h-auto print:overflow-visible', body: 'print:h-auto print:overflow-visible' }">
      <template #header>
        <UDashboardNavbar class="print:hidden" :ui="{ right: 'gap-2' }">
          <template #leading><UDashboardSidebarCollapse /></template>
          <template #left>
            <UDashboardSearchButton class="w-full max-w-sm bg-transparent ring-default" />
          </template>
          <template #right>
            <SuiteAppSwitcher />
            <UBadge v-if="demo" color="warning" variant="subtle" label="Mode démo" />
            <!-- Cloche preparee pour un futur systeme de notifications (rien a afficher pour l'instant : desactivee) -->
            <UTooltip text="Notifications (bientôt disponible)">
              <UButton color="neutral" variant="ghost" square icon="i-lucide-bell" disabled />
            </UTooltip>
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
const userInitials = computed(() => (user.value?.displayName || user.value?.username || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?')
const userMenu = computed(() => [[{ label: user.value?.username ?? '', type: 'label' as const }], [
  { label: 'Mon compte', icon: 'i-lucide-user-cog', to: '/mon-compte' },
  { label: 'Se déconnecter', icon: 'i-lucide-log-out', onSelect: logout },
]])

interface NavItem { label: string; icon?: string; to?: string; target?: string; badge?: string; type?: 'trigger'; defaultOpen?: boolean; children?: NavItem[] }
type BadgeColor = 'success' | 'warning' | 'error' | 'neutral' | 'info'
interface NavGroup { label: string; brick?: { name: string; icon: string; status?: { label: string; color: BadgeColor } }; items: NavItem[] }

// Etat des briques : Rocket PMS (et Place/Mailer/Cloud, joints a travers lui) d'apres /api/pms/status
const { data: pms } = await useFetch('/api/pms/status', { key: 'pms-status' })
const front = useRuntimeConfig().public
const pmsOn = computed(() => !!pms.value?.configured)
const pmsStatus = computed((): { label: string; color: BadgeColor } => demo.value && !pmsOn.value ? { label: 'démo', color: 'warning' }
  : !pmsOn.value ? { label: 'off', color: 'neutral' } : pms.value?.ok ? { label: 'connecté', color: 'success' } : { label: 'erreur', color: 'error' })
const viaPms = computed((): { label: string; color: BadgeColor } => pmsOn.value ? { ...pmsStatus.value, label: pms.value?.ok ? 'via PMS' : 'erreur' } : pmsStatus.value)
// Pages propres a un logement : on ouvre le premier logement (sinon la liste)
const firstLg = computed(() => lg.value?.logements?.[0]?.id)
const lgPage = (tab: string) => (firstLg.value ? `/logements/${firstLg.value}/${tab}` : '/logements')
const ext = (url: string, label: string): NavItem[] => (url ? [{ label, icon: 'i-lucide-external-link', to: url, target: '_blank' }] : [])
const managed = (label: string) => (pmsOn.value ? label : undefined)
const adminGroups = computed((): NavGroup[] => [
  {
    label: 'Administration',
    brick: { name: 'Rocket PMS', icon: 'i-lucide-rocket', status: pmsStatus.value },
    items: [
      { label: 'Connexions (URL, jetons, secrets)', icon: 'i-lucide-plug', to: '/settings/connexions' },
      { label: 'Réservations / Lodgify', icon: 'i-lucide-calendar-days', to: lgPage('reservations') },
      { label: 'Livret & écran TV', icon: 'i-lucide-tv', to: '/settings/welcomescreen', badge: managed('PMS') },
      { label: 'Bilan', icon: 'i-lucide-calculator', to: lgPage('bilan') },
      { label: 'E-mails voyageurs', icon: 'i-lucide-send', to: lgPage('mails') },
      ...ext(front.pmsFrontUrl, 'Ouvrir Rocket PMS'),
    ],
  },
  {
    label: '',
    brick: { name: 'Rocket Place', icon: 'i-lucide-map-pin', status: viaPms.value },
    items: [
      { label: 'Lieux', icon: 'i-lucide-building-2', to: '/settings', badge: managed('Place') },
      { label: 'Serrures & accès', icon: 'i-lucide-key-round', to: lgPage('serrures') },
      { label: 'Domotique / connecteurs', icon: 'i-lucide-cpu', to: lgPage('domotique') },
      { label: 'Ménage', icon: 'i-lucide-sparkles', to: lgPage('timeline') },
      { label: 'Stock', icon: 'i-lucide-package', to: '/settings/stock', badge: managed('Place') },
      ...ext(front.placeFrontUrl, 'Ouvrir Rocket Place'),
    ],
  },
  {
    label: '',
    brick: { name: 'Rocket Mailer', icon: 'i-lucide-mail', status: pmsOn.value ? viaPms.value : { label: 'local', color: 'info' } },
    items: [{ label: 'Boîte e-mail (IMAP/SMTP)', icon: 'i-lucide-inbox', to: '/settings/imap' }],
  },
  {
    label: '',
    brick: { name: 'Rocket Cloud', icon: 'i-lucide-cloud', status: pmsOn.value ? viaPms.value : { label: 'local', color: 'info' } },
    items: [{ label: 'Documents / explorateur', icon: 'i-lucide-folder-tree', to: '/documents' }],
  },
  {
    label: '',
    brick: { name: 'Rocket Host (local)', icon: 'i-lucide-house' },
    items: [
      { label: 'Utilisateurs & rôles', icon: 'i-lucide-users', to: '/settings/utilisateurs' },
      { label: 'Journal d\'audit', icon: 'i-lucide-scroll-text', to: '/settings/utilisateurs?tab=journal' },
      { label: 'Plugins / connecteurs', icon: 'i-lucide-blocks', to: '/settings/plugins' },
      { label: 'Imports', icon: 'i-lucide-file-down', to: '/settings/imports' },
      {
        label: 'Autres réglages', icon: 'i-lucide-settings', type: 'trigger', defaultOpen: false,
        children: [
          { label: 'Mon compte (thème : palette en haut à droite)', to: '/mon-compte' },
          { label: 'API (Swagger)', to: '/docs-api' },
          { label: 'Nouveautés', to: '/changelog' },
          { label: 'Manuel', to: '/docs' },
        ],
      },
    ],
  },
])
// Groupes de la sidebar : un intitule en majuscules par groupe (vide pour le premier, comme Aujourd'hui seul en tete)
const groups = computed(() => ([
  { label: '', items: [can('AG') && { label: 'Aujourd\'hui', icon: 'i-lucide-layout-dashboard', to: '/' }].filter(Boolean) },
  {
    label: 'Logements',
    items: [
      { label: 'Tous les logements', icon: 'i-lucide-building-2', to: '/logements' },
      ...(lg.value?.logements ?? []).map(l => ({ label: l.name, icon: 'i-lucide-home', to: `/logements/${l.id}` })),
    ],
  },
  {
    label: 'Gestion',
    items: [
      can('AGC') && { label: 'Documents', icon: 'i-lucide-folder', to: '/documents' },
      can('A') && { label: 'E-mails', icon: 'i-lucide-mail', to: '/mail' },
      can('A') && { label: 'Contacts', icon: 'i-lucide-contact', to: '/contacts' },
      can('A') && { label: 'Rentabilité', icon: 'i-lucide-line-chart', to: '/profit' },
    ].filter(Boolean),
  },
  // Administration regroupee par brique logicielle (Rocket PMS, Place, Mailer, Cloud, puis le local). Pages inchangees ;
  // quand Rocket PMS est branche, les pages locales remplacees affichent « géré dans Rocket PMS/Place » (BrickHint).
  ...(can('A') ? adminGroups.value : []),
] as NavGroup[]).filter(g => g.items.length))

// Recherche (⌘K) : jusqu'aux logements et aux sous-pages Réglages, pas de contenu (juste sauter d'une page à l'autre)
const searchGroups = computed(() => [{
  id: 'links',
  label: 'Aller à',
  items: groups.value.flatMap(g => g.items).flatMap(l => (l.children?.length ? l.children : [l])).filter(l => l.to).map(l => ({ label: l.label, icon: l.icon, to: l.to })),
}])
</script>
