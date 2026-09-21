// Recherche de cibles pour rattacher un message a la main : reservations (nom du voyageur ou numero) et contacts. ?q=
export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '').trim().toLowerCase()
  const { bookings } = await loadData()
  const label = await mailLabels()
  const bks = bookings.filter(b => isActiveBooking(b) && (!q || b.guest.toLowerCase().includes(q) || String(b.id).includes(q)))
    .sort((a, b) => b.arrival.localeCompare(a.arrival)).slice(0, 15).map(b => ({ id: b.id, label: label.booking(b.id) }))
  const cts = ((await useDatabase().sql`SELECT id, name FROM contact ORDER BY name COLLATE NOCASE`).rows as any[])
    .filter(c => !q || String(c.name).toLowerCase().includes(q)).slice(0, 15).map(c => ({ id: Number(c.id), label: label.contact(Number(c.id)) }))
  return { bookings: bks, contacts: cts }
})
