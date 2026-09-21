export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const { demo, items } = await planCodes()
  return { demo, logement: lg, items: items.filter(i => i.propertyId === lg.lodgifyPropertyId) }
})
