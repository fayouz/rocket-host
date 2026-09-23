// Pages du livret/ecran TV de ce logement (regroupement de widgets), pour edition cote hote.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  return { pages: await getPages(lg.id) }
})
