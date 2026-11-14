// Connexion Loussa : redirige vers la page de connexion de Connexion Loussa (code d'autorisation + PKCE). Voir docs/rocket-auth.md.
export default defineEventHandler(async (event) => {
  if (!rocketAuthEnabled()) throw createError({ statusCode: 404, statusMessage: 'Connexion Loussa non configuré' })
  try { return sendRedirect(event, await rocketAuthorizeUrl(event, getQuery(event).next), 302) } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 502, statusMessage: 'Connexion Loussa injoignable' })
  }
})
