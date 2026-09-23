// Choisit une image web (Openverse, domaine public) comme fond propre a une page.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const pageId = Number(getRouterParam(event, 'pageId'))
  await getPageForLogement(pageId, lg.id)
  const b = (await readBody(event)) ?? {}
  const url = String(b.url || '')
  if (!/^https:\/\//.test(url)) throw createError({ statusCode: 400, statusMessage: 'URL invalide' })
  await savePageBackgroundWeb(pageId, url, String(b.attribution || ''))
  return { ok: true }
})
