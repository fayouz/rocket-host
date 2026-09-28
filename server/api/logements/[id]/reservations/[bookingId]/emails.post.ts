// Envoie un e-mail au voyageur via Rocket PMS / Rocket Mailer : { subject, text, messageId }. Uniquement sur clic Envoyer.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!subject || subject.length > 200) throw createError({ statusCode: 400, statusMessage: 'Objet vide ou trop long (200 caractères max)' })
  if (!text || text.length > 10000) throw createError({ statusCode: 400, statusMessage: 'Message vide ou trop long (10000 caractères max)' })
  if (typeof body?.messageId !== 'string' || !UUID.test(body.messageId)) throw createError({ statusCode: 400, statusMessage: 'Identifiant de message invalide' })
  return pmsSendBookingEmail(lg.lodgifyPropertyId, Number(getRouterParam(event, 'bookingId')), { subject, text, messageId: body.messageId })
})
