// Modifie les infos d'un logement : { name } et/ou { color } (repere visuel, voir server/utils/logements.ts#LOGEMENT_COLORS)
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const b = await readBody(event)
  if (typeof b?.name === 'string') await renameLogement(lg.id, b.name)
  if (typeof b?.color === 'string') await setLogementColor(lg.id, b.color)
  if (typeof b?.name !== 'string' && typeof b?.color !== 'string') throw createError({ statusCode: 400, statusMessage: 'Nom ou couleur requis' })
  return { ok: true }
})
