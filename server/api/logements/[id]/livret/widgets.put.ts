// Choisit les widgets affiches sur le livret/ecran TV de ce logement, et leur ordre.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const order = ((await readBody(event)) ?? {}) as { order?: unknown }
  await saveWidgetOrder(lg.id, Array.isArray(order.order) ? order.order : [])
  return { ok: true }
})
