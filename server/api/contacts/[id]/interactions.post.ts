// Ajoute un echange a l'historique : { note, at? (AAAA-MM-JJ, defaut aujourd'hui) }
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const b = (await readBody(event)) ?? {}
  const note = String(b.note ?? '').trim().slice(0, 1000)
  const at = b.at ? String(b.at) : new Date().toISOString().slice(0, 10)
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  if (!note) throw createError({ statusCode: 400, statusMessage: 'Note requise' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(at) || Number.isNaN(Date.parse(at))) throw createError({ statusCode: 400, statusMessage: 'Date invalide (AAAA-MM-JJ)' })
  const db = useDatabase()
  if (!((await db.sql`SELECT id FROM contact WHERE id = ${id}`).rows as any[]).length) throw createError({ statusCode: 404, statusMessage: 'Contact inconnu' })
  await db.sql`INSERT INTO contact_interaction (contact_id, at, note) VALUES (${id}, ${at}, ${note})`
  return { ok: true }
})
