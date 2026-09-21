export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const r = await parseRule((await readBody(event)) ?? {})
  await useDatabase().sql`UPDATE imap_rule SET name = ${r.name}, sender = ${r.sender}, subject = ${r.subject}, source = ${r.source}, category = ${r.category}, logement_id = ${r.logementId}, enabled = ${r.enabled ? 1 : 0} WHERE id = ${id}`
  return { ok: true }
})
