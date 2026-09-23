// Homey en mode CLOUD (OAuth2 avec le compte Athom). Procedure officielle : autorisation -> code -> jeton d'acces (1 h) + jeton de renouvellement
// -> jeton de delegation -> connexion au Homey (URL distante) -> jeton de session.
// L'identifiant et le secret de l'application restent dans .env ; le jeton de renouvellement est dans .data/homey-oauth.json (droits 0600, hors git,
// jamais envoye au navigateur). Aucun jeton ne figure dans les erreurs ni les journaux.
import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ATHOM = process.env.HOMEY_ATHOM_BASE || 'https://api.athom.com' // surchargeable UNIQUEMENT pour les tests (faux serveur)
const TIMEOUT = 10_000
const storeFile = () => resolve(process.cwd(), '.data', 'homey-oauth.json')

interface Stored { refreshToken: string; accessToken: string; expiresAt: number; connectedAt: string }
export interface HomeyInfo { id: string; name: string; remoteUrl: string }

const fail = (statusCode: number, statusMessage: string) => createError({ statusCode, statusMessage })
const cfg = () => useRuntimeConfig()
export const cloudConfigured = () => !!(cfg().homeyClientId && cfg().homeyClientSecret)

async function readStore(): Promise<Stored | null> {
  try {
    const j = JSON.parse(await readFile(storeFile(), 'utf8'))
    return typeof j?.refreshToken === 'string' && j.refreshToken ? j : null
  } catch { return null }
}
async function writeStore(s: Stored) {
  await mkdir(resolve(process.cwd(), '.data'), { recursive: true })
  const tmp = `${storeFile()}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(s), { mode: 0o600 })
  await chmod(tmp, 0o600)
  await rename(tmp, storeFile())
}

export async function cloudStatus() {
  const s = await readStore()
  return { clientConfigured: cloudConfigured(), connected: !!s, connectedAt: s?.connectedAt ?? null }
}

// Adresse de retour OAuth : celle declaree dans l'application Homey (HOMEY_REDIRECT_URI, sinon deduite de l'adresse du site)
export function redirectUri(event: Parameters<typeof getRequestURL>[0]) {
  const fixed = cfg().homeyRedirectUri
  if (fixed) return fixed
  return `${getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin}/api/homey/callback`
}

export function authorizeUrl(redirect: string, state: string) {
  const u = new URL(`${ATHOM}/oauth2/authorise`)
  u.search = new URLSearchParams({ response_type: 'code', client_id: String(cfg().homeyClientId), redirect_uri: redirect, state }).toString()
  return u.toString()
}
export const newState = () => randomBytes(16).toString('hex')

async function athom(path: string, init: RequestInit, what: string): Promise<any> {
  let res: Response
  try { res = await fetch(`${ATHOM}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT), redirect: 'error' }) }
  catch { throw fail(502, `Le cloud Homey est injoignable (${what})`) }
  if (res.status === 401 || res.status === 400) throw fail(502, `Le cloud Homey a refusé la demande (${what}) : reconnecte le compte Homey`)
  if (!res.ok) throw fail(502, `Le cloud Homey a répondu avec l'erreur ${res.status} (${what})`)
  try { return await res.json() } catch { throw fail(502, `Réponse illisible du cloud Homey (${what})`) }
}

