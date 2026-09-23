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

// Widgets du livret/ecran TV : catalogue fixe (aussi utilise pour les libelles cote client, app/composables/useWidgetCatalog.ts,
// a garder alignee). Chaque widget ne s'affiche que s'il a du contenu ; lequel affiche, dans quel ordre, et regroupe dans
// quelle page, c'est le role des pages ci-dessous (un widget sans page n'est affiche nulle part).
export const WIDGET_IDS = ['weather', 'wifi', 'checkin', 'checkout', 'access', 'rules', 'tips', 'faq', 'devices'] as const
export type WidgetId = typeof WIDGET_IDS[number]

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

// Pages du livret/ecran TV : l'hote regroupe librement ses widgets dans des pages nommees (un onglet du carrousel en
// mode "Onglets", une section en mode "Defilement"). Chaque page peut avoir son propre fond, qui surcharge le fond
// du logement pour cette page seulement (pas de mode 'none'/'inherit' comme pour le fond du logement : soit la page
// a une image a elle, soit elle n'en a pas et herite simplement du fond du logement).
export interface GuestPage { id: number; label: string; icon: string; widgets: WidgetId[]; hasFile: boolean; webUrl: string; attribution: string }

function pageBgKey(pageId: number) { return `page-${pageId}` }

// Cree une page par defaut au premier acces d'un logement jamais configure, a partir de l'ancien reglage widget_order
// s'il existe (migration douce des logements deja en place), sinon tous les widgets dans l'ordre par defaut.
export async function ensurePages(logementId: number) {
  const db = useDatabase()
  const count = Number(((await db.sql`SELECT COUNT(*) AS n FROM guestbook_page WHERE logement_id = ${logementId}`).rows as any[])[0]?.n ?? 0)
  if (count) return
  const legacy = ((await db.sql`SELECT widget_order FROM guestbook WHERE logement_id = ${logementId}`).rows as any[])[0]
  const raw = String(legacy?.widget_order || '').split(',').map((s: string) => s.trim()).filter((s: string): s is WidgetId => (WIDGET_IDS as readonly string[]).includes(s))
  const widgets = raw.length ? raw : [...WIDGET_IDS]
  const now = new Date().toISOString()
  await db.sql`INSERT INTO guestbook_page (logement_id, label, icon, position, updated_at) VALUES (${logementId}, 'Accueil', 'i-lucide-home', 0, ${now})`
  const pageId = Number(((await db.sql`SELECT MAX(id) AS id FROM guestbook_page WHERE logement_id = ${logementId}`).rows as any[])[0].id)
  for (const [i, w] of widgets.entries()) await db.sql`INSERT INTO page_widget (page_id, widget_id, position) VALUES (${pageId}, ${w}, ${i})`
}

export async function getPages(logementId: number): Promise<GuestPage[]> {
  await ensurePages(logementId)
  const db = useDatabase()
  const pages = (await db.sql`SELECT id, label, icon, bg_ext, bg_web_url, bg_attribution FROM guestbook_page WHERE logement_id = ${logementId} ORDER BY position`).rows as any[]
  const widgetRows = (await db.sql`SELECT page_id, widget_id FROM page_widget WHERE page_id IN (SELECT id FROM guestbook_page WHERE logement_id = ${logementId}) ORDER BY position`).rows as any[]
  const widgetsByPage = new Map<number, WidgetId[]>()
  for (const r of widgetRows) {
    const pid = Number(r.page_id)
    if (!widgetsByPage.has(pid)) widgetsByPage.set(pid, [])
    widgetsByPage.get(pid)!.push(String(r.widget_id) as WidgetId)
  }
  return pages.map(p => ({
    id: Number(p.id), label: String(p.label), icon: String(p.icon || 'i-lucide-file'), widgets: widgetsByPage.get(Number(p.id)) ?? [],
    hasFile: !!p.bg_ext, webUrl: String(p.bg_web_url || ''), attribution: String(p.bg_attribution || ''),
  }))
}

async function getPage(pageId: number): Promise<{ logementId: number; ext: string } | null> {
  const r = ((await useDatabase().sql`SELECT logement_id, bg_ext FROM guestbook_page WHERE id = ${pageId}`).rows as any[])[0]
  return r ? { logementId: Number(r.logement_id), ext: String(r.bg_ext || '') } : null
}

// Verifie que la page appartient bien a ce logement (les id de page sont globaux, pas prefixes par logement) avant
// toute lecture/ecriture depuis une route admin ou publique.
export async function getPageForLogement(pageId: number, logementId: number) {
  const p = await getPage(pageId)
  if (!p || p.logementId !== logementId) throw createError({ statusCode: 404, statusMessage: 'Page introuvable' })
  return p
}

export async function createPage(logementId: number, label: string, icon: string) {
  const db = useDatabase()
  const pos = Number(((await db.sql`SELECT COALESCE(MAX(position), -1) AS m FROM guestbook_page WHERE logement_id = ${logementId}`).rows as any[])[0]?.m ?? -1) + 1
  const now = new Date().toISOString()
  await db.sql`INSERT INTO guestbook_page (logement_id, label, icon, position, updated_at) VALUES (${logementId}, ${label.slice(0, 60) || 'Page'}, ${icon || 'i-lucide-file'}, ${pos}, ${now})`
  return Number(((await db.sql`SELECT MAX(id) AS id FROM guestbook_page WHERE logement_id = ${logementId}`).rows as any[])[0].id)
}

