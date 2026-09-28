// Tableau de bord intelligent : agregation des briques Rocket (PMS, Place, Clean, Stock, Cast) en une seule reponse.
// Pur (aucun auto-import Nuxt) : la route server/api/dashboard/smart.get.ts lui passe la configuration ; le script
// scripts/check-smart-dashboard.mjs le teste avec un fetch simule.
// Principes : appels en parallele, delai par brique (voir http.ts), chaque brique isolee (une brique en panne = une alerte
// « brique injoignable » et des colonnes vides, jamais une erreur de la page). Lecture seule : aucune ecriture nulle part.
import { BRICK_LABELS, BrickError, brickConfigured, type BrickConfig, type BrickName } from './http.ts'
import { pmsAmountDue, pmsBilanOf, pmsBookingsOf, pmsLinks, type PmsBookingRow, type PmsLink } from './pms.ts'
import { placeAccessGrants, type PlaceGrant } from './place.ts'
import { cleanDay, cleanLinenAlerts, cleanLinenReadiness, cleanRentalCosts, linenFor, type CleanTask, type LinenAlert, type LinenArrival, type LinenLevel } from './clean.ts'
import { stockLow, stockRentalConsumption } from './stock.ts'
import { castScreens, screensFor, type CastScreen } from './cast.ts'

export type BrickConfigs = Partial<Record<BrickName, BrickConfig>>
export interface SmartOptions { now?: Date; timeZone?: string; allowed?: Set<number> | null }

export interface BrickState { name: string; configured: boolean; ok: boolean; error: string | null; ms: number | null }
export type CleaningStatus = 'done' | 'in_progress' | 'late' | 'todo' | 'none'
export type AccessStatus = 'sent' | 'to_send' | 'error' | 'none'
export type AlertLevel = 'critical' | 'warning' | 'info'
export interface SmartAlert { level: AlertLevel; code: string; title: string; detail: string; link: string; brick: BrickName; at: string }

export interface SmartArrival {
  key: string; day: 'today' | 'tomorrow'; date: string; time: string; propertyId: number | null; propertyName: string; color: string
  bookingId: number; guest: string; source: string; nights: number
  cleaning: { status: CleaningStatus; label: string; at: string | null } | null
  linen: LinenLevel | 'unknown' | null
  access: { status: AccessStatus; detail: string } | null
  screen: { status: 'online' | 'offline' | 'none'; name: string; lastSeenAt: string | null } | null
  payment: { due: number; paid: number; total: number } | null
  stockLow: { name: string; level: string }[] | null
}
export interface SmartDeparture { key: string; day: 'today' | 'tomorrow'; date: string; time: string; propertyId: number | null; propertyName: string; guest: string; cleaningPlanned: boolean | null; cleaningStatus: CleaningStatus | null }

const pad = (n: number) => String(n).padStart(2, '0')
// Date locale AAAA-MM-JJ dans le fuseau du logement (Europe/Paris par defaut)
export function localDate(d: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const g = (t: string) => p.find(x => x.type === t)!.value
  return `${g('year')}-${g('month')}-${g('day')}`
}
function localMinutes(d: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  return Number(p.find(x => x.type === 'hour')!.value) * 60 + Number(p.find(x => x.type === 'minute')!.value)
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const hhmm = (v: string | null, def: string) => (v && /^\d{1,2}:\d{2}/.test(v) ? v.slice(0, 5).padStart(5, '0') : def)
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const isCancelled = (s: string) => /cancel|declin|annul/i.test(s)
const isConfirmed = (s: string) => /booked|confirm|accept/i.test(s) || s === ''

// Etat du menage a partir d'une tache Rocket Clean
function cleaningStatus(t: CleanTask | undefined): CleaningStatus {
  if (!t) return 'none'
  if (t.status === 'done') return 'done'
  if (t.late) return 'late'
  if (t.status === 'in_progress') return 'in_progress'
  return 'todo'
}

function accessFrom(b: PmsBookingRow, grants: PlaceGrant[] | null): { status: AccessStatus; detail: string } {
  let g: { status: string; error: string | null; outdated?: boolean } | null = b.access
  if (!g && grants) g = grants.find(x => x.externalRef && x.externalRef.replace(/^booking:/, '') === String(b.id)) || null
  if (!g) return { status: 'none', detail: 'Aucun accès planifié' }
  if (g.error || g.status === 'error') return { status: 'error', detail: g.error || 'Erreur sur la serrure' }
  if (g.outdated) return { status: 'to_send', detail: 'Dates modifiées : code à renvoyer' }
  if (g.status === 'created' || g.status === 'sent' || g.status === 'active') return { status: 'sent', detail: 'Code envoyé à la serrure' }
  if (g.status === 'revoked') return { status: 'none', detail: 'Accès révoqué' }
  return { status: 'to_send', detail: 'Code planifié, pas encore envoyé' }
}

const LEVEL_RANK: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }

