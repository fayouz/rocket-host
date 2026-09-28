// Rocket PMS actif : documents du lieu (Rocket Cloud via Rocket Place), en lecture ; ?folder pour un sous-dossier
export default defineEventHandler(async (event) => {
  if (!pmsEnabled()) return { enabled: false as const }
  const lg = await getLogement(getRouterParam(event, 'id'))
  const folder = getQuery(event).folder
  return { enabled: true as const, ...await pmsDocuments(lg.lodgifyPropertyId, typeof folder === 'string' && folder ? folder : undefined) }
})
