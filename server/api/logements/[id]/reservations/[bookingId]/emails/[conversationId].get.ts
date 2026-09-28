// Messages d'une conversation e-mail rattachée à la réservation (texte seulement, notes internes exclues par le PMS).
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  return pmsBookingEmailThread(lg.lodgifyPropertyId, Number(getRouterParam(event, 'bookingId')), String(getRouterParam(event, 'conversationId') || ''))
})
