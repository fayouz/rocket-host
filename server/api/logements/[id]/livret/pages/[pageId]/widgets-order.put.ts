// Reordonne les widgets a l'interieur d'une page.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const pageId = Number(getRouterParam(event, 'pageId'))
  await getPageForLogement(pageId, lg.id)
  const b = ((await readBody(event)) ?? {}) as { order?: unknown }
  await reorderPageWidgets(pageId, Array.isArray(b.order) ? b.order.map(String) : [])
  return { ok: true }
})
