// Rocket PMS actif : telechargement d'un document du lieu (a la demande, jamais en tache de fond)
export default defineEventHandler(async (event) => {
  if (!pmsEnabled()) throw createError({ statusCode: 404, statusMessage: 'Rocket PMS non configuré' })
  const lg = await getLogement(getRouterParam(event, 'id'))
  const { body, type, disposition } = await pmsDocumentContent(lg.lodgifyPropertyId, String(getRouterParam(event, 'itemId')))
  setResponseHeaders(event, { 'content-type': type, 'content-disposition': disposition, 'x-content-type-options': 'nosniff' })
  return Buffer.from(body)
})
