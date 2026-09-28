// Envoie un message au voyageur dans le fil Lodgify de la reservation : { text, messageId }.
// send_notification=true : Lodgify le pousse sur le canal de la reservation (Airbnb, Booking...) ou par e-mail.
// messageId (uuid genere par le navigateur) rend l'envoi idempotent : un double clic ou un nouvel essai ne l'envoie pas deux fois.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const bookingId = Number(getRouterParam(event, 'bookingId'))
  const body = await readBody(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Message vide' })
  if (text.length > 5000) throw createError({ statusCode: 400, statusMessage: 'Message trop long (5000 caractères max)' })
  if (typeof body?.messageId !== 'string' || !UUID.test(body.messageId)) throw createError({ statusCode: 400, statusMessage: 'Identifiant de message invalide' })

  const { bookings, demo } = await loadData()
  const b = bookings.find(x => x.id === bookingId && x.propertyId === lg.lodgifyPropertyId)
  if (!b) throw createError({ statusCode: 404, statusMessage: 'Réservation inconnue pour ce logement' })
  if (pmsEnabled()) { // Rocket PMS actif : la reponse part via le PMS (meme messageId, meme idempotence)
    await pmsReply(lg.lodgifyPropertyId, bookingId, text, body.messageId)
    return { ok: true }
  }
  if (demo) throw createError({ statusCode: 400, statusMessage: 'Envoi impossible en mode démo' })

  const res = await fetch(`https://api.lodgify.com/v1/reservation/booking/${bookingId}/messages`, {
    method: 'POST',
    headers: { 'X-ApiKey': getSecret('LODGIFY_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify([{ type: 'Owner', message: escapeHtml(text).replace(/\n/g, '<br/>'), send_notification: true, message_id: body.messageId }]),
  })
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `Lodgify a refusé l'envoi (${res.status})` })
  if (b.threadUid) forgetThread(b.threadUid)
  return { ok: true }
})
