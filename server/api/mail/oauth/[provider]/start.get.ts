// « Se connecter avec Google / Microsoft » : redirige vers la page de consentement du fournisseur (etat anti-CSRF a usage unique).
// ?email= : adresse suggeree (login_hint). Adresse de retour : https://<hote>/api/mail/oauth/<provider>/callback
export default defineEventHandler(async (event) => {
  const p = getRouterParam(event, 'provider')
  if (!isOAuthProvider(p)) throw createError({ statusCode: 404, statusMessage: 'Fournisseur inconnu' })
  if (!oauthConfigured(p)) throw createError({ statusCode: 503, statusMessage: `Connexion ${OAUTH[p].label} à configurer (Réglages › Connexions › Connexions directes)` })
  const user = await currentUser(event)
  const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
  const hint = String(getQuery(event).email ?? '').slice(0, 200)
  return sendRedirect(event, oauthStartUrl(p, user!.id, `${origin}/api/mail/oauth/${p}/callback`, /^[^\s@]+@[^\s@]+$/.test(hint) ? hint : ''))
})
