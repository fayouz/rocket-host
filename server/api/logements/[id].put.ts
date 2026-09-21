// Renomme un logement : { name }
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const b = await readBody(event)
  if (typeof b?.name !== 'string') throw createError({ statusCode: 400, statusMessage: 'Nom requis' })
  await renameLogement(lg.id, b.name)
  return { ok: true }
})