export async function renamePage(pageId: number, label: string, icon: string) {
  await useDatabase().sql`UPDATE guestbook_page SET label = ${label.slice(0, 60) || 'Page'}, icon = ${icon || 'i-lucide-file'} WHERE id = ${pageId}`
}

export async function reorderPages(logementId: number, order: number[]) {
  const db = useDatabase()
  const existing = new Set(((await db.sql`SELECT id FROM guestbook_page WHERE logement_id = ${logementId}`).rows as any[]).map(r => Number(r.id)))
  const clean = order.map(Number).filter(id => existing.has(id))
  for (const [i, id] of clean.entries()) await db.sql`UPDATE guestbook_page SET position = ${i} WHERE id = ${id}`
}

export async function deletePage(pageId: number) {
  const p = await getPage(pageId)
  if (p?.ext) await removeBackgroundFile(pageBgKey(pageId), p.ext)
  const db = useDatabase()
  await db.sql`DELETE FROM page_widget WHERE page_id = ${pageId}`
  await db.sql`DELETE FROM guestbook_page WHERE id = ${pageId}`
}

// Assigne un widget a une page (l'enleve de toute autre page du meme logement au passage), ou le desassigne (pageId
// null) : un widget sans page n'est affiche nulle part, comme un widget desactive avant.
export async function assignWidgetToPage(logementId: number, widgetId: WidgetId, pageId: number | null) {
  const db = useDatabase()
  const pageIds = ((await db.sql`SELECT id FROM guestbook_page WHERE logement_id = ${logementId}`).rows as any[]).map(r => Number(r.id))
  for (const pid of pageIds) await db.sql`DELETE FROM page_widget WHERE page_id = ${pid} AND widget_id = ${widgetId}`
  if (pageId === null) return
  const pos = Number(((await db.sql`SELECT COALESCE(MAX(position), -1) AS m FROM page_widget WHERE page_id = ${pageId}`).rows as any[])[0]?.m ?? -1) + 1
  await db.sql`INSERT INTO page_widget (page_id, widget_id, position) VALUES (${pageId}, ${widgetId}, ${pos})`
}

export async function reorderPageWidgets(pageId: number, order: string[]) {
  const db = useDatabase()
  const existing = new Set(((await db.sql`SELECT widget_id FROM page_widget WHERE page_id = ${pageId}`).rows as any[]).map(r => String(r.widget_id)))
  const clean = order.map(String).filter(w => existing.has(w))
  for (const [i, w] of clean.entries()) await db.sql`UPDATE page_widget SET position = ${i} WHERE page_id = ${pageId} AND widget_id = ${w}`
}

export async function savePageBackground(pageId: number, filename: string, data: Buffer) {
  const p = await getPage(pageId)
  const ext = await saveBackgroundFile(pageBgKey(pageId), filename, data, p?.ext || '')
  await useDatabase().sql`UPDATE guestbook_page SET bg_ext = ${ext}, bg_web_url = '', bg_attribution = '', updated_at = ${new Date().toISOString()} WHERE id = ${pageId}`
}

export async function savePageBackgroundWeb(pageId: number, url: string, attribution: string) {
  const p = await getPage(pageId)
  if (p?.ext) await removeBackgroundFile(pageBgKey(pageId), p.ext)
  const u = url.slice(0, 500); const a = attribution.slice(0, 300)
  await useDatabase().sql`UPDATE guestbook_page SET bg_ext = '', bg_web_url = ${u}, bg_attribution = ${a}, updated_at = ${new Date().toISOString()} WHERE id = ${pageId}`
}

export async function removePageBackground(pageId: number) {
  const p = await getPage(pageId)
  if (p?.ext) await removeBackgroundFile(pageBgKey(pageId), p.ext)
  await useDatabase().sql`UPDATE guestbook_page SET bg_ext = '', bg_web_url = '', bg_attribution = '' WHERE id = ${pageId}`
}

export async function readPageBackgroundFile(pageId: number): Promise<{ path: string; mime: string } | null> {
  const p = await getPage(pageId)
  if (!p?.ext) return null
  return { path: bgPath(pageBgKey(pageId), p.ext), mime: BG_TYPES[p.ext]! }
}

// Fonds effectivement affiches par page (celles qui en ont un propre ; les autres heritent du fond du logement, pas
// besoin de les lister). publicUrlForPage(pageId) construit l'URL publique du fichier depose pour cette page.
export async function resolvePageBackgrounds(logementId: number, publicUrlForPage: (pageId: number) => string): Promise<Record<number, ResolvedBackground>> {
  const pages = await getPages(logementId)
  const out: Record<number, ResolvedBackground> = {}
  for (const p of pages) {
    if (p.hasFile) out[p.id] = { url: publicUrlForPage(p.id), animated: false }
    else if (p.webUrl) out[p.id] = { url: p.webUrl, animated: false }
  }
  return out
}
