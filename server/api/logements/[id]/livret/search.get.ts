// Recherche d'images de fond libres de droits (Openverse) pour ce logement.
export default defineEventHandler(async (event) => {
  await getLogement(getRouterParam(event, 'id'))
  return searchBackgrounds(String(getQuery(event).q || ''))
})
