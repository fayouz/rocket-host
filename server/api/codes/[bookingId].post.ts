// Envoi reel vers Nuki d'UN code (declenche par le bouton de confirmation de la page Codes)
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'bookingId'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Réservation invalide' })
  return sendCode(id)
})
