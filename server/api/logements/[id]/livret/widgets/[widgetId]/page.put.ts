import { WIDGET_IDS } from '../../../../../../utils/guestbook'

// Assigne un widget a une page (l'enleve de toute autre page du logement), ou le desassigne (pageId null : le widget
// n'est alors affiche nulle part, comme desactive avant).
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const widgetId = getRouterParam(event, 'widgetId') || ''
  if (!(WIDGET_IDS as readonly string[]).includes(widgetId)) throw createError({ statusCode: 400, statusMessage: 'Widget inconnu' })
  const b = (await readBody(event)) ?? {}
  const pageId = b.pageId === null || b.pageId === undefined ? null : Number(b.pageId)
  if (pageId !== null) await getPageForLogement(pageId, lg.id)
  await assignWidgetToPage(lg.id, widgetId as any, pageId)
  return { ok: true }
})
