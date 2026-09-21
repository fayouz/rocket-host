export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const t = await buildTimeline()
  return { demo: t.demo, now: t.now, logement: lg, events: t.properties.find(p => p.id === lg.lodgifyPropertyId)?.events ?? [] }
})
