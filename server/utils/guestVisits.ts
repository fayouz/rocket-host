// Visites du livret/ecran TV (V3) : une ligne par ouverture de page, pour un tableau de bord hote simple.
// Aucune donnee personnelle : ni IP, ni identifiant de visiteur, juste logement + page + horodatage.
export async function logGuestVisit(logementId: number, page: 'g' | 'tv') {
  try { await useDatabase().sql`INSERT INTO guest_visit (logement_id, page, at) VALUES (${logementId}, ${page}, ${new Date().toISOString()})` }
  catch { /* jamais bloquant pour la page voyageur */ }
}

export interface VisitStats {
  totalByLogement: { logementId: number; g: number; tv: number }[]
  dailyLast14: { day: string; g: number; tv: number }[]
}

export async function getVisitStats(): Promise<VisitStats> {
  const db = useDatabase()
  const totals = ((await db.sql`SELECT logement_id, page, COUNT(*) AS n FROM guest_visit GROUP BY logement_id, page`).rows as any[])
  const byLogement = new Map<number, { logementId: number; g: number; tv: number }>()
  for (const r of totals) {
    const id = Number(r.logement_id)
    const row = byLogement.get(id) ?? { logementId: id, g: 0, tv: 0 }
    if (r.page === 'g') row.g = Number(r.n); else if (r.page === 'tv') row.tv = Number(r.n)
    byLogement.set(id, row)
  }
  const since = new Date(Date.now() - 14 * 86400_000).toISOString()
  const daily = ((await db.sql`SELECT substr(at, 1, 10) AS day, page, COUNT(*) AS n FROM guest_visit WHERE at >= ${since} GROUP BY day, page ORDER BY day`).rows as any[])
  const byDay = new Map<string, { day: string; g: number; tv: number }>()
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10)
    byDay.set(day, { day, g: 0, tv: 0 })
  }
  for (const r of daily) {
    const row = byDay.get(String(r.day))
    if (!row) continue
    if (r.page === 'g') row.g = Number(r.n); else if (r.page === 'tv') row.tv = Number(r.n)
  }
  return { totalByLogement: [...byLogement.values()], dailyLast14: [...byDay.values()] }
}
