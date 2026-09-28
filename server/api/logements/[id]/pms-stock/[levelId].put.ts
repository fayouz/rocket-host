// Rocket PMS actif : niveau (ok / bas / vide) d'un article suivi par le lieu du logement, { level }
export default defineEventHandler(async (event) => {
  if (!pmsEnabled()) throw createError({ statusCode: 404, statusMessage: 'Rocket PMS non configuré' })
  const lg = await getLogement(getRouterParam(event, 'id'))
  await assertLogement(event, lg.id) // gestionnaire / menage : seulement leurs logements
  const body = await readBody(event)
  await pmsSetStockLevel(lg.lodgifyPropertyId, String(getRouterParam(event, 'levelId')), String(body?.level || ''))
  return { ok: true }
})
