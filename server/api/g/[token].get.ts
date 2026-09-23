// Page publique du livret d'accueil (lien secret, sans compte). Lecture seule.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const logementId = await logementByGuestToken(token)
  const logements = await ensureLogements()
  const lg = logements.find(l => l.id === logementId)
  if (!lg) throw createError({ statusCode: 404, statusMessage: 'Logement introuvable' })
  const content = await getGuestbook(logementId)
  if (content.welcomeText) content.welcomeText = applyGuestPlaceholder(content.welcomeText, await getCurrentGuestFirstName(lg))
  const weather = lg.latitude !== null && lg.longitude !== null ? await getWeather(lg.latitude, lg.longitude) : null
  const background = await resolveBackground(logementId, `/api/g/${token}/background`)
  const layout = await getLayoutSettings(logementId)
  const pages = await getPages(logementId)
  const pageBackgrounds = await resolvePageBackgrounds(logementId, pid => `/api/g/${token}/pages/${pid}/background`)
  await logGuestVisit(logementId, 'g')
  return { logement: lg.name, content, weather, background, layout, pages, pageBackgrounds }
})
