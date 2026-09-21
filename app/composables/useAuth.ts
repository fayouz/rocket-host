// Utilisateur connecté (état partagé). Le serveur refuse déjà toute page sans session ; ceci sert à l'affichage.
export interface AuthUser { id: number; username: string; displayName: string; email: string; role: 'admin' | 'gestionnaire' | 'comptable' | 'menage'; mustChange: boolean }

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const requestFetch = useRequestFetch()
  async function refresh() {
    try { user.value = (await requestFetch<{ user: AuthUser | null }>('/api/auth/me')).user } catch { user.value = null }
  }
  async function logout() {
    try { await $fetch('/api/auth/logout', { method: 'POST' }) } catch { /* déjà déconnecté */ }
    user.value = null
    window.location.assign('/connexion')
  }
  // Menus : masque ce que le role ne peut pas ouvrir. AFFICHAGE SEULEMENT : le serveur refuse de toute facon (server/utils/policy.ts).
  const letter = computed(() => ({ admin: 'A', gestionnaire: 'G', comptable: 'C', menage: 'M' } as const)[user.value?.role ?? 'menage'])
  const can = (letters: string) => letters.includes(letter.value)
  // Premiere page utile d'un logement selon le role
  const firstLogementPage = (id: string | number) => `/logements/${id}/${({ admin: 'reservations', gestionnaire: 'reservations', comptable: 'documents', menage: 'stock' } as const)[user.value?.role ?? 'menage']}`
  return { user, refresh, logout, can, firstLogementPage }
}
