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
  let reloadAt: string | null = null
  if (lg.lodgifyPropertyId !== null) {
    const { bookings } = await loadData()
    const mine = bookings.filter(x => x.propertyId === lg.lodgifyPropertyId && isActiveBooking(x))
    const b = mine.find(x => x.arrival <= today && x.departure > today)
    if (b) guest = { firstName: (b.guest.split(' ')[0] || b.guest).slice(0, 40), arrival: b.arrival, departure: b.departure }
    // Prochaine arrivee a venir (hors sejour en cours) : sert a recharger l'ecran (pas juste les donnees) un peu avant,
    // pour repartir sur un etat propre au prochain voyageur plutot que de compter sur le simple rafraichissement.
    const next = mine.filter(x => x.arrival >= today && x.id !== b?.id).sort((x, y) => x.arrival.localeCompare(y.arrival))[0]
    if (next) {
      // parisToIso (server/utils/codes.ts) gere le fuseau (CET/CEST) correctement ; un new Date(...) direct sur une
      // chaine sans fuseau se cale sur le fuseau du serveur, faux si celui-ci n'est pas Europe/Paris (ex. conteneur en UTC).
      const at = new Date(parisToIso(next.arrival, next.checkIn || DEFAULT_CHECKIN))
      at.setMinutes(at.getMinutes() - 30) // marge : ecran pret avant l'heure d'arrivee, pas apres
      reloadAt = at.toISOString()
    }
  }
  const weather = lg.latitude !== null && lg.longitude !== null ? await getWeather(lg.latitude, lg.longitude) : null
  const background = await resolveBackground(logementId, `/api/g/${token}/background`)
  const widgetOrder = await getWidgetOrder(logementId)
  const layout = await getLayoutSettings(logementId)
  // Pas de journalisation de visite ici : la page TV s'auto-rafraichit toutes les 10 min (voir app/pages/tv/[token].vue),
  // ce qui fausserait le compteur (un ecran allume des jours generait des centaines de "visites"). Seul /g/:token compte.
  return { logement: lg.name, content, guest, weather, background, reloadAt, widgetOrder, layout }
})
