export default defineEventHandler(async () => {
  // Nuki injoignable : la page Reglages reste utilisable (sans la liste des serrures)
  const [logements, { locks, demo }] = await Promise.all([ensureLogements(), loadLocks().catch(() => ({ locks: [] as Awaited<ReturnType<typeof loadLocks>>['locks'], demo: false }))])
  return {
    demo,
    logements,
    locks: locks.map(l => ({ id: l.id, name: l.name, propertyId: l.propertyId })),
  }
})
