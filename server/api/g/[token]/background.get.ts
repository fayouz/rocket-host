// Image de fond du livret/ecran TV (lien secret, meme jeton). Pas de fond -> 404.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const logementId = await logementByGuestToken(token)
  const bg = await readBackground(logementId)
  if (!bg) throw createError({ statusCode: 404, statusMessage: 'Pas de fond configuré' })
  let size: number
  try { size = (await stat(bg.path)).size } catch { throw createError({ statusCode: 404, statusMessage: 'Image introuvable' }) }
  setHeader(event, 'content-type', bg.mime)
  setHeader(event, 'content-length', size)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return sendStream(event, createReadStream(bg.path))
})
