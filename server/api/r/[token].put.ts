// Enregistre un niveau depuis la page menage : { itemId, level }. Ne permet rien d'autre.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const b = await readBody(event)
  if (!Number.isInteger(b?.itemId) || !isLevel(b?.level)) throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  const { propertyId } = await propertyByToken(token)
  await setLevel(propertyId, b.itemId, b.level)
  return { ok: true }
})
