// Client direct Rocket Clean (ROCKET_CLEAN_URL / ROCKET_CLEAN_TOKEN), lecture seule : menages du jour, couts, linge.
import { asList, brickGet, BrickError, type BrickConfig } from './http.ts'

export interface CleanTask { id: string; placeId: string; label: string; type: string; scheduledAt: string; dueAt: string | null; status: string; late: boolean; conflict: boolean; externalRef: string | null; cost: number | null }

const task = (t: any): CleanTask => ({
  id: String(t.id), placeId: String(t.placeId || ''), label: String(t.label || 'Ménage'), type: String(t.type || ''),
  scheduledAt: String(t.scheduledAt || ''), dueAt: t.dueAt ? String(t.dueAt) : null, status: String(t.status || ''),
  late: !!t.late, conflict: !!t.conflict, externalRef: t.externalRef ? String(t.externalRef) : null, cost: typeof t.cost === 'number' ? t.cost : null,
})

// GET /api/cleanings?date=AAAA-MM-JJ (tous les lieux)
export async function cleanDay(cfg: BrickConfig, date: string): Promise<CleanTask[]> {
  return asList(await brickGet('clean', cfg, `/api/cleanings?date=${date}`)).map(task)
}

// GET /api/cleanings/export?type=rental&from=&to= : couts en centimes
export async function cleanRentalCosts(cfg: BrickConfig, from: string, to: string): Promise<{ total: number; byPlace: Record<string, number> }> {
  const r = await brickGet('clean', cfg, `/api/cleanings/export?type=rental&from=${from}&to=${to}`)
  const byPlace: Record<string, number> = {}
  for (const it of asList(r)) byPlace[String(it.placeId)] = (byPlace[String(it.placeId)] || 0) + (Number(it.cost) || 0)
  const cents = r?.unit === 'cents'
  const k = cents ? 100 : 1
  for (const p in byPlace) byPlace[p] = byPlace[p]! / k
  return { total: (Number(r?.total) || 0) / k, byPlace }
}

export type LinenLevel = 'ready' | 'tight' | 'missing'
export interface LinenArrival { from: string; until: string; externalRef: string | null; status: LinenLevel | 'unknown'; short: string[] }

const linenLevel = (v: unknown): LinenLevel | 'unknown' => {
  const s = String(v ?? '').toLowerCase()
  return s === 'ready' || s === 'tight' || s === 'missing' ? s : 'unknown'
}

// GET /api/linen/readiness?place=&date=&days= (Rocket Clean, module linge) :
// [{placeId, placeName, arrivals: [{from, until, externalRef, status: ready|tight|missing, kits: [{kitName, needed, available, status}]}]}].
// null = fonction absente (404) : colonne masquee.
export async function cleanLinenReadiness(cfg: BrickConfig, placeId: string, date: string, days: number): Promise<LinenArrival[] | null> {
  try {
    const r = await brickGet('clean', cfg, `/api/linen/readiness?place=${encodeURIComponent(placeId)}&date=${date}&days=${days}`)
    const row = asList(r).find((x: any) => String(x?.placeId || '').toLowerCase() === placeId.toLowerCase())
    return asList(row?.arrivals).map((a: any) => ({
      from: String(a.from || ''), until: String(a.until || ''), externalRef: a.externalRef ? String(a.externalRef) : null, status: linenLevel(a.status),
      short: asList(a.kits).filter((k: any) => linenLevel(k.status) !== 'ready').map((k: any) => `${k.kitName} ${Number(k.available) || 0}/${Number(k.needed) || 0}`),
    }))
  } catch (e) {
    if (e instanceof BrickError && e.status === 404) return null
    throw e
  }
}

// Etat du linge d'une arrivee : par la reference de la reservation (« booking:<id> » ou se terminant par l'id), sinon
// par le jour d'arrivee. 'unknown' : Rocket Clean ne connait pas cette arrivee.
export function linenFor(arrivals: LinenArrival[], bookingId: number, date: string): LinenArrival | null {
  const ref = (a: LinenArrival) => a.externalRef !== null && (a.externalRef === String(bookingId) || new RegExp(`[:/#-]${bookingId}$`).test(a.externalRef))
  return arrivals.find(ref) || arrivals.find(a => a.externalRef === null && a.from.slice(0, 10) === date) || arrivals.find(a => a.from.slice(0, 10) === date) || null
}

export interface LinenAlert { type: string; level: 'error' | 'warning'; placeId: string; placeName: string; message: string; at: string | null }
// GET /api/linen/alerts : kits justes/manquants des 7 prochains jours, lots de blanchisserie en retard, pertes du mois.
// null = fonction absente (404).
export async function cleanLinenAlerts(cfg: BrickConfig): Promise<LinenAlert[] | null> {
  try {
    return asList(await brickGet('clean', cfg, '/api/linen/alerts')).map((a: any) => ({
      type: String(a.type || ''), level: a.level === 'error' ? 'error' : 'warning', placeId: String(a.placeId || '').toLowerCase(), placeName: String(a.placeName || ''),
      message: String(a.message || ''), at: a.at ? String(a.at) : null,
    }))
  } catch (e) {
    if (e instanceof BrickError && e.status === 404) return null
    throw e
  }
}
