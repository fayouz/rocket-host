// Appel HTTP commun aux clients directs des briques Rocket (Place, Clean, Stock, Cast, et PMS pour le tableau de bord
// intelligent). Volontairement sans auto-import Nuxt (pas de useRuntimeConfig/createError) : la configuration est passee
// en parametre, ce qui permet de tester l'agregation avec un fetch simule (scripts/check-smart-dashboard.mjs).
// Garde-fous : delai maximal par appel, reponse plafonnee, erreur typee (BrickError) jamais propagee telle quelle au navigateur.

export type BrickName = 'pms' | 'place' | 'clean' | 'stock' | 'cast'
export interface BrickConfig { url: string; token: string; timeoutMs?: number; maxBytes?: number; impersonate?: string }

export const BRICK_LABELS: Record<BrickName, string> = {
  pms: 'Rocket PMS', place: 'Rocket Place', clean: 'Rocket Clean', stock: 'Rocket Stock', cast: 'Rocket Cast',
}

const DEFAULT_TIMEOUT = 4000
const DEFAULT_MAX = 2 * 1024 * 1024

export class BrickError extends Error {
  brick: BrickName
  status: number
  constructor(brick: BrickName, status: number, message: string) { super(message); this.brick = brick; this.status = status }
}

export function brickConfigured(cfg: BrickConfig | null | undefined): cfg is BrickConfig {
  return !!cfg && !!cfg.url
}

export async function brickGet(brick: BrickName, cfg: BrickConfig, path: string): Promise<any> {
  const url = cfg.url.replace(/\/+$/, '') + path
  const headers: Record<string, string> = { accept: 'application/json' }
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`
  if (cfg.impersonate) headers['X-Impersonate-User'] = cfg.impersonate
  let res: Response
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(cfg.timeoutMs ?? DEFAULT_TIMEOUT) })
  } catch (e: any) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    throw new BrickError(brick, 0, `${BRICK_LABELS[brick]} ${timeout ? 'ne répond pas (délai dépassé)' : 'injoignable'}`)
  }
  const max = cfg.maxBytes ?? DEFAULT_MAX
  const len = Number(res.headers.get('content-length') || 0)
  if (len > max) throw new BrickError(brick, 502, `${BRICK_LABELS[brick]} : réponse trop volumineuse`)
  const text = await res.text()
  if (!res.ok) throw new BrickError(brick, res.status, `${BRICK_LABELS[brick]} ${res.status} sur ${path.split('?')[0]}`)
  if (text.length > max) throw new BrickError(brick, 502, `${BRICK_LABELS[brick]} : réponse trop volumineuse`)
  try { return text ? JSON.parse(text) : null } catch { throw new BrickError(brick, 502, `${BRICK_LABELS[brick]} : réponse illisible`) }
}

// Liste tolerante : tableau brut, JSON-LD (hydra:member / member) ou { items }
export function asList(r: any): any[] {
  if (Array.isArray(r)) return r
  return r?.['hydra:member'] || r?.member || r?.items || []
}
