// Logement choisi dans le sélecteur de la sidebar (« Au quotidien ») : 'all' = tous les logements, sinon l'id.
// Mémorisé dans un cookie (lu aussi au rendu serveur) ; les pages quotidiennes le reflètent dans l'URL
// (chemin /logements/:id/... ou ?logement=). La liste /api/logements est déjà filtrée selon les logements autorisés.
export type DailyScreen = 'reservations' | 'menage' | 'serrures' | 'stock' | 'ecrans'

// Onglet par logement et vue globale (null = pas de vue globale : premier logement + indication)
const SCREENS: Record<DailyScreen, { tab: string; global: string | null; adminOnly?: boolean }> = {
  reservations: { tab: 'reservations', global: '/reservations' },
  menage: { tab: 'timeline', global: '/menage' },
  serrures: { tab: 'serrures', global: null },
  stock: { tab: 'stock', global: '/settings/stock', adminOnly: true }, // pages Reglages : administrateurs seulement
  ecrans: { tab: 'livret', global: '/settings/welcomescreen', adminOnly: true },
}

export function useLogementChoice() {
  const { data: lg } = useNuxtData<{ logements: { id: number; name: string; color?: string | null; lodgifyPropertyId?: number }[] }>('logements')
  const { can } = useAuth()
  const cookie = useCookie<string>('rh-logement', { default: () => 'all', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  const logements = computed(() => lg.value?.logements ?? [])
  // Valeur effective : un id inconnu (ou hors du périmètre de l'utilisateur) retombe sur « tous »
  const choice = computed<string>({
    get: () => (cookie.value !== 'all' && logements.value.some(l => String(l.id) === String(cookie.value)) ? String(cookie.value) : 'all'),
    set: (v) => { cookie.value = v || 'all' },
  })
  function linkFor(screen: DailyScreen, value = choice.value) {
    const s = SCREENS[screen]
    if (value !== 'all') return `/logements/${value}/${s.tab}`
    if (s.global && (!s.adminOnly || can('A'))) return s.global
    const first = logements.value[0]?.id
    return first ? `/logements/${first}/${s.tab}?logement=tous` : '/logements'
  }
  // Écran quotidien affiché par la route courante (pour garder le même écran quand on change de logement)
  function screenOf(path: string): DailyScreen | null {
    for (const [k, s] of Object.entries(SCREENS) as [DailyScreen, typeof SCREENS[DailyScreen]][]) {
      if (s.global && path === s.global) return k
      if (new RegExp(`^/logements/\\d+/${s.tab}/?$`).test(path)) return k
    }
    return null
  }
  return { choice, logements, linkFor, screenOf }
}
