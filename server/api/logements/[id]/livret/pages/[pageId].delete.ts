// Supprime une page : ses widgets deviennent non assignes (n'apparaissent plus nulle part, comme desactives).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const pageId = Number(getRouterParam(event, 'pageId'))
  await getPageForLogement(pageId, lg.id)
  await deletePage(pageId)
  return { ok: true }
})
