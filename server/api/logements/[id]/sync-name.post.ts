// Reprend le nom court de Lodgify (nom interne) comme nom du logement
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  return { name: await syncLogementName(lg.id) }
})
