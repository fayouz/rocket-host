// Rocket Auth : retour apres connexion (verifie state/nonce/jeton, associe le compte, ouvre la session locale)
export default defineEventHandler(async (event) => {
  if (!rocketAuthEnabled()) throw createError({ statusCode: 404, statusMessage: 'Rocket Auth non configuré' })
  try { return sendRedirect(event, await handleCallback(event), 302) } catch (e: any) {
    const msg = String(e?.statusMessage || 'Échec de la connexion Rocket Auth')
    return sendRedirect(event, `/connexion?sso_error=${encodeURIComponent(msg.slice(0, 200))}`, 302)
  }
})
