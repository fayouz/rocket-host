// Retire un rattachement : { kind, targetId }. Un rattachement automatique est marque « retire » (il ne reviendra pas).
export default defineEventHandler(async (event) => {
  const b = (await readBody(event)) ?? {}
  const row = await getMailRow(Number(getRouterParam(event, 'id')))
  if (!['booking', 'contact'].includes(b.kind) || !Number.isInteger(b.targetId)) throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  const db = useDatabase()
  const cur = ((await db.sql`SELECT method FROM mail_link WHERE message_id = ${Number(row.id)} AND kind = ${b.kind} AND target_id = ${b.targetId}`).rows as any[])[0]
  if (!cur) return { ok: true }
  if (cur.method === 'manual') await db.sql`DELETE FROM mail_link WHERE message_id = ${Number(row.id)} AND kind = ${b.kind} AND target_id = ${b.targetId}`
  else await db.sql`UPDATE mail_link SET method = 'removed' WHERE message_id = ${Number(row.id)} AND kind = ${b.kind} AND target_id = ${b.targetId}`
  return { ok: true }
})
