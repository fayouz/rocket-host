// Bilan annuel d'un logement : revenus bruts Lodgify (repartis nuit par nuit sur l'annee) + fichiers de type comptable
// de l'explorateur (charges, autres recettes : type, date et montant).
import type { Logement } from './logements'

const DAY = 864e5

export async function buildBilan(lg: Logement, year: number) {
  const { bookings } = await loadData()
  const mine = bookings.filter(b => b.propertyId === lg.lodgifyPropertyId && isActiveBooking(b))

  // Revenus Lodgify : total de la reservation reparti a parts egales sur ses nuits ; on ne garde que les nuits de l'annee
  const months = Array.from({ length: 12 }, () => ({ revenue: 0, nights: 0 }))
  let revenue = 0, nights = 0, stays = 0
  let firstNight = Infinity // premiere nuit vendue de l'annee : un logement lance en cours d'annee n'est pas juge sur les mois d'avant
  for (const b of mine) {
    const start = Date.parse(b.arrival), end = Date.parse(b.departure)
    const n = Math.round((end - start) / DAY)
    if (!(n > 0)) continue
    const perNight = b.total / n
    let counted = false
    for (let i = 0; i < n; i++) {
      const d = new Date(start + i * DAY)
      if (d.getUTCFullYear() !== year) continue
      counted = true
      firstNight = Math.min(firstNight, d.getTime())
      months[d.getUTCMonth()]!.revenue += perNight
      months[d.getUTCMonth()]!.nights += 1
      revenue += perNight
      nights += 1
    }
    if (counted) stays += 1
  }

  // Releves de plateformes importes (commissions, taxes de sejour, reversements) de l'annee pour ce logement
  const db = useDatabase()
  const tx = (await db.sql`SELECT kind, SUM(amount) AS total, COUNT(*) AS n FROM platform_transaction WHERE logement_id = ${lg.id} AND substr(tx_date, 1, 4) = ${String(year)} GROUP BY kind`).rows as any[]
  const txSum = (k: string) => Number(tx.find(t => t.kind === k)?.total ?? 0)
  const txCount = (k: string) => Number(tx.find(t => t.kind === k)?.n ?? 0)
  const platformFees = txSum('fee')
  const unassignedTx = Number(((await db.sql`SELECT COUNT(*) AS n FROM platform_transaction WHERE logement_id = 0 AND substr(tx_date, 1, 4) = ${String(year)}`).rows as any[])[0].n)

  // Fichiers comptables de l'annee (explorateur) : charges par type, autres recettes ; sans date ou sans montant = a completer
  const rows = (await db.sql`SELECT file_type, doc_date, amount FROM fs_node WHERE logement_id = ${lg.id} AND kind = 'file' AND file_type != ''`).rows as any[]
  const accounting = rows.filter(r => isCategory(r.file_type) && CATEGORIES[r.file_type as CategoryKey].kind !== 'doc')
  const inYear = accounting.filter(r => String(r.doc_date ?? '').startsWith(String(year)))
  const byCat = new Map<string, { total: number; count: number }>()
  let chargesTotal = 0, otherIncome = 0, chargesWithoutAmount = 0
  for (const r of inYear) {
    const cat = CATEGORIES[r.file_type as CategoryKey]
    if (r.file_type === 'frais_plateformes' && platformFees > 0) continue // deja compte via les releves importes (meme depense)
    if (r.amount === null) { if (cat.kind === 'charge') chargesWithoutAmount += 1; continue }
    const amount = Number(r.amount)
    if (cat.kind === 'charge') {
      chargesTotal += amount
      const cur = byCat.get(r.file_type) ?? { total: 0, count: 0 }
      byCat.set(r.file_type, { total: cur.total + amount, count: cur.count + 1 })
    } else otherIncome += amount
  }
  // Fichiers comptables sans date : on ne sait pas dans quelle annee les compter
  const withoutDate = accounting.filter(r => !r.doc_date).length

  if (platformFees > 0) {
    chargesTotal += platformFees
    byCat.set('frais_plateformes', { total: platformFees, count: txCount('fee') })
  }

  const now = new Date()
  // Periode d'exploitation : de la premiere nuit vendue de l'annee jusqu'a aujourd'hui (annee en cours) ou fin d'annee
  const yearStart = Date.UTC(year, 0, 1), yearEnd = Date.UTC(year + 1, 0, 1)
  const from = Number.isFinite(firstNight) ? firstNight : yearStart
  const daysConsidered = Math.max(1, Math.ceil((Math.min(yearEnd, now.getTime()) - from) / DAY))
  const round = (n: number) => Math.round(n * 100) / 100

  const years = new Set<number>([now.getUTCFullYear(), ...mine.flatMap(b => [Number(b.arrival.slice(0, 4)), Number(b.departure.slice(0, 4))]), ...accounting.filter(r => r.doc_date).map(r => Number(String(r.doc_date).slice(0, 4)))])
  return {
    logement: lg, year, years: [...years].filter(y => y >= 2000).sort((a, b) => b - a),
    revenue: round(revenue), nights, stays, occupancy: Math.min(100, Math.round(100 * nights / daysConsidered)), daysConsidered,
    since: from > yearStart ? new Date(from).toISOString().slice(0, 10) : null,
    months: months.map(m => ({ revenue: round(m.revenue), nights: m.nights })),
    charges: [...byCat.entries()].map(([key, v]) => ({ key, label: key === 'frais_plateformes' && platformFees > 0 ? 'Frais de plateformes (relevés importés)' : CATEGORIES[key as CategoryKey].label, total: round(v.total), count: v.count })).sort((a, b) => b.total - a.total),
    chargesTotal: round(chargesTotal), otherIncome: round(otherIncome), chargesWithoutAmount, withoutDate, documents: inYear.length,
    result: round(revenue + otherIncome - chargesTotal),
    // Releves importes : reversements recus, frais retenus, taxe de sejour collectee (indicatif), remboursements, lignes encore a affecter
    platform: { payouts: round(txSum('payout')), fees: round(platformFees), touristTax: round(txSum('tourist_tax')), refunds: round(txSum('refund')), unassigned: unassignedTx, has: tx.length > 0 },
  }
}
