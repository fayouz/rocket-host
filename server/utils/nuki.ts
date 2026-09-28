// Client minimal pour l'API Web Nuki (lecture seule pour l'instant).
import type { Lock, LockLog } from './types'

const BASE = 'https://api.nuki.io'

async function call(path: string, token: string): Promise<any> {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } })
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `Nuki ${res.status} sur ${path}` })
  return res.json()
}

// https://developer.nuki.io : 1 verrouillee, 3 deverrouillee, 5 penne retire, 254 moteur bloque...
const STATES: Record<number, string> = {
  0: 'Non calibrée', 1: 'Verrouillée', 2: 'Déverrouillage…', 3: 'Déverrouillée', 4: 'Verrouillage…',
  5: 'Ouverte (pêne retiré)', 6: 'Déverrouillée (Lock’n’Go)', 7: 'Ouverture…', 254: 'Moteur bloqué', 255: 'Inconnu',
}

async function fetchLocks(token: string): Promise<Lock[]> {
  const list: any[] = await call('/smartlock', token)
  return Promise.all(list.map(async (s): Promise<Lock> => {
    const logs: any[] = await call(`/smartlock/${s.smartlockId}/log?limit=5`, token).catch(() => [])
    return {
      id: s.smartlockId,
      propertyId: null,
      name: s.name,
      state: STATES[s.state?.state] ?? 'Inconnu',
      locked: s.state?.state === 1,
      battery: typeof s.state?.batteryCharge === 'number' ? s.state.batteryCharge : null,
      batteryCritical: !!s.state?.batteryCritical,
      keypadBatteryCritical: !!s.state?.keypadBatteryCritical,
      logs: logs.map((l): LockLog => ({ date: l.date, who: l.name || '', action: l.action, trigger: l.trigger })),
    }
  }))
}

let cache: { at: number; data: Lock[] | null } = { at: 0, data: null }

export async function loadLocks() {
  if (pmsEnabled()) return pmsLocks() // Rocket PMS actif : serrures lues via PMS / Rocket Place, Nuki n'est plus appele en direct
  const cfg = useRuntimeConfig()
  const demo = cfg.demo === '1' || !getSecret('NUKI_API_TOKEN')
  if (!cache.data || Date.now() - cache.at > 60 * 1000) {
    cache = { at: Date.now(), data: demo ? demoLocks : await fetchLocks(getSecret('NUKI_API_TOKEN')) }
  }
  const links = await getLockLinks()
  return { demo, locks: cache.data!.map(l => ({ ...l, propertyId: links[l.id] ?? l.propertyId })) }
}

// Cree un code clavier temporaire (type 13). Ecrit chez Nuki : appele uniquement sur action explicite.
// Necessite un jeton avec le droit smartlock.auth. Reponse 204 : la creation est asynchrone.
export async function createKeypadCode(lockId: number, name: string, code: string, from: string, until: string) {
  const cfg = useRuntimeConfig()
  if (cfg.demo === '1' || !getSecret('NUKI_API_TOKEN')) throw createError({ statusCode: 400, statusMessage: 'Mode démo : rien n’est envoyé à Nuki' })
  const res = await fetch(`${BASE}/smartlock/${lockId}/auth`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${getSecret('NUKI_API_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, type: 13, code: Number(code), allowedFromDate: from, allowedUntilDate: until }),
  })
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 ? ' (le jeton n’a pas le droit smartlock.auth ?)' : ''
    throw createError({ statusCode: 502, statusMessage: `Nuki ${res.status}${hint}` })
  }
}
