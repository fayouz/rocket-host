// Rattache a la main un message a une reservation ou a un contact : { kind: booking|contact, targetId }
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const row = await getMailRow(Number(getRouterParam(event, 'id')))
  if (!['booking', 'contact'].includes(b.kind) || !Number.isInteger(b.targetId) || b.targetId < 1) throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  if (b.kind === 'contact' && !((await useDatabase().sql`SELECT id FROM contact WHERE id = ${b.targetId}`).rows as any[]).length) throw createError({ statusCode: 404, statusMessage: 'Contact inconnu' })
  if (b.kind === 'booking' && !(await loadData()).bookings.some(x => x.id === b.targetId)) throw createError({ statusCode: 404, statusMessage: 'Réservation inconnue' })
  await useDatabase().sql`INSERT INTO mail_link (message_id, kind, target_id, score, method) VALUES (${Number(row.id)}, ${b.kind}, ${b.targetId}, 100, 'manual')
    ON CONFLICT(message_id, kind, target_id) DO UPDATE SET method = 'manual', score = 100`
  return { ok: true }
})
