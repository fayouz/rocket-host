export default defineEventHandler(async (event) => {
  const lg = await getLogement(getRouterParam(event, 'id'))
  const { locks, demo } = await loadLocks()
  return { demo, logement: lg, locks: locks.filter(l => l.propertyId === lg.lodgifyPropertyId) }
})
