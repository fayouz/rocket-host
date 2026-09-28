// Client minimal pour l'API publique Lodgify (v2) + calculs du tableau de bord.
import type { Booking, Property } from './types'
import { pmsEnabled, pmsLoadData } from './pms'

const BASE = 'https://api.lodgify.com/v2'

async function call(path: string, key: string): Promise<any> {
  const res = await fetch(BASE + path, { headers: { 'X-ApiKey': key, accept: 'application/json' } })
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `Lodgify ${res.status} sur ${path}` })
  return res.json()
}

export const lodgifyCall = call

async function fetchProperties(key: string): Promise<Property[]> {
  const r = await call('/properties', key)
  const list = Array.isArray(r) ? r : r.items || []
  return list.map((p: any) => ({
    id: p.id,
    name: p.name,
    internalName: (typeof p.internal_name === 'string' && p.internal_name.trim()) || undefined,
    latitude: typeof p.latitude === 'number' ? p.latitude : undefined,
    longitude: typeof p.longitude === 'number' ? p.longitude : undefined,
  }))
}

// "15:00:00" -> "15:00" (undefined si absent)
const hm = (t: unknown) => (typeof t === 'string' && /^\d\d:\d\d/.test(t) ? t.slice(0, 5) : undefined)

// stayFilter=All : sans lui, l'API ne renvoie que les sejours en cours et a venir (les sejours passes manquent)
async function fetchBookings(key: string): Promise<Booking[]> {
  const out: any[] = []
  for (let page = 1; page <= 20; page++) {
    const r = await call(`/reservations/bookings?page=${page}&size=50&includeCount=true&trash=false&stayFilter=All`, key)
    const items = r.items || []
    out.push(...items)
    if (items.length < 50) break
  }
  // Champs lus de facon tolerante : a ajuster apres un premier test avec le vrai jeton
  return out.map((b): Booking => ({
    id: b.id,
    propertyId: b.property_id ?? b.rooms?.[0]?.property_id,
    arrival: String(b.arrival || '').slice(0, 10),
    departure: String(b.departure || '').slice(0, 10),
    guest: b.guest?.name || b.guest_name || 'Invité',
    status: b.status || '',
    source: b.source || b.source_text || '',
    total: Number(b.total_amount ?? b.total_gross_amount ?? b.total ?? 0) || 0,
    threadUid: b.thread_uid || undefined,
    guestEmail: (typeof b.guest?.email === 'string' && b.guest.email.trim().toLowerCase()) || undefined,
    checkIn: hm(b.check_in?.time),
    checkOut: hm(b.check_out?.time),
  }))
}

let cache: { at: number; data: { properties: Property[]; bookings: Booking[] } | null } = { at: 0, data: null }

// Horodatage de la derniere synchronisation Lodgify (cache de loadData ci-dessous, 5 min), pour l'afficher a l'hote
// sur le tableau de bord plutot que de fabriquer une valeur.
export function lastSyncAt(): string | null { return cache.at ? new Date(cache.at).toISOString() : null }

export async function loadData() {
  const cfg = useRuntimeConfig()
  const usePms = pmsEnabled() // PMS_API_URL renseigne : logements + reservations viennent de Rocket PMS plutot que de Lodgify en direct
  const apiKey = getSecret('LODGIFY_API_KEY')
  const demo = !usePms && (cfg.demo === '1' || !apiKey)
  if (!cache.data || Date.now() - cache.at > 5 * 60 * 1000) {
    cache = {
      at: Date.now(),
      data: usePms
        ? await pmsLoadData()
        : demo
          ? { properties: demoProperties, bookings: demoBookings }
          : { properties: await fetchProperties(apiKey), bookings: await fetchBookings(apiKey) },
    }
  }
  const aliases = await getAliases()
  const properties = cache.data!.properties.map(p => ({ ...p, name: aliases[p.id] || p.name, original: p.name }))
  return { ...cache.data!, properties, demo }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 864e5))
const valid = (b: Booking) => !/declined|cancel|open/i.test(b.status)
export const isActiveBooking = valid

export function buildToday({ properties, bookings, demo }: Awaited<ReturnType<typeof loadData>>) {
  const t = iso(new Date())
  const name = (id: number) => properties.find(p => p.id === id)?.name || `Logement ${id}`
  const withName = (b: Booking) => ({ ...b, property: name(b.propertyId) })
  const ok = bookings.filter(valid)
  const arrivals = ok.filter(b => b.arrival === t).map(withName)
  const departures = ok.filter(b => b.departure === t).map(withName)
  const turnovers = properties
    .map(p => ({ property: p.name, out: departures.find(b => b.propertyId === p.id), in: arrivals.find(b => b.propertyId === p.id) }))
    .filter(x => x.out && x.in)
  const upcoming = ok.filter(b => b.arrival > t).sort((a, b) => a.arrival.localeCompare(b.arrival)).slice(0, 8).map(withName)
  const in7 = iso(new Date(Date.now() + 7 * 864e5))
  const arrivalsNext7 = ok.filter(b => b.arrival > t && b.arrival <= in7).length
  return { date: t, demo, arrivals, departures, turnovers, upcoming, arrivalsNext7 }
}

export function buildProfit({ properties, bookings, demo }: Awaited<ReturnType<typeof loadData>>) {
  const months: Record<string, Record<number, { revenue: number; nights: number }>> = {}
  for (const b of bookings.filter(valid)) {
    const n = nightsBetween(b.arrival, b.departure)
    if (!n) continue
    const perNight = b.total / n
    for (let i = 0; i < n; i++) {
      const day = new Date(b.arrival); day.setDate(day.getDate() + i)
      const m = iso(day).slice(0, 7)
      const cell = ((months[m] ||= {})[b.propertyId] ||= { revenue: 0, nights: 0 })
      cell.revenue += perNight; cell.nights += 1
    }
  }
  const list = Object.keys(months).sort().slice(-12).map((m) => {
    const [y, mo] = m.split('-').map(Number)
    const days = new Date(y!, mo!, 0).getDate()
    return {
      month: m,
      byProperty: properties.map((p) => {
        const c = months[m]![p.id] || { revenue: 0, nights: 0 }
        return { property: p.name, revenue: Math.round(c.revenue), nights: c.nights, occupancy: Math.round(100 * c.nights / days) }
      }),
    }
  })
  return { demo, months: list }
}
