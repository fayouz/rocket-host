// Appareils domotiques mis a disposition du voyageur (lien secret, meme jeton). Lecture en direct, pas de cache.
// Frequence limitee par jeton (independamment du contenu) : chaque appel lit reellement le hub Homey.
const last = new Map<string, number>()

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  if (Date.now() - (last.get(token!) ?? 0) < 1000) throw createError({ statusCode: 429, statusMessage: 'Patiente un instant' })
  last.set(token!, Date.now())
  if (last.size > 1000) for (const [k, t] of last) if (Date.now() - t > 3600_000) last.delete(k) // purge occasionnelle

  const logementId = await logementByGuestToken(token)
  try {
    return { devices: await resolveGuestDeviceViews(logementId) }
  } catch (e) {
    throw createError({ statusCode: 502, statusMessage: guestSafeMessage(e) })
  }
})
