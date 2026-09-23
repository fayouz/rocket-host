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

// Prenom du voyageur en cours de sejour (si le logement est relie a Lodgify), pour le remplacement de {{guest}}
// dans le mot de bienvenue. /api/tv/:token calcule deja ce prenom lui-meme (il a besoin de la liste complete des
// reservations pour le reload programme) : cette fonction sert uniquement /api/g/:token, qui n'a pas ce besoin.
export async function getCurrentGuestFirstName(lg: { lodgifyPropertyId: number | null }) {
  if (lg.lodgifyPropertyId === null) return null
  const today = new Date().toISOString().slice(0, 10)
  const { bookings } = await loadData()
  const b = bookings.find(x => x.propertyId === lg.lodgifyPropertyId && isActiveBooking(x) && x.arrival <= today && x.departure > today)
  return b ? (b.guest.split(' ')[0] || b.guest).slice(0, 40) : null
}

// Remplace {{guest}} par le prenom du voyageur en cours (ou un mot generique si personne n'est actuellement present :
// livret consulte hors sejour, ou logement sans synchronisation Lodgify).
export function applyGuestPlaceholder(text: string, firstName: string | null) {
  return text.replaceAll('{{guest}}', firstName || 'voyageur')
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

// Widgets du livret/ecran TV : liste ordonnee, source unique de verite (aussi utilisee pour les libelles cote client,
// app/composables/useWidgetCatalog.ts, a garder alignee). Chaque widget ne s'affiche que s'il a du contenu (deja
// gere par les pages), cette liste ne fait que choisir lesquels ET dans quel ordre, par logement.
export const WIDGET_IDS = ['weather', 'wifi', 'checkin', 'checkout', 'access', 'rules', 'tips', 'faq', 'devices'] as const
export type WidgetId = typeof WIDGET_IDS[number]

export async function getWidgetOrder(logementId: number): Promise<WidgetId[]> {
  const r = ((await useDatabase().sql`SELECT widget_order FROM guestbook WHERE logement_id = ${logementId}`).rows as any[])[0]
  const raw = String(r?.widget_order || '').split(',').map(s => s.trim()).filter((s): s is WidgetId => (WIDGET_IDS as readonly string[]).includes(s))
  return raw.length ? raw : [...WIDGET_IDS]
}

export async function saveWidgetOrder(logementId: number, order: unknown[]) {
  await ensureGuestbook(logementId)
  const clean = [...new Set(order.map(String))].filter((s): s is WidgetId => (WIDGET_IDS as readonly string[]).includes(s))
  await useDatabase().sql`UPDATE guestbook SET widget_order = ${clean.join(',')} WHERE logement_id = ${logementId}`
}

// Mise en page (par logement) : navigation par defilement (toutes les cartes) ou par onglets (une a la fois, sur le
// livret mobile du voyageur seulement — l'ecran TV reste toujours en defilement, aucune interaction tactile la-bas).
// Colonnes separees : livret (defaut 1, page etroite pensee mobile) et ecran TV (defaut 2, comportement d'avant cette option).
export interface LayoutSettings { navMode: 'scroll' | 'tabs'; gridColumns: 1 | 2; tvColumns: 1 | 2 }

export async function getLayoutSettings(logementId: number): Promise<LayoutSettings> {
  const r = ((await useDatabase().sql`SELECT nav_mode, grid_columns, tv_columns FROM guestbook WHERE logement_id = ${logementId}`).rows as any[])[0]
  return {
    navMode: r?.nav_mode === 'tabs' ? 'tabs' : 'scroll',
    gridColumns: Number(r?.grid_columns) === 2 ? 2 : 1,
    tvColumns: Number(r?.tv_columns) === 1 ? 1 : 2,
  }
}

export async function saveLayoutSettings(logementId: number, navMode: unknown, gridColumns: unknown, tvColumns: unknown) {
  await ensureGuestbook(logementId)
  const mode = navMode === 'tabs' ? 'tabs' : 'scroll'
  const cols = Number(gridColumns) === 2 ? 2 : 1
  const tvCols = Number(tvColumns) === 1 ? 1 : 2
  await useDatabase().sql`UPDATE guestbook SET nav_mode = ${mode}, grid_columns = ${cols}, tv_columns = ${tvCols} WHERE logement_id = ${logementId}`
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

// Fond par widget (carrousel) : surcharge le fond du logement pour ce seul widget, uniquement en mode "Onglets".
// Pas de mode 'none'/'inherit' comme pour le fond du logement : soit le widget a une image a lui (ext ou webUrl),
// soit il n'en a pas et herite simplement du fond du logement (comportement affiche a l'hote comme "par defaut").
export interface WidgetBackgroundRow { ext: string; webUrl: string; attribution: string }

function widgetBgKey(logementId: number, widgetId: string) { return `logement-${logementId}-widget-${widgetId}` }

export async function getWidgetBackgroundRow(logementId: number, widgetId: string): Promise<WidgetBackgroundRow> {
  const r = ((await useDatabase().sql`SELECT ext, web_url, attribution FROM widget_background WHERE logement_id = ${logementId} AND widget_id = ${widgetId}`).rows as any[])[0]
  return { ext: String(r?.ext || ''), webUrl: String(r?.web_url || ''), attribution: String(r?.attribution || '') }
}

export async function getWidgetBackgrounds(logementId: number): Promise<Record<string, WidgetBackgroundRow>> {
  const rows = (await useDatabase().sql`SELECT widget_id, ext, web_url, attribution FROM widget_background WHERE logement_id = ${logementId}`).rows as any[]
  return Object.fromEntries(rows.map(r => [String(r.widget_id), { ext: String(r.ext || ''), webUrl: String(r.web_url || ''), attribution: String(r.attribution || '') }]))
}

export async function saveWidgetBackground(logementId: number, widgetId: string, filename: string, data: Buffer) {
  const row = await getWidgetBackgroundRow(logementId, widgetId)
  const ext = await saveBackgroundFile(widgetBgKey(logementId, widgetId), filename, data, row.ext)
  const now = new Date().toISOString()
  await useDatabase().sql`INSERT INTO widget_background (logement_id, widget_id, ext, web_url, attribution, updated_at) VALUES (${logementId}, ${widgetId}, ${ext}, '', '', ${now})
    ON CONFLICT (logement_id, widget_id) DO UPDATE SET ext = ${ext}, web_url = '', attribution = '', updated_at = ${now}`
}

export async function saveWidgetBackgroundWeb(logementId: number, widgetId: string, url: string, attribution: string) {
  const row = await getWidgetBackgroundRow(logementId, widgetId)
  await removeBackgroundFile(widgetBgKey(logementId, widgetId), row.ext)
  const now = new Date().toISOString()
  const u = url.slice(0, 500); const a = attribution.slice(0, 300)
  await useDatabase().sql`INSERT INTO widget_background (logement_id, widget_id, ext, web_url, attribution, updated_at) VALUES (${logementId}, ${widgetId}, '', ${u}, ${a}, ${now})
    ON CONFLICT (logement_id, widget_id) DO UPDATE SET ext = '', web_url = ${u}, attribution = ${a}, updated_at = ${now}`
}

export async function removeWidgetBackground(logementId: number, widgetId: string) {
  const row = await getWidgetBackgroundRow(logementId, widgetId)
  await removeBackgroundFile(widgetBgKey(logementId, widgetId), row.ext)
  await useDatabase().sql`DELETE FROM widget_background WHERE logement_id = ${logementId} AND widget_id = ${widgetId}`
}

export async function readWidgetBackgroundFile(logementId: number, widgetId: string): Promise<{ path: string; mime: string } | null> {
  const row = await getWidgetBackgroundRow(logementId, widgetId)
  if (!row.ext) return null
  return { path: bgPath(widgetBgKey(logementId, widgetId), row.ext), mime: BG_TYPES[row.ext]! }
}

// Fonds resolus pour tous les widgets d'un logement qui ont une surcharge (les autres heritent du fond du logement,
// pas besoin de les lister). publicUrlForOwnFile(widgetId) construit l'URL publique du fichier depose pour ce widget.
export async function resolveWidgetBackgrounds(logementId: number, publicUrlForOwnFile: (widgetId: string) => string): Promise<Record<string, ResolvedBackground>> {
  const rows = await getWidgetBackgrounds(logementId)
  const out: Record<string, ResolvedBackground> = {}
  for (const [widgetId, row] of Object.entries(rows)) {
    if (row.ext) out[widgetId] = { url: publicUrlForOwnFile(widgetId), animated: false }
    else if (row.webUrl) out[widgetId] = { url: row.webUrl, animated: false }
  }
  return out
}
