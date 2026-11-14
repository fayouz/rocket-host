// Bilan annuel calculé par Loussa Réservations (revenus + dépenses du PMS), ?year= (PMS actif seulement).
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  const y = Number(getQuery(event).year)
  return pmsBilan(lg.lodgifyPropertyId, Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear())
})
