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
  type Msg = { key: string; kind: 'lodgify' | 'mail'; from: 'host' | 'guest'; at: string; subject: string; text: string; status: string; mailId?: number; sender?: string }
  const messages: Msg[] = []
  if (!demo && b.threadUid) {
    const t = await lodgifyCall(`/messaging/${b.threadUid}`, useRuntimeConfig().lodgifyApiKey)
    for (const m of t?.messages || []) {
      messages.push({
        key: `l${m.id}`, kind: 'lodgify', from: m.type === 'Owner' ? 'host' : 'guest',
        at: new Date(String(m.date_created) + 'Z').toISOString(), // dates Lodgify sans fuseau : lues comme UTC
        subject: String(m.subject || ''), text: toText(String(m.message || '')), status: m.message_status || '',
      })
    }
  }

  // E-mails rattaches a la reservation (menu E-mails) : reserves a l'administrateur, comme la messagerie elle-meme.
  // Seuls l'en-tete et l'apercu sont en base ; le message complet s'ouvre dans la messagerie.
  if ((await currentUser(event))?.role === 'admin') {
    const cfg = await getImapConfig()
    const rows = (await useDatabase().sql`SELECT m.id, m.message_id, m.folder, m.from_name, m.from_addr, m.subject, m.date, m.snippet FROM mail_message m
      JOIN mail_link l ON l.message_id = m.id WHERE l.kind = 'booking' AND l.target_id = ${bookingId} AND l.method != 'removed'`).rows as any[]
    const seen = new Set<string>() // un meme e-mail peut etre present dans plusieurs dossiers (meme en-tete Message-ID)
    for (const r of rows) {
      const mid = String(r.message_id)
      if (mid && seen.has(mid)) continue
      seen.add(mid)
      const host = String(r.folder) === cfg.sentFolder || String(r.from_addr).toLowerCase() === cfg.user.toLowerCase()
      messages.push({
        key: `m${r.id}`, kind: 'mail', from: host ? 'host' : 'guest', at: new Date(String(r.date)).toISOString(),
        subject: String(r.subject), text: String(r.snippet), status: '', mailId: Number(r.id), sender: String(r.from_name || r.from_addr),
      })
    }
  }
  return { messages: messages.sort((a, c) => a.at.localeCompare(c.at)) }
})
