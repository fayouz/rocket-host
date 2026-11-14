// Ménages du logement (tâches Loussa Lieux créées par Loussa Réservations après chaque départ), lecture seule, PMS actif seulement.
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  return { items: await pmsCleanings(lg.lodgifyPropertyId) }
})
