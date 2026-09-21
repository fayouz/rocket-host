// Page menage : nom du logement + niveau de chaque article. Le secret est le token dans l'adresse.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  await ensureStock()
  const { propertyId, name } = await propertyByToken(token)
  const db = useDatabase()
  const rows = (await db.sql`SELECT i.id, i.name, l.level FROM stock_item i JOIN stock_level l ON l.item_id = i.id AND l.property_id = ${propertyId} ORDER BY i.id`).rows as any[]
  return { property: name, items: rows.map(r => ({ id: Number(r.id), name: String(r.name), level: String(r.level) })) }
})
