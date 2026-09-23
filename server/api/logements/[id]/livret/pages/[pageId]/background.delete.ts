// Retire le fond propre a cette page : elle revient a herite du fond du logement.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const pageId = Number(getRouterParam(event, 'pageId'))
  await getPageForLogement(pageId, lg.id)
  await removePageBackground(pageId)
  return { ok: true }
})
