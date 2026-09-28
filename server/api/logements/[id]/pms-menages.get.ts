// Ménages du logement (tâches Rocket Place créées par Rocket PMS après chaque départ), lecture seule, PMS actif seulement.
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  return { items: await pmsCleanings(lg.lodgifyPropertyId) }
})
