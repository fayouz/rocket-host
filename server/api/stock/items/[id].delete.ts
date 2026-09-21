export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const db = useDatabase()
  await db.sql`DELETE FROM stock_level WHERE item_id = ${id}`
  await db.sql`DELETE FROM stock_item WHERE id = ${id}`
  return { ok: true }
})
