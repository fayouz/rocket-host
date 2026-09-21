export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  await useDatabase().sql`DELETE FROM mail_folder_rule WHERE id = ${id}`
  return { ok: true }
})
