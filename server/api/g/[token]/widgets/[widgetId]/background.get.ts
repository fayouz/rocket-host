// Image de fond propre a un widget (carrousel), lien secret (meme jeton que le livret/ecran TV).
// Pas de fond propre a ce widget -> 404 (le client retombe alors sur le fond du logement).
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { WIDGET_IDS } from '../../../../../utils/guestbook'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!isGuestToken(token)) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  const widgetId = getRouterParam(event, 'widgetId') || ''
  if (!(WIDGET_IDS as readonly string[]).includes(widgetId)) throw createError({ statusCode: 404, statusMessage: 'Widget inconnu' })
  const logementId = await logementByGuestToken(token)
  const bg = await readWidgetBackgroundFile(logementId, widgetId)
  if (!bg) throw createError({ statusCode: 404, statusMessage: 'Pas de fond configuré' })
  let size: number
  try { size = (await stat(bg.path)).size } catch { throw createError({ statusCode: 404, statusMessage: 'Image introuvable' }) }
  setHeader(event, 'content-type', bg.mime)
  setHeader(event, 'content-length', size)
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return sendStream(event, createReadStream(bg.path))
})
