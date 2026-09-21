// Webhook appele par n8n quand un mail Lodgify annonce/modifie une tache de menage.
// Auth : en-tete "Authorization: Bearer <WEBHOOK_TOKEN>".
// Corps : { bookingId } OU { property, date } (date = jour du check-out, YYYY-MM-DD),
//         + { assignee, status } ; { deleted: true } supprime la tache.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default defineEventHandler(async (event) => {
  requireWebhookToken(event)

  const b = await readBody(event)
  const { bookings, properties } = await loadData()

  // 1) reservation : par identifiant, sinon par logement + jour du check-out
  let booking = Number.isInteger(b?.bookingId) ? bookings.find(x => x.id === b.bookingId) : undefined
  if (!booking && typeof b?.property === 'string' && /^\d{4}-\d{2}-\d{2}/.test(String(b?.date))) {
    const q = norm(b.property)
    const ids = properties.filter(p => [p.name, p.original || ''].some(n => norm(n).includes(q) || q.includes(norm(n)))).map(p => p.id)
    const day = String(b.date).slice(0, 10)
    booking = bookings.find(x => ids.includes(x.propertyId) && x.departure === day && isActiveBooking(x))
  }
  if (!booking) throw createError({ statusCode: 404, statusMessage: 'Réservation introuvable (fournir bookingId, ou property + date de check-out)' })

  const db = useDatabase()
  if (b.deleted === true) {
    await db.sql`DELETE FROM cleaning_task WHERE booking_id = ${booking.id}`
    return { ok: true, bookingId: booking.id, deleted: true }
  }
  if (typeof b.assignee !== 'string' || typeof b.status !== 'string' || !b.assignee.trim() || !b.status.trim())
    throw createError({ statusCode: 400, statusMessage: 'assignee et status (texte) requis' })

  const now = new Date().toISOString().slice(0, 10)
  await db.sql`INSERT INTO cleaning_task (booking_id, assignee, status, synced_at) VALUES (${booking.id}, ${b.assignee.trim().slice(0, 80)}, ${b.status.trim().slice(0, 40)}, ${now})
    ON CONFLICT(booking_id) DO UPDATE SET assignee = excluded.assignee, status = excluded.status, synced_at = excluded.synced_at`
  return { ok: true, bookingId: booking.id }
})
