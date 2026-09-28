// Envoie le lien du livret au voyageur via Rocket PMS : { channel: lodgify|email, messageId, text?, lang? }.
// Appelée uniquement par le bouton « Envoyer le livret » après confirmation (messageId du navigateur : envoi idempotent).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const channel = body?.channel === 'email' ? 'email' : body?.channel === 'lodgify' ? 'lodgify' : ''
  if (!channel) throw createError({ statusCode: 400, statusMessage: 'Canal inconnu (lodgify ou email)' })
  if (typeof body?.messageId !== 'string' || !UUID.test(body.messageId)) throw createError({ statusCode: 400, statusMessage: 'Identifiant de message invalide' })
  const text = typeof body?.text === 'string' ? body.text.slice(0, 5000) : undefined
  const lang = typeof body?.lang === 'string' ? body.lang.slice(0, 5) : undefined
  return pmsSendGuestLink(lg.lodgifyPropertyId, Number(getRouterParam(event, 'bookingId')), { channel, messageId: body.messageId, text, lang })
})
