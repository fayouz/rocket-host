// Livret d'accueil par logement (V3, inspire de WelcomeScreen) : contenu edite par l'hote, page publique a lien secret (QR code).
import { randomBytes } from 'node:crypto'

export const isGuestToken = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v)

export interface GuestbookContent {
  wifiSsid: string; wifiPassword: string; welcomeText: string; houseRules: string
  checkinInfo: string; checkoutInfo: string; accessDirections: string; localTips: string; faq: string
}
const FIELDS: (keyof GuestbookContent)[] = ['wifiSsid', 'wifiPassword', 'welcomeText', 'houseRules', 'checkinInfo', 'checkoutInfo', 'accessDirections', 'localTips', 'faq']
const COL: Record<keyof GuestbookContent, string> = {
  wifiSsid: 'wifi_ssid', wifiPassword: 'wifi_password', welcomeText: 'welcome_text', houseRules: 'house_rules',
  checkinInfo: 'checkin_info', checkoutInfo: 'checkout_info', accessDirections: 'access_directions', localTips: 'local_tips', faq: 'faq',
}
const MAX = 4000 // par section : large mais borne (documents/photos restent dans l'explorateur, pas ici)

// Cree la ligne et le lien secret d'un logement au premier acces (comme le stock)
export async function ensureGuestbook(logementId: number) {
  const db = useDatabase()
  await db.sql`INSERT OR IGNORE INTO guestbook (logement_id, updated_at) VALUES (${logementId}, ${new Date().toISOString()})`
  const t = ((await db.sql`SELECT token FROM guestbook_token WHERE logement_id = ${logementId}`).rows as any[])[0]
  if (!t) await db.sql`INSERT INTO guestbook_token (logement_id, token) VALUES (${logementId}, ${randomBytes(16).toString('hex')})`
}

export async function getGuestbook(logementId: number): Promise<GuestbookContent> {
  await ensureGuestbook(logementId)
  const r = ((await useDatabase().sql`SELECT * FROM guestbook WHERE logement_id = ${logementId}`).rows as any[])[0]
  return Object.fromEntries(FIELDS.map(f => [f, String(r[COL[f]] ?? '')])) as unknown as GuestbookContent
}

export async function logementByGuestToken(token: string) {
  const r = ((await useDatabase().sql`SELECT logement_id FROM guestbook_token WHERE token = ${token}`).rows as any[])[0]
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Lien invalide' })
  return Number(r.logement_id)
}

// Validation des champs envoyes par l'hote (toutes facultatives : un livret se remplit progressivement)
export function parseGuestbook(b: Record<string, unknown>): Partial<GuestbookContent> {
  const out: Partial<GuestbookContent> = {}
  for (const f of FIELDS) {
    if (b[f] === undefined) continue
    const v = String(b[f]).replace(/\p{Cc}/gu, '').trim().slice(0, MAX)
    out[f] = v
  }
  return out
}

export async function saveGuestbook(logementId: number, content: Partial<GuestbookContent>) {
  await ensureGuestbook(logementId)
  const cols = Object.keys(content) as (keyof GuestbookContent)[]
  if (!cols.length) return
  const db = useDatabase()
  const set = cols.map(f => `${COL[f]} = ?`).join(', ')
  await db.prepare(`UPDATE guestbook SET ${set}, updated_at = ? WHERE logement_id = ?`).run(...cols.map(f => content[f]), new Date().toISOString(), logementId)
}

export async function regenerateGuestToken(logementId: number) {
  await ensureGuestbook(logementId)
  await useDatabase().sql`UPDATE guestbook_token SET token = ${randomBytes(16).toString('hex')} WHERE logement_id = ${logementId}`
}

// Fond du livret/ecran TV, par logement : 'inherit' reprend le fond general (reglages), 'none' force aucun fond,
// 'custom' utilise le fichier depose (background_ext) ou l'image web choisie (background_web_url) pour ce logement.
export interface BackgroundRow { mode: string; ext: string; webUrl: string; attribution: string; animated: boolean }

export async function getBackgroundRow(logementId: number): Promise<BackgroundRow> {
  const r = ((await useDatabase().sql`SELECT background_mode, background_ext, background_web_url, background_attribution, background_animated FROM guestbook WHERE logement_id = ${logementId}`).rows as any[])[0]
  return {
    mode: String(r?.background_mode || 'inherit'), ext: String(r?.background_ext || ''),
    webUrl: String(r?.background_web_url || ''), attribution: String(r?.background_attribution || ''),
    animated: !!r?.background_animated,
  }
}

export async function saveBackground(logementId: number, filename: string, data: Buffer) {
  await ensureGuestbook(logementId)
  const row = await getBackgroundRow(logementId)
  const ext = await saveBackgroundFile(`logement-${logementId}`, filename, data, row.ext)
  await useDatabase().sql`UPDATE guestbook SET background_mode = 'custom', background_ext = ${ext}, background_web_url = '', background_attribution = '' WHERE logement_id = ${logementId}`
}

export async function saveBackgroundWeb(logementId: number, url: string, attribution: string) {
  await ensureGuestbook(logementId)
  const row = await getBackgroundRow(logementId)
  await removeBackgroundFile(`logement-${logementId}`, row.ext)
  await useDatabase().sql`UPDATE guestbook SET background_mode = 'custom', background_ext = '', background_web_url = ${url.slice(0, 500)}, background_attribution = ${attribution.slice(0, 300)} WHERE logement_id = ${logementId}`
}

// mode : 'inherit' (reprend le fond general) ou 'none' (force aucun fond) ; 'custom' se pose via saveBackground(Web) ci-dessus
export async function setBackgroundMode(logementId: number, mode: 'inherit' | 'none') {
  await ensureGuestbook(logementId)
  const row = await getBackgroundRow(logementId)
  await removeBackgroundFile(`logement-${logementId}`, row.ext)
  await useDatabase().sql`UPDATE guestbook SET background_mode = ${mode}, background_ext = '', background_web_url = '', background_attribution = '' WHERE logement_id = ${logementId}`
}

export async function setBackgroundAnimated(logementId: number, animated: boolean) {
  await ensureGuestbook(logementId)
  await useDatabase().sql`UPDATE guestbook SET background_animated = ${animated ? 1 : 0} WHERE logement_id = ${logementId}`
}

export async function readBackgroundFile(logementId: number): Promise<{ path: string; mime: string } | null> {
  const row = await getBackgroundRow(logementId)
  if (!row.ext) return null
  return { path: bgPath(`logement-${logementId}`, row.ext), mime: BG_TYPES[row.ext]! }
}

export interface ResolvedBackground { url: string; animated: boolean }

// Fond effectivement affiche pour ce logement : son propre choix, ou par heritage le fond general des reglages.
export async function resolveBackground(logementId: number, publicUrlForOwnFile: string): Promise<ResolvedBackground | null> {
  const row = await getBackgroundRow(logementId)
  if (row.mode === 'none') return null
  if (row.mode === 'custom') {
    if (row.ext) return { url: publicUrlForOwnFile, animated: row.animated }
    if (row.webUrl) return { url: row.webUrl, animated: row.animated }
    return null
  }
  const g = await getDefaultBackground()
  if (!g) return null
  return { url: g.url, animated: row.animated || g.animated }
}
