// Adaptateur Homey Pro : acces LOCAL (cle d'API, en-tete Authorization: Bearer) ou CLOUD (OAuth, voir homeyCloud.ts). LECTURE SEULE pour l'instant : aucune commande n'est envoyee.
// La cle vient uniquement de .env (HOMEY_API_KEY) ; elle n'apparait ni dans les erreurs, ni dans les journaux, ni dans les reponses.
// Routes utilisees (specification HTTP officielle de Homey) : GET /api/manager/devices/device
export interface HomeyDevice {
  id: string; name: string; class: string; available: boolean
  capabilities: { id: string; title: string; value: unknown; units: string | null }[]
}

const TIMEOUT_MS = 8000

async function homeyGet(cfg: DomoConfig, path: string): Promise<unknown> {
  const fail = (statusCode: number, statusMessage: string) => createError({ statusCode, statusMessage })
  const cloud = cfg.homeyMode === 'cloud'
  const local = () => {
    if (!cfg.homeyUrl) throw fail(400, 'Adresse de Homey non renseignée')
    const key = useRuntimeConfig().homeyApiKey
    if (!key) throw fail(400, 'Clé d\'API absente : ajoute HOMEY_API_KEY dans .env puis redémarre')
    return { base: cfg.homeyUrl, token: key, id: '' }
  }
  const call = async (t: { base: string; token: string }) => {
    try {
      return await fetch(t.base + path, { headers: { authorization: `Bearer ${t.token}`, accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' })
    } catch (e: any) {
      const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError'
      throw fail(502, timeout ? `Homey ne répond pas (${TIMEOUT_MS / 1000} s). ${cloud ? 'Est-il en ligne ?' : 'Le serveur de l\'appli atteint-il le réseau de Homey ?'}` : cloud ? 'Homey injoignable via le cloud' : 'Homey injoignable depuis le serveur (adresse, réseau ou VPN à vérifier)')
    }
  }
  let target = cloud ? await cloudTarget(cfg.homeyId) : local()
  let res = await call(target)
  if (cloud && res.status === 401) { dropSession(target.id); target = await cloudTarget(cfg.homeyId); res = await call(target) } // session expiree : une seule nouvelle tentative
  if (res.status === 401) throw fail(502, cloud ? 'Session Homey refusée : reconnecte le compte Homey' : 'Clé d\'API refusée par Homey (vérifie HOMEY_API_KEY)')
  if (res.status === 403) throw fail(502, 'Droits insuffisants (il faut au moins lire les appareils)')
  if (!res.ok) throw fail(502, `Homey a répondu avec l'erreur ${res.status}`)
  try { return await res.json() } catch { throw fail(502, 'Réponse de Homey illisible (l\'adresse est-elle bien celle d\'un Homey ?)') }
}

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)

// Liste des appareils, normalisee (aucune donnee brute de Homey n'est renvoyee telle quelle au navigateur)
export async function listHomeyDevices(cfg: DomoConfig): Promise<HomeyDevice[]> {
  const raw = await homeyGet(cfg, '/api/manager/devices/device')
  if (!raw || typeof raw !== 'object') throw createError({ statusCode: 502, statusMessage: 'Réponse de Homey inattendue' })
  return Object.values(raw as Record<string, any>).map((d) => {
    const obj = (d?.capabilitiesObj && typeof d.capabilitiesObj === 'object' ? d.capabilitiesObj : {}) as Record<string, any>
    const ids: string[] = Array.isArray(d?.capabilities) ? d.capabilities.map(String) : Object.keys(obj)
    return {
      id: str(d?.id), name: str(d?.name, '(sans nom)').slice(0, 80), class: str(d?.class, 'other'), available: d?.available !== false,
      capabilities: ids.slice(0, 40).map(id => ({ id, title: str(obj[id]?.title, id).slice(0, 60), value: ['string', 'number', 'boolean'].includes(typeof obj[id]?.value) ? obj[id].value : null, units: obj[id]?.units == null ? null : String(obj[id].units) })),
    }
  }).filter(d => d.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

// Verification de la connexion SANS lire les appareils : cloud = jeton + session du Homey choisi ; local = simple lecture du nombre d'appareils
export async function pingHomey(cfg: DomoConfig): Promise<{ homey?: string; count?: number }> {
  if (cfg.homeyMode === 'cloud') {
    const t = await cloudTarget(cfg.homeyId)
    const h = (await listHomeys()).find(x => x.id === t.id)
    return { homey: h?.name }
  }
  return { count: (await listHomeyDevices(cfg)).length }
}
