// Contenu du livret d'accueil du logement, pour l'edition cote hote.
export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const content = await getGuestbook(lg.id)
  const token = ((await useDatabase().sql`SELECT token FROM guestbook_token WHERE logement_id = ${lg.id}`).rows as any[])[0]?.token
  const background = await getBackgroundRow(lg.id)
  const defaultBackground = await getDefaultBackground()
  const widgetOrder = await getWidgetOrder(lg.id)
  const layout = await getLayoutSettings(lg.id)
  const widgetBgRows = await getWidgetBackgrounds(lg.id)
  const widgetBackgrounds = Object.fromEntries(Object.entries(widgetBgRows).map(([id, r]) => [id, { hasFile: !!r.ext, webUrl: r.webUrl, attribution: r.attribution }]))
  return { logement: { id: lg.id, name: lg.name }, content, token, background: { ...background, hasFile: !!background.ext }, hasDefaultBackground: !!defaultBackground, widgetOrder, layout, widgetBackgrounds }
})
