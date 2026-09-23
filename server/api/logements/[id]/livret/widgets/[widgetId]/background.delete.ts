import { WIDGET_IDS } from '../../../../../../utils/guestbook'
// Retire le fond propre a ce widget : il revient a herite du fond du logement.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const widgetId = getRouterParam(event, 'widgetId') || ''
  if (!(WIDGET_IDS as readonly string[]).includes(widgetId)) throw createError({ statusCode: 400, statusMessage: 'Widget inconnu' })
  await removeWidgetBackground(lg.id, widgetId)
  return { ok: true }
})
