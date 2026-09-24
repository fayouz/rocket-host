// Reservations du logement (Lodgify) : les 60 derniers jours et toutes les a venir, avec l'etat du code clavier s'il existe
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const { bookings, demo } = await loadData()
  await planCodes().catch(() => {}) // planifie les codes a venir (base locale uniquement)
  const codes = (await useDatabase().sql`SELECT booking_id, status, code, valid_from, valid_until, error FROM access_code`).rows as any[]
  const mails = (await useDatabase().sql`SELECT target_id, COUNT(*) AS n FROM mail_link WHERE kind = 'booking' AND method != 'removed' GROUP BY target_id`).rows as any[]
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
  const nights = (a: string, d: string) => Math.max(0, Math.round((+new Date(d) - +new Date(a)) / 864e5))
  const items = bookings
    .filter(b => b.propertyId === lg.lodgifyPropertyId && b.departure >= since)
    .sort((a, b) => b.arrival.localeCompare(a.arrival))
    .map((b) => {
      const c = codes.find(x => Number(x.booking_id) === b.id)
      return {
        id: b.id, guest: b.guest, guestEmail: b.guestEmail ?? null, source: b.source, status: b.status, arrival: b.arrival, departure: b.departure,
        nights: nights(b.arrival, b.departure), checkIn: b.checkIn ?? null, checkOut: b.checkOut ?? null, total: b.total,
        mails: Number(mails.find(m => Number(m.target_id) === b.id)?.n ?? 0),
        active: isActiveBooking(b), code: c?.status ?? null,
        // Code clavier prevu pour cette reservation (meme en cours ou passee), avec sa periode de validite
        access: c ? { code: String(c.code), validFrom: String(c.valid_from), validUntil: String(c.valid_until), status: String(c.status), error: c.error ? String(c.error) : null } : null,
      }
    })
  return { demo, logement: lg, items }
})
