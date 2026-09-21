// Regenere le lien secret (QR code) d'un logement : l'ancien lien cesse de fonctionner
import { randomBytes } from 'node:crypto'
export default defineEventHandler(async (event) => {
  const b = await readBody(event)
  if (!Number.isInteger(b?.propertyId)) throw createError({ statusCode: 400, statusMessage: 'Logement invalide' })
  await useDatabase().sql`UPDATE property_token SET token = ${randomBytes(16).toString('hex')} WHERE property_id = ${b.propertyId}`
  return { ok: true }
})
