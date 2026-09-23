// Tableau de bord hote : nombre d'ouvertures du livret par logement (voir server/utils/guestVisits.ts pour la portee).
export default defineEventHandler(async () => {
  const [stats, logements] = await Promise.all([getVisitStats(), ensureLogements()])
  const names = new Map(logements.map(l => [l.id, l.name]))
  return {
    totalByLogement: stats.totalByLogement.map(r => ({ ...r, name: names.get(r.logementId) ?? `Logement ${r.logementId}` })),
    dailyLast14: stats.dailyLast14,
  }
})
