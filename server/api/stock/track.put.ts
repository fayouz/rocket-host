// Un logement suit (ou non) un article : { propertyId (id Lodgify), itemId, tracked }
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  if (!Number.isInteger(b?.propertyId) || !Number.isInteger(b?.itemId) || typeof b?.tracked !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  const properties = await ensureStock()
  const exists = ((await useDatabase().sql`SELECT id FROM stock_item WHERE id = ${b.itemId}`).rows as any[]).length > 0
  if (!properties.some(p => p.id === b.propertyId) || !exists) throw createError({ statusCode: 404, statusMessage: 'Logement ou article inconnu' })
  await setTracked(b.propertyId, b.itemId, b.tracked)
  return { ok: true }
})
