// Image de fond propre a une page (carrousel/section), lien secret (meme jeton que le livret/ecran TV).
// Pas de fond propre a cette page -> 404 (le client retombe alors sur le fond du logement).
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const pageId = Number(getRouterParam(event, 'pageId'))
  const logementId = await logementByGuestToken(token)
  await getPageForLogement(pageId, logementId)
  const bg = await readPageBackgroundFile(pageId)
  if (!bg) throw createError({ statusCode: 404, statusMessage: 'Pas de fond configuré' })
  let size: number
  try { size = (await stat(bg.path)).size } catch { throw createError({ statusCode: 404, statusMessage: 'Image introuvable' }) }
  setHeader(event, 'content-type', bg.mime)
  setHeader(event, 'content-length', size)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return sendStream(event, createReadStream(bg.path))
})
