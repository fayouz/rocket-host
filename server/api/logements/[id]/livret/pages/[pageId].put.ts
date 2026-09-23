// Renomme une page (nom et icone).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const pageId = Number(getRouterParam(event, 'pageId'))
  await getPageForLogement(pageId, lg.id)
  const b = (await readBody(event)) ?? {}
  await renamePage(pageId, String(b.label || ''), String(b.icon || ''))
  return { ok: true }
})
