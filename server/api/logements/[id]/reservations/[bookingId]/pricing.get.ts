// Valeur d'une reservation et detail du calcul (devis Lodgify : nuitees, frais, taxes, options), avec paye / reste du.
// La commission de la plateforme (Airbnb, Booking) n'est pas fournie par Lodgify : elle n'apparait pas ici.
const LABELS: Record<string, string> = { RoomRate: 'Nuitées', Fee: 'Frais', Tax: 'Taxe', Promotion: 'Promotion', Discount: 'Remise', AddOn: 'Option' }

export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const bookingId = Number(getRouterParam(event, 'bookingId'))
  const { bookings, demo } = await loadData()
  const b = bookings.find(x => x.id === bookingId && x.propertyId === lg.lodgifyPropertyId)
  if (!b) throw createError({ statusCode: 404, statusMessage: 'Réservation inconnue pour ce logement' })
  if (pmsEnabled()) return pmsPricing(lg.lodgifyPropertyId, bookingId)
  const nights = Math.max(0, Math.round((+new Date(b.departure) - +new Date(b.arrival)) / 864e5))
  if (demo) return { currency: 'EUR', total: b.total, paid: 0, due: b.total, nights, lines: [{ kind: 'RoomRate', label: 'Nuitées', amount: b.total }] }

  const r = await lodgifyCall(`/reservations/bookings/${bookingId}`, useRuntimeConfig().lodgifyApiKey)
  const q = r?.quote ?? {}
  const items = [...(q.room_type_items ?? []).flatMap((i: any) => i.prices ?? []), ...(q.addon_items ?? []).flatMap((i: any) => i.prices ?? [i]), ...(q.other_items ?? []).flatMap((i: any) => i.prices ?? [i])]
  const lines = items
    .filter((p: any) => Number(p.amount))
    .map((p: any) => {
      const kind = String(p.type || '')
      const desc = String(p.description || '').trim()
      const label = kind === 'RoomRate' ? 'Nuitées' : desc && !/^room rate$/i.test(desc) ? desc.charAt(0).toUpperCase() + desc.slice(1) : (LABELS[kind] ?? kind)
      return { kind, label, amount: Number(p.amount) }
    })
  return {
    currency: String(r?.currency_code || 'EUR'),
    total: Number(r?.total_amount ?? b.total),
    paid: Number(r?.amount_paid ?? 0),
    due: Number(r?.amount_due ?? 0),
    nights,
    lines,
  }
})
