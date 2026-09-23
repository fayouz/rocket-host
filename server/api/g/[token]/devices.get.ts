// Appareils domotiques mis a disposition du voyageur (lien secret, meme jeton). Lecture en direct, pas de cache.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const logementId = await logementByGuestToken(token)
  return { devices: await resolveGuestDeviceViews(logementId) }
})
