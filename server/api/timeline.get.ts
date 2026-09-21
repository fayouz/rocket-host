// Timeline de tous les logements. ?past=<jours> (defaut 3) et ?future=<jours> (defaut 45)
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const days = (v: unknown, def: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : def }
  return buildTimeline({ pastDays: days(q.past, 3, 30), futureDays: days(q.future, 45, 120) })
})
