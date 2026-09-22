// Page publique du livret d'accueil (lien secret, sans compte). Lecture seule.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const logementId = await logementByGuestToken(token)
  const logements = await ensureLogements()
  const lg = logements.find(l => l.id === logementId)
  if (!lg) throw createError({ statusCode: 404, statusMessage: 'Logement introuvable' })
  const content = await getGuestbook(logementId)
  return { logement: lg.name, content }
})
