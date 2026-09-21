export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id')), iid = Number(getRouterParam(event, 'iid'))
  if (!Number.isInteger(id) || !Number.isInteger(iid)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  await useDatabase().sql`DELETE FROM contact_interaction WHERE id = ${iid} AND contact_id = ${id}`
  return { ok: true }
})
