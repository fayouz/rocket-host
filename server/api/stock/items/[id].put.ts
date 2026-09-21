// Modifie un article : { name?, asin?, reorderQty?, subscription? }
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const b = await readBody(event)
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const db = useDatabase()
  if (typeof b?.name === 'string' && b.name.trim()) await db.sql`UPDATE stock_item SET name = ${b.name.trim().slice(0, 80)} WHERE id = ${id}`
  if (typeof b?.asin === 'string') {
    const asin = b.asin.trim().toUpperCase()
    if (asin && !/^[A-Z0-9]{10}$/.test(asin)) throw createError({ statusCode: 400, statusMessage: 'Référence Amazon (ASIN) invalide : 10 lettres ou chiffres' })
    await db.sql`UPDATE stock_item SET asin = ${asin} WHERE id = ${id}`
  }
  if (Number.isInteger(b?.reorderQty) && b.reorderQty >= 1 && b.reorderQty <= 99) await db.sql`UPDATE stock_item SET reorder_qty = ${b.reorderQty} WHERE id = ${id}`
  if (typeof b?.subscription === 'boolean') await db.sql`UPDATE stock_item SET subscription = ${b.subscription ? 1 : 0} WHERE id = ${id}`
  return { ok: true }
})
