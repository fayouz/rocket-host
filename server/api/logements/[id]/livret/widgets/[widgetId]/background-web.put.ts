import { WIDGET_IDS } from '../../../../../../utils/guestbook'
// Choisit une image web (Openverse, domaine public) comme fond propre a ce widget.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const widgetId = getRouterParam(event, 'widgetId') || ''
  if (!(WIDGET_IDS as readonly string[]).includes(widgetId)) throw createError({ statusCode: 400, statusMessage: 'Widget inconnu' })
  const b = (await readBody(event)) ?? {}
  const url = String(b.url || '')
  if (!/^https:\/\//.test(url)) throw createError({ statusCode: 400, statusMessage: 'URL invalide' })
  await saveWidgetBackgroundWeb(lg.id, widgetId, url, String(b.attribution || ''))
  return { ok: true }
})
