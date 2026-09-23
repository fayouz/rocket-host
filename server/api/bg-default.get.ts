// Fond par defaut des reglages generaux (public : les pages voyageur en heritent sans etre connectees).
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  const bg = await readDefaultBackgroundFile()
  if (!bg) throw createError({ statusCode: 404, statusMessage: 'Pas de fond par défaut configuré' })
  let size: number
  try { size = (await stat(bg.path)).size } catch { throw createError({ statusCode: 404, statusMessage: 'Image introuvable' }) }
  setHeader(event, 'content-type', bg.mime)
  setHeader(event, 'content-length', size)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return sendStream(event, createReadStream(bg.path))
})
