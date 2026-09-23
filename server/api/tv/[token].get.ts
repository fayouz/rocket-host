// Page TV plein ecran (lien secret, meme lien que le livret) : accueil du voyageur du jour + contenu du livret.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const logementId = await logementByGuestToken(token)
  const logements = await ensureLogements()
  const lg = logements.find(l => l.id === logementId)
  if (!lg) throw createError({ statusCode: 404, statusMessage: 'Logement introuvable' })
  const content = await getGuestbook(logementId)
  const today = new Date().toISOString().slice(0, 10)
  let guest: { firstName: string; arrival: string; departure: string } | null = null
  if (lg.lodgifyPropertyId !== null) {
    const { bookings } = await loadData()
    const b = bookings.find(x => x.propertyId === lg.lodgifyPropertyId && isActiveBooking(x) && x.arrival <= today && x.departure > today)
    if (b) guest = { firstName: (b.guest.split(' ')[0] || b.guest).slice(0, 40), arrival: b.arrival, departure: b.departure }
  }
  const weather = lg.latitude !== null && lg.longitude !== null ? await getWeather(lg.latitude, lg.longitude) : null
  return { logement: lg.name, content, guest, weather }
})
