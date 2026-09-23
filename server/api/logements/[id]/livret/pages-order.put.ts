// Reordonne les pages du logement (barre de navigation du carrousel, sections du mode Defilement).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const b = ((await readBody(event)) ?? {}) as { order?: unknown }
  await reorderPages(lg.id, Array.isArray(b.order) ? b.order.map(Number) : [])
  return { ok: true }
})
