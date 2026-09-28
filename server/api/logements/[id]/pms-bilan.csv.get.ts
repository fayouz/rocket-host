// Export CSV du bilan Rocket PMS (?year=), relayé tel quel (PMS actif seulement).
export default defineEventHandler(async (event) => {
  requirePms()
  const lg = await getLogement(getRouterParam(event, 'id'))
  const y = Number(getQuery(event).year)
  const csv = await pmsBilanCsv(lg.lodgifyPropertyId, Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear())
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', csv.disposition)
  setHeader(event, 'x-content-type-options', 'nosniff')
  return csv.body
})
