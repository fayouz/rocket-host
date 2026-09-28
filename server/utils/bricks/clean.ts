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
// GET /api/linen/readiness?place=&date= (branche feature/linen de Rocket Clean). null = fonction absente (404) : colonne masquee.
export async function cleanLinen(cfg: BrickConfig, placeId: string, date: string): Promise<LinenLevel | 'unknown' | null> {
  try {
    const r = await brickGet('clean', cfg, `/api/linen/readiness?place=${encodeURIComponent(placeId)}&date=${date}`)
    const v = String(r?.status ?? r?.readiness ?? r?.level ?? '').toLowerCase()
    return v === 'ready' || v === 'tight' || v === 'missing' ? v : 'unknown'
  } catch (e) {
    if (e instanceof BrickError && e.status === 404) return null
    throw e
  }
}
