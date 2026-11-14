// E-mails (Loussa Mail) rattachés à la réservation, via Loussa Réservations (PMS actif seulement).
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  return pmsBookingEmails(lg.lodgifyPropertyId, Number(getRouterParam(event, 'bookingId')))
})
