// Rocket Auth : redirige vers la page de connexion de Rocket Auth (code d'autorisation + PKCE). Voir docs/rocket-auth.md.
export default defineEventHandler(async (event) => {
  if (!rocketAuthEnabled()) throw createError({ statusCode: 404, statusMessage: 'Rocket Auth non configuré' })
  try { return sendRedirect(event, await rocketAuthorizeUrl(event, getQuery(event).next), 302) } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 502, statusMessage: 'Rocket Auth injoignable' })
  }
})
