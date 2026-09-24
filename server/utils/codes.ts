// Codes clavier par reservation : planification (base locale) puis envoi explicite vers Nuki.
import { randomInt } from 'node:crypto'
import type { AccessCode } from './types'

// Horaires de repli si Lodgify n'en renvoie pas ; le code s'ouvre 1 h avant le check-in et se ferme 1 h apres le check-out
export const DEFAULT_CHECKIN = '15:00'
export const DEFAULT_CHECKOUT = '11:00'
const MARGIN_MS = 60 * 60 * 1000
const TZ = 'Europe/Paris'

function tzOffsetMin(utcMs: number): number {
  const v = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(new Date(utcMs)).find(p => p.type === 'timeZoneName')!.value // "GMT+02:00" ou "GMT"
  const m = v.match(/([+-])(\d\d):(\d\d)/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}

// "2026-09-19" + "15:00" (heure de Paris) -> ISO UTC
export function parisToIso(day: string, hm: string): string {
  const [y, mo, d] = day.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  const base = Date.UTC(y!, mo! - 1, d, h, mi)
  let utc = base - tzOffsetMin(base) * 60000
  utc = base - tzOffsetMin(utc) * 60000
  return new Date(utc).toISOString()
}

// 6 chiffres sans 0, ne commence pas par 12 (regles du clavier Nuki), unique par serrure
function newCode(taken: Set<string>): string {
  for (;;) {
    const c = Array.from({ length: 6 }, () => randomInt(1, 10)).join('')
    if (!c.startsWith('12') && !taken.has(c)) return c
  }
}

// Periode de validite du code d'une reservation (ISO UTC)
function validity(b: { arrival: string; departure: string; checkIn?: string; checkOut?: string }) {
  return {
    from: new Date(+new Date(parisToIso(b.arrival, b.checkIn || DEFAULT_CHECKIN)) - MARGIN_MS).toISOString(),
    until: new Date(+new Date(parisToIso(b.departure, b.checkOut || DEFAULT_CHECKOUT)) + MARGIN_MS).toISOString(),
  }
}

export async function planCodes() {
  const db = useDatabase()
  const [{ bookings, properties, demo }, { locks }] = await Promise.all([loadData(), loadLocks()])
  const today = new Date().toISOString().slice(0, 10)
  const lockOf = (propertyId: number) => locks.find(l => l.propertyId === propertyId)
  const rows = async () => (await db.sql`SELECT * FROM access_code`).rows as unknown as AccessCode[]

  let existing = await rows()
  // Seules les reservations a venir : une reservation deja commencee (en cours) n'est jamais touchee
  for (const b of bookings.filter(b => b.arrival > today && !/declined|cancel|open/i.test(b.status))) {
    const lock = lockOf(b.propertyId)
    if (!lock) continue
    const { from, until } = validity(b)
    const row = existing.find(r => Number(r.booking_id) === b.id)
    if (!row) {
      const taken = new Set(existing.filter(r => Number(r.lock_id) === lock.id).map(r => r.code))
      await db.sql`INSERT INTO access_code (booking_id, lock_id, code, valid_from, valid_until) VALUES (${b.id}, ${lock.id}, ${newCode(taken)}, ${from}, ${until})`
    } else if (row.status !== 'created' && (row.valid_from !== from || row.valid_until !== until)) {
      await db.sql`UPDATE access_code SET valid_from = ${from}, valid_until = ${until} WHERE booking_id = ${b.id}`
    }
  }
  existing = await rows()
  const name = (id: number) => properties.find(p => p.id === id)?.name ?? `Logement ${id}`
  const items = bookings
    .filter(b => b.arrival > today && existing.some(r => Number(r.booking_id) === b.id))
    .sort((a, b) => a.arrival.localeCompare(b.arrival))
    .map((b) => {
      const r = existing.find(x => Number(x.booking_id) === b.id)!
      return {
        bookingId: b.id, propertyId: b.propertyId, lockId: Number(r.lock_id), property: name(b.propertyId), guest: b.guest, source: b.source, arrival: b.arrival, departure: b.departure,
        code: r.code, validFrom: r.valid_from, validUntil: r.valid_until, status: r.status, error: r.error,
        // Reservation modifiee apres creation du code : il faut le refaire (non gere automatiquement)
        outdated: r.status === 'created' && (r.valid_from !== validity(b).from || r.valid_until !== validity(b).until),
      }
    })
  return { demo, items }
}

export async function sendCode(bookingId: number) {
  const db = useDatabase()
  await planCodes() // s'assure que la ligne existe et que les dates sont a jour
  const r = ((await db.sql`SELECT * FROM access_code WHERE booking_id = ${bookingId}`).rows as unknown as AccessCode[])[0]
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Réservation inconnue, déjà commencée, ou sans serrure liée' })
  if (r.status === 'created') throw createError({ statusCode: 409, statusMessage: 'Code déjà créé sur Nuki' })
  const { bookings } = await loadData()
  const booking = bookings.find(b => b.id === bookingId)
  if (!booking || booking.arrival <= new Date().toISOString().slice(0, 10))
    throw createError({ statusCode: 409, statusMessage: 'Réservation en cours ou passée : non modifiée' })
  const guest = booking.guest
  try {
    await createKeypadCode(Number(r.lock_id), `LH-${bookingId} ${guest}`.slice(0, 20), r.code, r.valid_from, r.valid_until)
  } catch (e: any) {
    await db.sql`UPDATE access_code SET status = 'error', error = ${e.statusMessage || String(e)} WHERE booking_id = ${bookingId}`
    throw e
  }
  await db.sql`UPDATE access_code SET status = 'created', error = NULL, created_at = ${new Date().toISOString()} WHERE booking_id = ${bookingId}`
  return { ok: true }
}
