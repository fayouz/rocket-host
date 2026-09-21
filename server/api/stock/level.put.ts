// Cote admin (ex. "Réapprovisionné") : { propertyId, itemId, level }
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  if (!Number.isInteger(b?.propertyId) || !Number.isInteger(b?.itemId) || !isLevel(b?.level)) throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  const lg = await logementOfProperty(b.propertyId)
  if (lg === undefined) throw createError({ statusCode: 404, statusMessage: 'Logement inconnu' })
  await assertLogement(event, lg) // gestionnaire / menage : seulement leurs logements
  await setLevel(b.propertyId, b.itemId, b.level)
  return { ok: true }
})
