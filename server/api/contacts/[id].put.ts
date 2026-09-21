export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const db = useDatabase()
  if (!((await db.sql`SELECT id FROM contact WHERE id = ${id}`).rows as any[]).length) throw createError({ statusCode: 404, statusMessage: 'Contact inconnu' })
  const c = parseContact((await readBody(event)) ?? {})
  await saveLinks(id, c.logementIds)
  await db.sql`UPDATE contact SET name = ${c.name}, kind = ${c.kind}, company = ${c.company}, phone = ${c.phone}, phone2 = ${c.phone2}, email = ${c.email},
    website = ${c.website}, address = ${c.address}, note = ${c.note}, follow_up = ${c.followUp}, updated_at = ${new Date().toISOString()} WHERE id = ${id}`
  return { ok: true }
})
