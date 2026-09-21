// Bilan annuel du logement (?year=AAAA, defaut : annee en cours)
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const y = Number(getQuery(event).year)
  return buildBilan(lg, Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : new Date().getUTCFullYear())
})
