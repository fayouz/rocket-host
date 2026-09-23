// Livret d'accueil par logement (V3, inspire de WelcomeScreen) : contenu edite par l'hote, page publique a lien secret (QR code).
import { randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

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

// Image de fond du livret et de l'ecran TV (un logement = un fichier, remplace a chaque envoi)
const BG_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
const BG_MAX = 8 * 1024 * 1024 // 8 Mo
const bgRoot = () => resolve(process.cwd(), '.data', 'backgrounds')
function bgPath(logementId: number, ext: string) {
  const abs = resolve(bgRoot(), `${logementId}.${ext}`)
  if (!abs.startsWith(bgRoot() + sep)) throw createError({ statusCode: 400, statusMessage: 'Chemin invalide' })
  return abs
}
const bgStartsWith = (buf: Buffer, bytes: number[]) => bytes.every((b, i) => buf[i] === b)
function bgMagicOk(ext: string, buf: Buffer) {
  if (ext === 'png') return bgStartsWith(buf, [0x89, 0x50, 0x4e, 0x47])
  if (ext === 'jpg' || ext === 'jpeg') return bgStartsWith(buf, [0xff, 0xd8, 0xff])
  if (ext === 'webp') return bgStartsWith(buf, [0x52, 0x49, 0x46, 0x46])
  return false
}

export async function getBackgroundExt(logementId: number): Promise<string> {
  const r = ((await useDatabase().sql`SELECT background_ext FROM guestbook WHERE logement_id = ${logementId}`).rows as any[])[0]
  return String(r?.background_ext ?? '')
}

export async function saveBackground(logementId: number, filename: string, data: Buffer) {
  await ensureGuestbook(logementId)
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (!BG_TYPES[ext]) throw createError({ statusCode: 400, statusMessage: 'Image acceptée : PNG, JPG ou WebP' })
  if (!data.length || data.length > BG_MAX) throw createError({ statusCode: 413, statusMessage: 'Image vide ou trop volumineuse (8 Mo maximum)' })
  if (!bgMagicOk(ext, data)) throw createError({ statusCode: 400, statusMessage: `Le contenu ne correspond pas à une image .${ext}` })
  const old = await getBackgroundExt(logementId)
  await mkdir(bgRoot(), { recursive: true })
  await writeFile(bgPath(logementId, ext), data)
  if (old && old !== ext) await unlink(bgPath(logementId, old)).catch(() => {})
  await useDatabase().sql`UPDATE guestbook SET background_ext = ${ext} WHERE logement_id = ${logementId}`
}

export async function removeBackground(logementId: number) {
  const ext = await getBackgroundExt(logementId)
  if (!ext) return
  await unlink(bgPath(logementId, ext)).catch(() => {})
  await useDatabase().sql`UPDATE guestbook SET background_ext = '' WHERE logement_id = ${logementId}`
}

export async function readBackground(logementId: number): Promise<{ path: string; mime: string } | null> {
  const ext = await getBackgroundExt(logementId)
  if (!ext) return null
  return { path: bgPath(logementId, ext), mime: BG_TYPES[ext]! }
}
