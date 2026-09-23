// Choisit une image web (Openverse, domaine public) comme fond propre au logement.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const b = (await readBody(event)) ?? {}
  const url = String(b.url || '')
  if (!/^https:\/\//.test(url)) throw createError({ statusCode: 400, statusMessage: 'URL invalide' })
  await saveBackgroundWeb(lg.id, url, String(b.attribution || ''))
  return { ok: true }
})