export async function collectSmartDashboard(cfgs: BrickConfigs, opts: SmartOptions = {}) {
  const now = opts.now ?? new Date()
  const tz = opts.timeZone || 'Europe/Paris'
  const today = localDate(now, tz)
  const tomorrow = addDays(today, 1)
  const yesterday = addDays(today, -1)
  const nowMin = localMinutes(now, tz)
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const monthEnd = `${month}-${pad(daysInMonth)}`

  // --- Etat des briques : premiere erreur retenue, duree du premier appel
  const bricks = {} as Record<BrickName, BrickState>
  for (const b of Object.keys(BRICK_LABELS) as BrickName[]) bricks[b] = { name: BRICK_LABELS[b], configured: brickConfigured(cfgs[b]), ok: brickConfigured(cfgs[b]), error: null, ms: null }
  const on = (b: BrickName) => bricks[b].configured
  // Execute un appel d'une brique ; en cas d'echec, note l'erreur (sauf 404 « fonction absente », gere par l'appelant) et renvoie fallback
  async function guard<T>(b: BrickName, fn: () => Promise<T>, fallback: T): Promise<T> {
    const t0 = Date.now()
    try {
      const r = await fn()
      if (bricks[b].ms === null) bricks[b].ms = Date.now() - t0
      return r
    } catch (e: any) {
      if (bricks[b].ok) { bricks[b].ok = false; bricks[b].error = e instanceof BrickError ? e.message : `${BRICK_LABELS[b]} : erreur inattendue` }
      return fallback
    }
  }

  const empty = { generatedAt: now.toISOString(), today, tomorrow, month, bricks, enabled: false, columns: { cleaning: false, linen: false, access: false, screen: false, payment: false }, arrivals: [] as SmartArrival[], departures: [] as SmartDeparture[], alerts: [] as SmartAlert[], finances: null as any }
  if (!on('pms')) return empty

  // --- 1. Logements (PMS) : la correspondance logement <-> lieu (placeId) vient de /api/place-links
  const links = await guard('pms', () => pmsLinks(cfgs.pms!), [] as PmsLink[])
  const props = links.filter(p => !opts.allowed || (p.lodgifyPropertyId !== null && opts.allowed.has(p.lodgifyPropertyId)))
  const placeIds = [...new Set(props.map(p => p.placeId).filter(Boolean))] as string[]

  // --- 2. Appels independants en parallele
  // Linge (module linge de Rocket Clean) : un appel par lieu (arrivees d'aujourd'hui et demain) + alertes ; 404 = module absent
  const [bookingsBy, bilans, cleanDays, cleanCosts, stockCons, screens, grantsBy, linenBy, linenAlerts] = await Promise.all([
    Promise.all(props.map(p => guard('pms', () => pmsBookingsOf(cfgs.pms!, p.id), [] as PmsBookingRow[]))),
    Promise.all(props.map(p => guard('pms', () => pmsBilanOf(cfgs.pms!, p.id, y), null))),
    on('clean') ? Promise.all([yesterday, today, tomorrow].map(d => guard('clean', () => cleanDay(cfgs.clean!, d), null as CleanTask[] | null))) : Promise.resolve(null),
    on('clean') ? guard('clean', () => cleanRentalCosts(cfgs.clean!, monthStart, monthEnd), null) : Promise.resolve(null),
    on('stock') ? guard('stock', () => stockRentalConsumption(cfgs.stock!, monthStart, monthEnd), null) : Promise.resolve(null),
    on('cast') ? guard('cast', () => castScreens(cfgs.cast!), null as CastScreen[] | null) : Promise.resolve(null),
    on('place') ? Promise.all(placeIds.map(id => guard('place', () => placeAccessGrants(cfgs.place!, id), null as PlaceGrant[] | null))) : Promise.resolve(null),
    on('clean') ? Promise.all(placeIds.map(id => guard('clean', () => cleanLinenReadiness(cfgs.clean!, id, today, 2), null as LinenArrival[] | null))) : Promise.resolve(null),
    on('clean') ? guard('clean', () => cleanLinenAlerts(cfgs.clean!), null as LinenAlert[] | null) : Promise.resolve(null),
  ])
  // null (404) sur un lieu = module linge absent de cette version de Rocket Clean : colonne masquee
  const linenAvailable = !!linenBy && linenBy.every(l => l !== null)
  const linenOfPlace = new Map<string, LinenArrival[]>(linenAvailable ? placeIds.map((id, i) => [id, linenBy![i]!]) : [])
  const grantsOfPlace = new Map<string, PlaceGrant[] | null>(placeIds.map((id, i) => [id, grantsBy ? grantsBy[i]! : null]))
  const cleanTasks: CleanTask[] | null = cleanDays && cleanDays.some(Boolean) ? cleanDays.flatMap(d => d || []).filter(t => t.status !== 'cancelled') : null

  // --- 3. Arrivees et departs d'aujourd'hui et demain
  const arrivals: SmartArrival[] = []
  const departures: SmartDeparture[] = []
  props.forEach((p, i) => {
    for (const b of bookingsBy[i]!) {
      if (isCancelled(b.status)) continue
      const day = b.arrival === today ? 'today' : b.arrival === tomorrow ? 'tomorrow' : null
      if (day) {
        const time = hhmm(b.checkIn, '16:00')
        let cleaning: SmartArrival['cleaning'] = null
        if (cleanTasks && p.placeId) {
          // menage « avant l'arrivee » : tache du lieu la veille ou le jour de l'arrivee, la plus proche avant l'heure d'arrivee
          const limit = `${b.arrival}T${time}`
          const cands = cleanTasks.filter(t => t.placeId === p.placeId && (t.scheduledAt.slice(0, 10) === b.arrival || t.scheduledAt.slice(0, 10) === addDays(b.arrival, -1)))
            .sort((a, c) => a.scheduledAt.localeCompare(c.scheduledAt))
          const t = [...cands].reverse().find(x => x.scheduledAt.slice(0, 16) <= limit) || cands[0]
          cleaning = { status: cleaningStatus(t), label: t?.label || '', at: t?.scheduledAt || null }
        }
        arrivals.push({
          key: `${p.id}:${b.id}`, day, date: b.arrival, time, propertyId: p.lodgifyPropertyId, propertyName: p.name, color: p.color,
          bookingId: b.id, guest: b.guest, source: b.source, nights: b.nights, cleaning, linen: null,
          access: on('place') || b.access ? accessFrom(b, p.placeId ? grantsOfPlace.get(p.placeId) ?? null : null) : null,
          screen: null, payment: null, stockLow: null,
        })
      }
      const dday = b.departure === today ? 'today' : b.departure === tomorrow ? 'tomorrow' : null
      if (dday) {
        const t = cleanTasks && p.placeId ? cleanTasks.find(x => x.placeId === p.placeId && x.scheduledAt.slice(0, 10) === b.departure) : undefined
        departures.push({
          key: `${p.id}:${b.id}:out`, day: dday, date: b.departure, time: hhmm(b.checkOut, '11:00'), propertyId: p.lodgifyPropertyId, propertyName: p.name, guest: b.guest,
          cleaningPlanned: cleanTasks && p.placeId ? !!t : null, cleaningStatus: t ? cleaningStatus(t) : null,
        })
      }
    }
  })
  arrivals.sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time))
  departures.sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time))

  // --- 4. Enrichissements par arrivee (paiement, linge, stock, ecran) en parallele
  const propOf = new Map(props.map(p => [p.id, p]))
  const linenShort = new Map<string, string[]>()
  await Promise.all(arrivals.map(async (a) => {
    const p = propOf.get(a.key.split(':')[0]!)!
    if (linenAvailable && p.placeId) {
      const l = linenFor(linenOfPlace.get(p.placeId) || [], a.bookingId, a.date)
      a.linen = l ? l.status : 'unknown'
      if (l?.short.length) linenShort.set(a.key, l.short)
    }
    const [pay, low] = await Promise.all([
      pmsAmountDue(cfgs.pms!, p.id, a.bookingId).catch(() => null), // montant facultatif : son absence ne signale pas le PMS en panne
      on('stock') && p.placeId ? guard('stock', () => stockLow(cfgs.stock!, p.placeId!), null) : Promise.resolve(null),
    ])
    const bk = bookingsBy[props.indexOf(p)]!.find(b => b.id === a.bookingId)
    a.payment = pay ? { ...pay, total: bk?.total ?? 0 } : null
    a.stockLow = low
    if (screens) {
      const s = screensFor(screens, { placeId: p.placeId, propertyId: p.id, name: p.name })
      a.screen = s.length ? { status: s.every(x => x.online) ? 'online' : 'offline', name: s.map(x => x.name).join(', '), lastSeenAt: s[0]!.lastSeenAt } : { status: 'none', name: '', lastSeenAt: null }
    }
  }))

  // --- 5. Alertes croisees
  const alerts: SmartAlert[] = []
  const lg = (id: number | null, tab: string) => (id === null ? '/logements' : `/logements/${id}/${tab}`)
  const when = (a: { day: string; time: string }) => `${a.day === 'today' ? "aujourd'hui" : 'demain'} ${a.time.replace(':', 'h')}`
  for (const a of arrivals) {
    const minutesLeft = a.day === 'today' ? toMin(a.time) - nowMin : toMin(a.time) + 1440 - nowMin
    const at = `${a.date}T${a.time}`
    if (a.cleaning && a.cleaning.status !== 'done') {
      if (minutesLeft <= 120) alerts.push({ level: 'critical', code: 'cleaning_not_done', brick: 'clean', at, link: lg(a.propertyId, 'timeline'), title: `Ménage non terminé à ${a.propertyName}`, detail: `${a.guest || 'Voyageur'} arrive ${when(a)} (${minutesLeft > 0 ? `dans ${Math.floor(minutesLeft / 60)}h${pad(minutesLeft % 60)}` : 'arrivée passée'}) ; ménage : ${a.cleaning.status === 'none' ? 'aucun planifié' : a.cleaning.status}` })
      else if (a.cleaning.status === 'none') alerts.push({ level: 'warning', code: 'cleaning_missing', brick: 'clean', at, link: lg(a.propertyId, 'timeline'), title: `Aucun ménage avant l'arrivée à ${a.propertyName}`, detail: `${a.guest || 'Voyageur'} arrive ${when(a)}` })
      else if (a.cleaning.status === 'late') alerts.push({ level: 'warning', code: 'cleaning_late', brick: 'clean', at, link: lg(a.propertyId, 'timeline'), title: `Ménage en retard à ${a.propertyName}`, detail: `Arrivée ${when(a)}` })
    }
    if (a.access && a.access.status !== 'sent') {
      const level: AlertLevel = a.access.status === 'error' || a.day === 'today' ? 'critical' : 'warning'
      alerts.push({ level, code: a.access.status === 'error' ? 'access_error' : 'access_not_sent', brick: on('place') ? 'place' : 'pms', at, link: lg(a.propertyId, 'serrures'), title: `${a.access.status === 'error' ? 'Accès en erreur' : a.access.status === 'none' ? 'Aucun accès planifié' : 'Accès non envoyé'} pour ${a.propertyName}`, detail: `${a.access.detail} ; arrivée ${when(a)}` })
    }
    if (a.screen?.status === 'offline' && a.day === 'today') alerts.push({ level: 'warning', code: 'screen_offline', brick: 'cast', at, link: lg(a.propertyId, 'livret'), title: `Écran hors ligne à ${a.propertyName}`, detail: `${a.screen.name} ; arrivée ${when(a)}` })
    if (a.stockLow?.length) {
      const empty = a.stockLow.filter(s => s.level === 'empty')
      alerts.push({ level: empty.length ? 'warning' : 'info', code: 'stock_low', brick: 'stock', at, link: lg(a.propertyId, 'stock'), title: `Stock ${empty.length ? 'vide' : 'bas'} à ${a.propertyName} avant l'arrivée`, detail: a.stockLow.slice(0, 5).map(s => `${s.name} (${s.level === 'empty' ? 'vide' : 'bas'})`).join(', ') + (a.stockLow.length > 5 ? '…' : '') })
    }
    if (a.linen === 'missing' || a.linen === 'tight') alerts.push({ level: a.linen === 'missing' ? (a.day === 'today' ? 'critical' : 'warning') : 'info', code: 'linen_' + a.linen, brick: 'clean', at, link: lg(a.propertyId, 'timeline'), title: `Linge ${a.linen === 'missing' ? 'manquant' : 'juste'} à ${a.propertyName}`, detail: `Arrivée ${when(a)}${linenShort.has(a.key) ? ` ; kits propres : ${linenShort.get(a.key)!.join(', ')}` : ''}` })
  }
  for (const d of departures) {
    if (d.cleaningPlanned === false) alerts.push({ level: d.day === 'today' ? 'warning' : 'info', code: 'departure_without_cleaning', brick: 'clean', at: `${d.date}T${d.time}`, link: lg(d.propertyId, 'timeline'), title: `Départ sans ménage à ${d.propertyName}`, detail: `${d.guest || 'Voyageur'} part ${when(d)}` })
  }
  // Reservation modifiee apres planification du menage : drapeau « conflict » pose par Rocket Clean
  if (cleanTasks) {
    const byPlace = new Map(props.filter(p => p.placeId).map(p => [p.placeId!, p]))
    for (const t of cleanTasks) {
      const p = byPlace.get(t.placeId)
      if (t.conflict && p) alerts.push({ level: 'warning', code: 'booking_changed', brick: 'clean', at: t.scheduledAt.slice(0, 16), link: lg(p.lodgifyPropertyId, 'timeline'), title: `Réservation modifiée après planification du ménage (${p.name})`, detail: `${t.label} du ${t.scheduledAt.slice(0, 10)} : vérifier la date` })
    }
  }
  // Alertes du module linge de Rocket Clean (lots en retard, pertes du mois, kits des 7 prochains jours) sur les logements
  // visibles ; les kits d'une arrivee d'aujourd'hui/demain sont deja signales ci-dessus (linen_missing / linen_tight).
  if (linenAlerts) {
    const byPlace = new Map(props.filter(p => p.placeId).map(p => [p.placeId!.toLowerCase(), p]))
    const shown = new Set(arrivals.filter(a => a.linen === 'missing' || a.linen === 'tight').map(a => `${propOf.get(a.key.split(':')[0]!)!.placeId?.toLowerCase()}|${a.date}`))
    for (const la of linenAlerts) {
      const p = byPlace.get(la.placeId)
      if (!p || (la.type === 'kits' && la.at && shown.has(`${la.placeId}|${la.at.slice(0, 10)}`))) continue
      const title = la.type === 'batch_overdue' ? `Linge en retard chez la blanchisserie (${p.name})` : la.type === 'losses' ? `Linge perdu ou abîmé à ${p.name}` : `Linge à surveiller à ${p.name}`
      alerts.push({ level: la.level === 'error' ? 'warning' : 'info', code: `linen_${la.type || 'alert'}`, brick: 'clean', at: la.at ? la.at.slice(0, 16) : '', link: lg(p.lodgifyPropertyId, 'timeline'), title, detail: la.message })
    }
  }
  for (const b of Object.keys(bricks) as BrickName[]) {
    if (bricks[b].configured && !bricks[b].ok) alerts.push({ level: b === 'pms' ? 'critical' : 'warning', code: 'brick_unreachable', brick: b, at: '', link: '/settings/plugins', title: `${bricks[b].name} injoignable`, detail: bricks[b].error || '' })
  }
  alerts.sort((a, c) => LEVEL_RANK[a.level] - LEVEL_RANK[c.level] || (a.at || '9').localeCompare(c.at || '9'))

  // --- 6. Finances en contexte (mois en cours) et prevision 30 jours
  const inMonthNights = (b: PmsBookingRow) => {
    const s = b.arrival > monthStart ? b.arrival : monthStart
    const e = b.departure < addDays(monthEnd, 1) ? b.departure : addDays(monthEnd, 1)
    return Math.max(0, Math.round((Date.parse(e) - Date.parse(s)) / 86400000))
  }
  const channels = new Map<string, { source: string; revenue: number; nights: number; count: number }>()
  const properties = props.map((p, i) => {
    const bks = bookingsBy[i]!.filter(b => !isCancelled(b.status))
    let revenue = 0, nights = 0
    for (const b of bks) {
      const n = inMonthNights(b)
      if (!n) continue
      const part = b.nights ? (b.total * n) / b.nights : 0
      revenue += part; nights += n
      const c = channels.get(b.source || 'Direct') || { source: b.source || 'Direct', revenue: 0, nights: 0, count: 0 }
      c.revenue += part; c.nights += n; c.count++
      channels.set(c.source, c)
    }
    const bm = bilans[i]?.months?.[m - 1]
    if (bm) { revenue = bm.revenue || revenue; nights = bm.nights || nights }
    const cleaningCost = cleanCosts && p.placeId ? cleanCosts.byPlace[p.placeId] || 0 : null
    return { propertyId: p.lodgifyPropertyId, name: p.name, color: p.color, revenue: Math.round(revenue * 100) / 100, nights, occupancy: Math.round((nights / daysInMonth) * 100), cleaningCost, source: bm ? 'bilan' : 'bookings' }
  })
  const horizon = addDays(today, 30)
  const upcoming = bookingsBy.flat().filter(b => !isCancelled(b.status) && isConfirmed(b.status) && b.arrival >= today && b.arrival < horizon)
  const revenueTotal = properties.reduce((s, p) => s + p.revenue, 0)
  const finances = {
    month, currency: bilans.find(Boolean)?.currency || 'EUR', daysInMonth,
    properties, revenue: Math.round(revenueTotal * 100) / 100,
    occupancy: properties.length ? Math.round(properties.reduce((s, p) => s + p.occupancy, 0) / properties.length) : 0,
    channels: [...channels.values()].map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 })).sort((a, c) => c.revenue - a.revenue),
    cleaningCost: cleanCosts ? cleanCosts.total : null,
    cleaningShare: cleanCosts && revenueTotal ? Math.round((cleanCosts.total / revenueTotal) * 1000) / 10 : null,
    stockConsumption: stockCons ? stockCons.totalCost : null,
    forecast: { from: today, to: horizon, bookings: upcoming.length, revenue: Math.round(upcoming.reduce((s, b) => s + b.total, 0) * 100) / 100, nights: upcoming.reduce((s, b) => s + b.nights, 0) },
  }

  return {
    ...empty, enabled: true, arrivals, departures, alerts, finances,
    columns: {
      cleaning: !!cleanTasks, linen: linenAvailable && arrivals.some(a => a.linen !== null), access: arrivals.some(a => a.access !== null),
      screen: !!screens, payment: arrivals.some(a => a.payment !== null),
    },
  }
}
