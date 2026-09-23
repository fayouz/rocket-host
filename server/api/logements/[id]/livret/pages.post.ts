// Cree une nouvelle page (vide, sans widget assigne).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const b = (await readBody(event)) ?? {}
  const id = await createPage(lg.id, String(b.label || ''), String(b.icon || ''))
  return { ok: true, id }
})