const basic = () => `Basic ${Buffer.from(`${cfg().homeyClientId}:${cfg().homeyClientSecret}`).toString('base64')}`
async function tokenRequest(params: Record<string, string>, what: string) {
  const j = await athom('/oauth2/token', { method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() }, what)
  if (typeof j?.access_token !== 'string') throw fail(502, `Réponse inattendue du cloud Homey (${what})`)
  return { accessToken: j.access_token as string, refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token as string : '', expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
}

// Echange du code recu apres l'autorisation contre les jetons, puis enregistrement.
// Le serveur reel attend response_type=code a l'autorisation (la doc parle d'authorization_type) : on envoie aussi bien `code` que `authorization_code` a l'echange.
export async function completeAuthorization(code: string, redirect: string) {
  if (!cloudConfigured()) throw fail(400, 'Application Homey non configurée (HOMEY_CLIENT_ID / HOMEY_CLIENT_SECRET dans .env)')
  const t = await tokenRequest({ grant_type: 'authorization_code', code, authorization_code: code, redirect_uri: redirect }, 'échange du code')
  if (!t.refreshToken) throw fail(502, 'Le cloud Homey n\'a pas fourni de jeton de renouvellement')
  await writeStore({ ...t, connectedAt: new Date().toISOString() })
  sessions.clear(); homeysCache = null
}

export async function disconnectCloud() {
  try { await unlink(storeFile()) } catch (e: any) { if (e?.code !== 'ENOENT') throw e }
  sessions.clear(); homeysCache = null
}

// Jeton d'acces valide (renouvele 1 minute avant expiration ; une seule renovation a la fois)
let refreshing: Promise<string> | null = null
async function accessToken(): Promise<string> {
  const s = await readStore()
  if (!s) throw fail(400, 'Compte Homey non connecté : clique sur « Connecter mon compte Homey »')
  if (s.expiresAt - 60_000 > Date.now()) return s.accessToken
  refreshing ??= (async () => {
    try {
      const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken }, 'renouvellement du jeton')
      await writeStore({ ...s, accessToken: t.accessToken, expiresAt: t.expiresAt, refreshToken: t.refreshToken || s.refreshToken })
      return t.accessToken
    } finally { refreshing = null }
  })()
  return refreshing
}

let homeysCache: { at: number; list: HomeyInfo[] } | null = null
export async function listHomeys(force = false): Promise<HomeyInfo[]> {
  if (!force && homeysCache && Date.now() - homeysCache.at < 300_000) return homeysCache.list
  const me = await athom('/user/me', { headers: { authorization: `Bearer ${await accessToken()}` } }, 'liste des Homey')
  const list = (Array.isArray(me?.homeys) ? me.homeys : []).map((h: any) => ({
    id: String(h?.id ?? h?._id ?? ''), name: String(h?.name ?? 'Homey').slice(0, 80), remoteUrl: String(h?.remoteUrlSecure ?? h?.remoteUrl ?? ''),
  })).filter((h: HomeyInfo) => h.id && (/^https:\/\//.test(h.remoteUrl) || (process.env.HOMEY_ATHOM_BASE && /^http:\/\/127\.0\.0\.1[:/]/.test(h.remoteUrl)))) // http local seulement pour les tests
  homeysCache = { at: Date.now(), list }
  return list
}

const sessions = new Map<string, { token: string; until: number }>()
export const dropSession = (homeyId: string) => sessions.delete(homeyId)

// Adresse distante + jeton de session du Homey ASSOCIE au logement. Pas de repli automatique : un logement sans Homey associe ne parle a aucun Homey.
export async function cloudTarget(homeyId: string): Promise<{ base: string; token: string; id: string }> {
  if (!homeyId) throw fail(400, 'Aucun Homey n\'est associé à ce logement : choisis-en un dans les réglages')
  const homeys = await listHomeys()
  const h = homeys.find(x => x.id === homeyId)
  if (!h) throw fail(400, 'Le Homey associé n\'existe plus sur le compte connecté : associe-en un autre')
  const cached = sessions.get(h.id)
  if (cached && cached.until > Date.now()) return { base: h.remoteUrl, token: cached.token, id: h.id }
  const delegation = await athom('/delegation/token?audience=homey', { method: 'POST', headers: { authorization: `Bearer ${await accessToken()}` } }, 'jeton de délégation')
  const dtoken = typeof delegation === 'string' ? delegation : String(delegation?.token ?? '')
  if (!dtoken) throw fail(502, 'Jeton de délégation absent de la réponse du cloud Homey')
  let res: Response
  try {
    res = await fetch(`${h.remoteUrl}/api/manager/users/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: dtoken }), signal: AbortSignal.timeout(TIMEOUT), redirect: 'error' })
  } catch { throw fail(502, 'Ton Homey est injoignable par le cloud (est-il en ligne ?)') }
  if (!res.ok) throw fail(502, `Ton Homey a refusé la connexion (erreur ${res.status})`)
  let session: unknown
  try { session = await res.json() } catch { throw fail(502, 'Réponse de connexion illisible') }
  const token = typeof session === 'string' ? session : String((session as any)?.token ?? '')
  if (!token) throw fail(502, 'Jeton de session absent de la réponse de Homey')
  sessions.set(h.id, { token, until: Date.now() + 10 * 60_000 })
  return { base: h.remoteUrl, token, id: h.id }
}
