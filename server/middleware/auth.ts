// Refus par defaut : toute page et toute route API exige une session, sauf la liste blanche ci-dessous.
// (Les jetons secrets du menage et de n8n gardent leur propre controle ; Traefik n'expose deja que ces chemins sans mot de passe.)
const PUBLIC_PREFIXES = ['/_nuxt/', '/api/_nuxt_icon/', '/r/', '/api/r/', '/g/', '/api/g/', '/tv/', '/api/tv/', '/_docs-ui/'] // /_docs-ui : fichiers open source de Swagger UI (la specification, elle, exige l'administrateur)
const PUBLIC_EXACT = new Set(['/connexion', '/activation', '/mot-de-passe-oublie', '/api/auth/login', '/api/auth/activate', '/api/auth/forgot', '/favicon.ico', '/robots.txt', '/api/cleaning-tasks', '/api/import/documents', '/api/import/transactions', '/api/bg-default'])
const ACCOUNT = (p: string) => p === '/mon-compte' || p.startsWith('/api/auth/')

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (PUBLIC_EXACT.has(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))) return
  if (process.env.NODE_ENV !== 'production' && (path.startsWith('/__') || path.startsWith('/@') || path.startsWith('/_nuxt'))) return // outils de developpement seulement
  const api = path.startsWith('/api/')
  const user = await currentUser(event)
  if (!user) {
    if (api) throw createError({ statusCode: 401, statusMessage: 'Connexion requise' })
    return sendRedirect(event, `/connexion?next=${encodeURIComponent(path)}`, 302)
  }
  if (user.mustChange && !ACCOUNT(path)) {
    if (api) throw createError({ statusCode: 403, statusMessage: 'Changement de mot de passe requis', data: { code: 'must_change' } })
    return sendRedirect(event, '/mon-compte?force=1', 302)
  }
  // Roles et perimetre (voir server/utils/policy.ts) : refus par defaut
  if (api) {
    const hit = matchRule(event.method, path)
    if (!hit) throw createError({ statusCode: 403, statusMessage: 'Route non classée dans la table des permissions (refusée par défaut)' })
    if (!roleAllowed(hit.rule.roles, user.role)) throw createError({ statusCode: 403, statusMessage: 'Accès non autorisé pour ce rôle' })
    if (user.role !== 'admin' && hit.rule.scope && hit.rule.scope !== 'handler') {
      const id = hit.params[hit.rule.params[0] ?? '']
      const kind = hit.rule.scope
      const lg = id === undefined ? undefined : await logementOf(kind, kind === 'logement' ? hit.params.id! : id)
      const scope = await allowedLogementIds(user)
      if (lg === undefined || (scope && !scope.has(lg))) throw createError({ statusCode: 403, statusMessage: 'Accès refusé à cette ressource' })
    }
    return
  }
  const page = matchPage(path)
  const home = homeFor(user.role)
  const deny = () => path === home ? (() => { throw createError({ statusCode: 403, statusMessage: 'Accès non autorisé pour ce rôle' }) })() : sendRedirect(event, home, 302)
  if (!page || !roleAllowed(page.roles, user.role)) return deny()
  if (user.role !== 'admin' && page.params.id) {
    const scope = await allowedLogementIds(user)
    if (scope && !scope.has(Number(page.params.id))) return deny()
  }
})
