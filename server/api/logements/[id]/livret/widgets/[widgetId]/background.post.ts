import { WIDGET_IDS } from '../../../../../../utils/guestbook'
// Depot de l'image de fond propre a un widget (carrousel), multipart/form-data : file
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const widgetId = getRouterParam(event, 'widgetId') || ''
  if (!(WIDGET_IDS as readonly string[]).includes(widgetId)) throw createError({ statusCode: 400, statusMessage: 'Widget inconnu' })
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'Image requise' })
  await saveWidgetBackground(lg.id, widgetId, file.filename, file.data)
  return { ok: true }
})
