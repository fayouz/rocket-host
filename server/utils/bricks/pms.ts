// Client direct Rocket PMS pour le tableau de bord intelligent (lecture seule). Le client historique server/utils/pms.ts
// reste utilise par le reste de l'appli ; celui-ci est pur (config en parametre) pour etre testable sans Nuxt.
import { asList, brickGet, type BrickConfig } from './http.ts'

export interface PmsLink { id: string; name: string; color: string; lodgifyPropertyId: number | null; placeId: string | null }

// GET /api/place-links : logements PMS + placeId (lieu Rocket Place, partage par Clean/Stock/Cast). Repli : /api/properties.
export async function pmsLinks(cfg: BrickConfig): Promise<PmsLink[]> {
  let rows: any[]
  try { rows = asList((await brickGet('pms', cfg, '/api/place-links'))?.properties) }
  catch { rows = asList(await brickGet('pms', cfg, '/api/properties')) }
  return rows.map(p => ({
    id: String(p.id), name: String(p.name || ''), color: String(p.color || ''),
    lodgifyPropertyId: typeof p.lodgifyPropertyId === 'number' ? p.lodgifyPropertyId : null,
    placeId: typeof p.placeId === 'string' && p.placeId ? p.placeId : null,
  }))
}

export interface PmsBookingRow {
  id: number; propertyId: number; guest: string; arrival: string; departure: string; checkIn: string | null; checkOut: string | null
  nights: number; status: string; source: string; total: number
  access: { grantId: string; status: string; error: string | null; outdated: boolean } | null
}

export async function pmsBookingsOf(cfg: BrickConfig, uuid: string): Promise<PmsBookingRow[]> {
  const r = await brickGet('pms', cfg, `/api/properties/${encodeURIComponent(uuid)}/bookings`)
  return asList(r?.items ?? r).map((b: any): PmsBookingRow => ({
    id: Number(b.id), propertyId: Number(b.propertyId), guest: String(b.guest || ''), arrival: String(b.arrival || ''), departure: String(b.departure || ''),
    checkIn: typeof b.checkIn === 'string' ? b.checkIn : null, checkOut: typeof b.checkOut === 'string' ? b.checkOut : null,
    nights: Number(b.nights ?? 0) || 0, status: String(b.status || ''), source: String(b.source || ''), total: Number(b.total ?? 0) || 0,
    access: b.access ? { grantId: String(b.access.grantId || ''), status: String(b.access.status || ''), error: b.access.error ? String(b.access.error) : null, outdated: !!b.access.outdated } : null,
  }))
}

// Montant restant du d'une reservation (devis Lodgify via le PMS) : null si inconnu
export async function pmsAmountDue(cfg: BrickConfig, uuid: string, bookingId: number): Promise<{ paid: number; due: number } | null> {
  const r = await brickGet('pms', cfg, `/api/properties/${encodeURIComponent(uuid)}/bookings/${bookingId}/pricing`)
  if (r?.due === undefined) return null
  return { paid: Number(r.paid ?? 0) || 0, due: Number(r.due ?? 0) || 0 }
}

export async function pmsBilanOf(cfg: BrickConfig, uuid: string, year: number) {
  const r = await brickGet('pms', cfg, `/api/properties/${encodeURIComponent(uuid)}/bilan?year=${year}`)
  const n = (v: unknown) => Number(v ?? 0) || 0
  return { currency: String(r?.currency || 'EUR'), months: asList(r?.months).map((m: any) => ({ revenue: n(m.revenue), nights: n(m.nights), charges: n(m.charges) })) }
}
