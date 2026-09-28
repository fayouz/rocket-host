// Livret d'accueil et écran TV du logement tels que Rocket PMS les gère (PMS actif seulement) : lien TV, visites, lien éditeur.
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  return pmsWelcomeBook(lg.lodgifyPropertyId)
})
