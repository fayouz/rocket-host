// Supprime un contact avec son historique d'echanges (definitif : l'interface demande confirmation)
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const db = useDatabase()
  if (!((await db.sql`SELECT id FROM contact WHERE id = ${id}`).rows as any[]).length) throw createError({ statusCode: 404, statusMessage: 'Contact inconnu' })
  await db.sql`DELETE FROM contact_interaction WHERE contact_id = ${id}`
  await db.sql`DELETE FROM contact_logement WHERE contact_id = ${id}`
  await db.sql`DELETE FROM contact WHERE id = ${id}`
  return { ok: true }
})
