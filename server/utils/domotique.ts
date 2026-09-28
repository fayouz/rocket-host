// Domotique par logement (Homey Pro). Phase de preparation : configuration + SIMULATION des actions ; aucune commande n'est envoyee.
// Bornes de securite appliquees cote serveur (jamais seulement dans l'interface).
export const LIMITS = { comfort: [16, 24], eco: [10, 24], preheatHours: [0.5, 12], ecoDelayMin: [0, 720] } as const

export interface DomoConfig {
  logementId: number; homeyMode: 'local' | 'cloud'; homeyUrl: string; homeyId: string
  preheatEnabled: boolean; preheatHours: number; comfortTemp: number; ecoTemp: number; ecoDelayMin: number
}

const DEFAULTS = { homeyMode: 'local' as const, homeyUrl: '', homeyId: '', preheatEnabled: false, preheatHours: 3, comfortTemp: 20, ecoTemp: 17, ecoDelayMin: 60 }

export async function getDomoConfig(logementId: number): Promise<DomoConfig> {
  const r = ((await useDatabase().sql`SELECT * FROM domotique_config WHERE logement_id = ${logementId}`).rows as any[])[0]
  if (!r) return { logementId, ...DEFAULTS }
  return {
    logementId, homeyMode: r.homey_mode === 'cloud' ? 'cloud' : 'local', homeyUrl: String(r.homey_url), homeyId: String(r.homey_id ?? ''),
    preheatEnabled: !!Number(r.preheat_enabled), preheatHours: Number(r.preheat_hours), comfortTemp: Number(r.comfort_temp),
    ecoTemp: Number(r.eco_temp), ecoDelayMin: Number(r.eco_delay_min),
  }
}

const inRange = (n: number, [min, max]: readonly [number, number]) => Number.isFinite(n) && n >= min && n <= max

// Validation d'une configuration envoyee par le navigateur
export function parseDomoConfig(b: Record<string, unknown>, current: DomoConfig): Omit<DomoConfig, 'logementId'> {
  const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })
  const mode = b.homeyMode === undefined ? current.homeyMode : b.homeyMode
  if (mode !== 'local' && mode !== 'cloud') throw bad('Mode de connexion invalide')
  let url = b.homeyUrl === undefined ? current.homeyUrl : String(b.homeyUrl).trim()
  if (url) {
    let u: URL
    try { u = new URL(url) } catch { throw bad('Adresse invalide (ex. http://192.168.1.20)') }
    if (!/^https?:$/.test(u.protocol)) throw bad('Adresse invalide : http ou https seulement')
    if (u.username || u.password) throw bad('Pas d\'identifiant dans l\'adresse : la clé d\'API se saisit dans Réglages › Connexions')
    url = u.origin
  }
  const homeyId = b.homeyId === undefined ? current.homeyId : String(b.homeyId).trim()
  if (homeyId && !/^[0-9a-zA-Z_-]{6,64}$/.test(homeyId)) throw bad('Identifiant de Homey invalide')
  const num = (v: unknown, cur: number) => (v === undefined || v === '' ? cur : Number(String(v).replace(',', '.')))
  const preheatHours = num(b.preheatHours, current.preheatHours)
  const comfortTemp = num(b.comfortTemp, current.comfortTemp)
  const ecoTemp = num(b.ecoTemp, current.ecoTemp)
  const ecoDelayMin = Math.round(num(b.ecoDelayMin, current.ecoDelayMin))
  if (!inRange(preheatHours, LIMITS.preheatHours)) throw bad(`Délai avant l'arrivée : entre ${LIMITS.preheatHours[0]} et ${LIMITS.preheatHours[1]} h`)
  if (!inRange(comfortTemp, LIMITS.comfort)) throw bad(`Température confort : entre ${LIMITS.comfort[0]} et ${LIMITS.comfort[1]} °C`)
  if (!inRange(ecoTemp, LIMITS.eco)) throw bad(`Température éco : entre ${LIMITS.eco[0]} et ${LIMITS.eco[1]} °C`)
  if (ecoTemp > comfortTemp) throw bad('La température éco ne peut pas dépasser la température confort')
  if (!inRange(ecoDelayMin, LIMITS.ecoDelayMin)) throw bad(`Délai après le départ : entre ${LIMITS.ecoDelayMin[0]} et ${LIMITS.ecoDelayMin[1]} min`)
  return {
    homeyMode: mode, homeyUrl: url, homeyId, preheatEnabled: b.preheatEnabled === undefined ? current.preheatEnabled : !!b.preheatEnabled,
    preheatHours: Math.round(preheatHours * 10) / 10, comfortTemp: Math.round(comfortTemp * 2) / 2, ecoTemp: Math.round(ecoTemp * 2) / 2, ecoDelayMin,
  }
}

export interface SimAction { at: string; kind: 'comfort' | 'eco' | 'kept'; temp: number | null; bookingId: number; guest: string; note: string }

// Simulation : pour chaque reservation a venir (ou en cours) du logement, quand la consigne passerait en confort puis en eco.
// Si le sejour suivant demande deja le confort avant le retour en eco, on reste en confort (continuite).
export function simulate(bookings: { id: number; arrival: string; departure: string; guest: string; status: string; checkIn?: string; checkOut?: string }[], cfg: DomoConfig, now = Date.now()): SimAction[] {
  const valid = bookings.filter(b => !/declined|cancel|open/i.test(b.status)).sort((a, b) => a.arrival.localeCompare(b.arrival))
  const window = now + 60 * 86_400_000
  const out: SimAction[] = []
  valid.forEach((b, i) => {
    const arrival = +new Date(parisToIso(b.arrival, b.checkIn || DEFAULT_CHECKIN))
    const departure = +new Date(parisToIso(b.departure, b.checkOut || DEFAULT_CHECKOUT))
    const heatAt = arrival - cfg.preheatHours * 3_600_000
    const ecoAt = departure + cfg.ecoDelayMin * 60_000
    if (ecoAt < now || heatAt > window) return
    const next = valid[i + 1]
    const nextHeat = next ? +new Date(parisToIso(next.arrival, next.checkIn || DEFAULT_CHECKIN)) - cfg.preheatHours * 3_600_000 : Infinity
    if (heatAt >= now) out.push({ at: new Date(heatAt).toISOString(), kind: 'comfort', temp: cfg.comfortTemp, bookingId: b.id, guest: b.guest, note: `Préchauffage ${cfg.preheatHours} h avant l'arrivée` })
    if (nextHeat <= ecoAt) out.push({ at: new Date(ecoAt).toISOString(), kind: 'kept', temp: null, bookingId: b.id, guest: b.guest, note: 'Séjour suivant trop proche : la consigne confort est conservée' })
    else out.push({ at: new Date(ecoAt).toISOString(), kind: 'eco', temp: cfg.ecoTemp, bookingId: b.id, guest: b.guest, note: 'Retour en mode éco après le départ' })
  })
  return out.sort((a, b) => a.at.localeCompare(b.at))
}
