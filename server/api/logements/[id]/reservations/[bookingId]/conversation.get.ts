// Fil de conversation Lodgify d'une reservation (messages de l'hote et du voyageur). Le HTML Lodgify est converti en texte
// cote serveur : le navigateur n'affiche jamais de HTML venu de l'exterieur.
function toText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\n{3,}/g, '\n\n').trim()
}

export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const bookingId = Number(getRouterParam(event, 'bookingId'))
  const { bookings, demo } = await loadData()
  const b = bookings.find(x => x.id === bookingId && x.propertyId === lg.lodgifyPropertyId)
  if (!b) throw createError({ statusCode: 404, statusMessage: 'Réservation inconnue pour ce logement' })
  if (demo || !b.threadUid) return { messages: [] }
  const t = await lodgifyCall(`/messaging/${b.threadUid}`, useRuntimeConfig().lodgifyApiKey)
  const messages = (t?.messages || [])
    .map((m: any) => ({
      id: Number(m.id),
      from: m.type === 'Owner' ? 'host' : 'guest',
      at: new Date(String(m.date_created) + 'Z').toISOString(), // dates Lodgify sans fuseau : lues comme UTC
      subject: String(m.subject || ''),
      text: toText(String(m.message || '')),
      channel: m.route || '',
      status: m.message_status || '',
    }))
    .sort((a: { at: string }, c: { at: string }) => a.at.localeCompare(c.at))
  return { messages }
})
