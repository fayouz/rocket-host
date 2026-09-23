// Journee : filtree selon les logements autorises du compte
export default defineEventHandler(async (event) => {
  const data = await loadData()
  const ids = await allowedPropertyIds(event)
  const built = ids
    ? buildToday({ ...data, bookings: data.bookings.filter(b => ids.has(b.propertyId)), properties: data.properties.filter(p => ids.has(p.id)) })
    : buildToday(data)
  const today = { ...built, syncedAt: lastSyncAt() }

  // Enrichit chaque turnover avec le menage lie (assignee/etat), pour l'affichage en carte sur le tableau de bord
  // (meme jointure que la timeline : le menage d'un turnover est rattache a la reservation de DEPART, voir server/utils/timeline.ts).
  if (!today.turnovers.length) return today
  const outIds = today.turnovers.map(t => t.out!.id)
  const placeholders = outIds.map(() => '?').join(',')
  const rows = (await useDatabase().prepare(`SELECT booking_id, assignee, status FROM cleaning_task WHERE booking_id IN (${placeholders})`).all(...outIds)) as any[]
  const byBookingId = new Map(rows.map(r => [Number(r.booking_id), { assignee: String(r.assignee), status: String(r.status) }]))
  return { ...today, turnovers: today.turnovers.map(t => ({ ...t, cleaning: byBookingId.get(t.out!.id) ?? null })) }
})
