// Timeline par logement : sejours, validite des codes, messages envoyes et prevus.
import type { AccessCode, MessageRule } from './types'

const DAY = 864e5
const HOUR = 36e5
// Regle Lodgify (verifiee sur les taches existantes) : le menage va du check-out jusqu'au check-in suivant, au plus 2 jours
const CLEAN_MAX_DAYS = 2
// En dessous, le creneau est signale comme trop court (hypothese)
const CLEAN_MIN_HOURS = 3
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const addDays = (day: string, n: number) => iso(Date.parse(day) + n * DAY)

// source Lodgify (AirbnbIntegration, BookingCom, Manual...) -> canal des regles
function channelOf(source: string) {
  return /airbnb/i.test(source) ? 'airbnb' : /booking/i.test(source) ? 'booking' : 'manual'
}

export interface TimelineEvent { at: string; kind: 'stay' | 'code' | 'sent' | 'planned' | 'cleaning' | 'stock'; title: string; description: string; icon: string }

export async function buildTimeline(opts: { pastDays?: number; futureDays?: number } = {}) {
  const db = useDatabase()
  const { properties, bookings, demo } = await loadData()
  const now = Date.now()
  const from = now - (opts.pastDays ?? 3) * DAY
  const to = now + (opts.futureDays ?? 45) * DAY
  const all = bookings.filter(isActiveBooking)
  const active = all.filter(b => b.departure >= iso(from) && b.arrival <= iso(to))

  await planCodes().catch(() => {}) // garantit que les codes a venir sont planifies (base locale uniquement)
  const rules = (await db.sql`SELECT * FROM message_rule`).rows as unknown as MessageRule[]
  const codes = (await db.sql`SELECT * FROM access_code`).rows as unknown as AccessCode[]
  const cleaning = (await db.sql`SELECT * FROM cleaning_task`).rows as unknown as { booking_id: number; assignee: string; status: string }[]
  const sent = await loadSentMessages(active, demo)

  const events: Record<number, TimelineEvent[]> = {}
  const push = (propertyId: number, e: TimelineEvent) => { if (Date.parse(e.at) >= from && Date.parse(e.at) <= to) (events[propertyId] ||= []).push(e) }

  for (const b of active) {
    const guest = b.guest
    push(b.propertyId, { at: parisToIso(b.arrival, b.checkIn || '15:00'), kind: 'stay', icon: 'i-lucide-log-in', title: `Arrivée · ${guest}`, description: b.source })
    push(b.propertyId, { at: parisToIso(b.departure, b.checkOut || '11:00'), kind: 'stay', icon: 'i-lucide-log-out', title: `Départ · ${guest}`, description: b.source })

    // Menage : du check-out jusqu'au check-in suivant du logement (au plus CLEAN_MAX_DAYS jours apres)
    const cleanStart = Date.parse(parisToIso(b.departure, b.checkOut || '11:00'))
    const next = all.filter(o => o.propertyId === b.propertyId && o.id !== b.id && o.arrival >= b.departure)
      .sort((x, y) => x.arrival.localeCompare(y.arrival))[0]
    const nextIn = next ? Date.parse(parisToIso(next.arrival, next.checkIn || '15:00')) : Infinity
    const cleanEnd = Math.min(nextIn, cleanStart + CLEAN_MAX_DAYS * DAY)
    const turnover = !!next && next.arrival === b.departure
    const short = (cleanEnd - cleanStart) / HOUR < CLEAN_MIN_HOURS
    const fmt = (ms: number) => new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const task = cleaning.find(t => Number(t.booking_id) === b.id)
    push(b.propertyId, {
      at: new Date(cleanStart).toISOString(), kind: 'cleaning', icon: short ? 'i-lucide-triangle-alert' : 'i-lucide-sparkles',
      title: turnover ? 'Ménage · turnover' : 'Ménage',
      description: [
        `${fmt(cleanStart)} → ${fmt(cleanEnd)}`,
        turnover ? `arrivée ${next!.guest} le jour même` : null,
        short ? 'créneau très court' : null,
        task ? `${task.assignee} · ${task.status}` : 'assignation inconnue',
      ].filter(Boolean).join(' · '),
    })

    const c = codes.find(r => Number(r.booking_id) === b.id)
    if (c) {
      const state = c.status === 'created' ? 'créé sur Nuki' : c.status === 'error' ? `erreur : ${c.error}` : 'pas encore créé sur Nuki'
      push(b.propertyId, { at: c.valid_from, kind: 'code', icon: 'i-lucide-key-round', title: `Code ${c.code} actif · ${guest}`, description: state })
      push(b.propertyId, { at: c.valid_until, kind: 'code', icon: 'i-lucide-lock', title: `Code ${c.code} expire · ${guest}`, description: state })
    }

    for (const m of sent[b.id] || []) {
      const failed = /fail/i.test(m.status)
      push(b.propertyId, {
        at: m.at, kind: 'sent', icon: failed ? 'i-lucide-triangle-alert' : 'i-lucide-send',
        title: `Message envoyé · ${m.subject || 'sans objet'}`, description: [guest, m.channel, failed ? 'Échec' : m.status === 'Delivered' ? 'Délivré' : m.status].filter(Boolean).join(' · '),
      })
    }

    for (const r of rules.filter(r => r.channels.split(',').includes(channelOf(b.source)))) {
      const day = addDays(r.anchor === 'arrival' ? b.arrival : b.departure, Number(r.offset_days))
      const at = parisToIso(day, r.send_time)
      if (Date.parse(at) > now) push(b.propertyId, { at, kind: 'planned', icon: 'i-lucide-clock', title: `Message prévu · ${r.name}`, description: `${guest} · ${b.source}` })
    }
  }

  // Reassort : articles bas ou vides par logement (saisis via le QR code)
  const lowRows = (await db.sql`SELECT l.property_id, i.name, l.level FROM stock_level l JOIN stock_item i ON i.id = l.item_id WHERE l.level != 'ok' ORDER BY i.id`).rows as any[]
  for (const pid of new Set(lowRows.map(r => Number(r.property_id)))) {
    const mine = lowRows.filter(r => Number(r.property_id) === pid)
    const names = (lvl: string) => mine.filter(r => r.level === lvl).map(r => r.name).join(', ')
    push(pid, {
      at: new Date(now).toISOString(), kind: 'stock', icon: 'i-lucide-package',
      title: 'Réassort à faire',
      description: [names('empty') && `Vide : ${names('empty')}`, names('low') && `Bas : ${names('low')}`].filter(Boolean).join(' · '),
    })
  }

  return {
    demo,
    now: new Date(now).toISOString(),
    properties: properties.map(p => ({ id: p.id, name: p.name, events: (events[p.id] || []).sort((a, b) => a.at.localeCompare(b.at)) })),
  }
}
