// Serrures : filtre optionnel ?properties=1,2 (selecteur du tableau de bord)
export default defineEventHandler(async (event) => {
  const [{ locks, demo }, { properties }] = await Promise.all([loadLocks(), loadData()])
  const ids = await effectivePropertyIds(event)
  const name = (id: number | null) => properties.find(p => p.id === id)?.name ?? null
  const scoped = ids ? locks.filter(l => l.propertyId !== null && ids.has(l.propertyId)) : locks
  return { demo, locks: scoped.map(l => ({ ...l, property: name(l.propertyId) })) }
})
