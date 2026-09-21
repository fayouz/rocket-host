// Reservations les plus proches d'un message (par la date du mail), a proposer pour un rattachement manuel.
// Distance = jours entre la date du mail et le sejour (0 = mail recu pendant le sejour) ; le nom du voyageur cite dans le mail prime.
export default defineEventHandler(async (event) => {
  const row = await getMailRow(Number(getRouterParam(event, 'id')))
  const links = (await useDatabase().sql`SELECT kind, target_id FROM mail_link WHERE message_id = ${Number(row.id)} AND method != 'removed'`).rows as any[]
  const linked = new Set(links.filter(l => l.kind === 'booking').map(l => Number(l.target_id)))
  const { bookings } = await loadData()
  const label = await mailLabels()
  const day = (d: string) => Math.floor(new Date(d).getTime() / 86_400_000)
  const at = day(String(row.date))
  // Corps lu dans la boite a la demande (jamais stocke) : les numeros de reservation y sont souvent, pas dans l'apercu
  let body = ''
  try { body = (await readMessage(row)).text } catch { /* boite injoignable : on se rabat sur l'objet et l'apercu */ }
  const ids = new Set([...`${row.subject} ${row.snippet} ${body}`.matchAll(/(?<!\d)(\d{7,9})(?!\d)/g)].map(x => Number(x[1])))
  const text = `${row.subject} ${row.from_name} ${row.snippet}`.toLowerCase()
  const fr = (n: number) => `${n} jour${n > 1 ? 's' : ''}`
  return bookings.filter(b => isActiveBooking(b) && !linked.has(b.id)).map((b) => {
    const a = day(b.arrival), d = day(b.departure)
    const dist = at < a ? a - at : at > d ? at - d : 0
    const named = b.guest.trim().split(/\s+/).length > 1 && b.guest.toLowerCase().split(/\s+/).filter(w => w.length > 2).every(w => text.includes(w))
    const cited = ids.has(Number(b.id))
    const reason = cited ? 'numéro de réservation cité dans le mail' : named ? 'nom du voyageur cité' : dist === 0 ? 'reçu pendant le séjour' : at < a ? `reçu ${fr(dist)} avant l'arrivée` : `reçu ${fr(dist)} après le départ`
    return { id: b.id, label: label.booking(b.id), reason, rank: (cited ? -10000 : named ? -1000 : 0) + dist }
  }).sort((x, y) => x.rank - y.rank).slice(0, 3).map(({ rank, ...r }) => r)
})
