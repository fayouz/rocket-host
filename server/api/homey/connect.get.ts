// Demarre l'autorisation OAuth du compte Homey (mode Cloud) : redirige vers la page de consentement de Homey.
// ?return=/logements/<id>/domotique : page de retour (liste blanche). Un etat aleatoire, garde dans un cookie, protege le retour.
export default defineEventHandler(async (event) => {
  if (!cloudConfigured()) throw createError({ statusCode: 400, statusMessage: 'Application Homey non configurée (identifiant et secret à saisir dans Réglages › Connexions)' })
  const ret = String(getQuery(event).return ?? '')
  const state = newState()
  const secure = getRequestURL(event, { xForwardedProto: true }).protocol === 'https:'
  setCookie(event, 'homey_oauth', Buffer.from(JSON.stringify({ state, ret: /^\/logements\/\d+\/domotique$/.test(ret) ? ret : '/' })).toString('base64url'),
    { httpOnly: true, sameSite: 'lax', secure, maxAge: 600, path: '/api/homey' })
  return sendRedirect(event, authorizeUrl(redirectUri(event), state), 302)
})
