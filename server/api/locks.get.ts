export default defineEventHandler(async () => {
  const [{ locks, demo }, { properties }] = await Promise.all([loadLocks(), loadData()])
  const name = (id: number | null) => properties.find(p => p.id === id)?.name ?? null
  return { demo, locks: locks.map(l => ({ ...l, property: name(l.propertyId) })) }
})
