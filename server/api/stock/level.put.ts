// Cote admin (ex. "Réapprovisionné") : { propertyId, itemId, level }
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  if (!Number.isInteger(b?.propertyId) || !Number.isInteger(b?.itemId) || !isLevel(b?.level)) throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  await setLevel(b.propertyId, b.itemId, b.level)
  return { ok: true }
})
