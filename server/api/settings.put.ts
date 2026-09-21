// Corps : { lockId, propertyId } (serrure -> id Lodgify du logement, ou null). Les noms se changent via PUT /api/logements/:id
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  if (Number.isInteger(b?.lockId) && (b.propertyId === null || Number.isInteger(b.propertyId))) await setLockLink(b.lockId, b.propertyId)
  else throw createError({ statusCode: 400, statusMessage: 'Corps invalide' })
  return { ok: true }
})
