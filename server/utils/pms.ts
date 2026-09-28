// Client pour l'API Rocket PMS (fayouz/rocket-pms), optionnel : actif seulement si PMS_API_URL est renseigne dans .env.
// Tant qu'il est absent, l'appli fonctionne exactement comme avant (Lodgify + Nuki en direct, voir lodgify.ts et nuki.ts).
// Authentification : jeton d'application Rocket Core ("Authorization: Bearer rpm_..."), cree dans Rocket PMS > Applications.
//
// Tranche branchee pour l'instant : logements + reservations en lecture (voir pmsLoadData, utilise par lodgify.ts::loadData).
// Le reste de l'API (serrures/codes, domotique, documents, conversation) reste a brancher : voir docs/rocket-pms.md.
import type { Booking, Lock, Property } from './types'

const MAX_BYTES = 5 * 1024 * 1024 // reponse plafonnee, comme les autres clients (lodgify.ts, nuki.ts)

function config() {
  const cfg = useRuntimeConfig()
  return { url: String(cfg.pmsApiUrl || '').replace(/\/+$/, ''), token: String(cfg.pmsApiToken || '') }
}

// Vrai si PMS_API_URL est renseigne : bascule le reste de l'appli sur Rocket PMS plutot que Lodgify/Nuki en direct.
export function pmsEnabled(): boolean {
  return !!config().url
}

async function call(path: string, init?: RequestInit): Promise<any> {
  const { url, token } = config()
  if (!url) throw createError({ statusCode: 500, statusMessage: 'Rocket PMS non configuré (PMS_API_URL absent de .env)' })
  const res = await fetch(url + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json', ...(init?.headers || {}) },
  })
  const text = await res.text()
  if (!res.ok) {
    // 4xx metier du PMS (404, 409, 422, refus en mode demo...) : son message est repris tel quel ; le reste devient un 502
    let detail = ''
    try { const j = JSON.parse(text); detail = String(j?.detail || j?.message || j?.title || '') } catch {}
    const passthrough = res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403
    throw createError({ statusCode: passthrough ? res.status : 502, statusMessage: (passthrough && detail ? detail : `Rocket PMS ${res.status} sur ${path}`).slice(0, 300) })
  }
  if (text.length > MAX_BYTES) throw createError({ statusCode: 502, statusMessage: `Réponse Rocket PMS trop volumineuse sur ${path}` })
  return text ? JSON.parse(text) : null
}

export interface PmsProperty {
  id: string // uuid Rocket PMS
  name: string
  lodgifyPropertyId: number | null
  lodgifyName: string | null
  color: string
  latitude: number | null
  longitude: number | null
}

// GET /api/properties (API Platform, sans pagination : accept json renvoie un tableau simple, pas du JSON-LD)
export async function pmsProperties(): Promise<PmsProperty[]> {
  const r = await call('/api/properties')
  const list: any[] = Array.isArray(r) ? r : r['hydra:member'] || r.member || []
  return list.map(p => ({
    id: String(p.id),
    name: String(p.name || ''),
    lodgifyPropertyId: typeof p.lodgifyPropertyId === 'number' ? p.lodgifyPropertyId : null,
    lodgifyName: typeof p.lodgifyName === 'string' ? p.lodgifyName : null,
    color: String(p.color || ''),
    latitude: typeof p.latitude === 'number' ? p.latitude : null,
    longitude: typeof p.longitude === 'number' ? p.longitude : null,
  }))
}

// Reservations d'un logement PMS (60 derniers jours + a venir), deja au format attendu par l'appli (voir Booking dans types.ts).
// threadUid n'est pas expose par le PMS (la conversation Lodgify reste lue en direct pour l'instant, voir next steps) :
// l'appariement automatique des e-mails par fil de conversation ne fonctionne pas encore sur les reservations venant du PMS.
export async function pmsBookings(pmsPropertyId: string): Promise<Booking[]> {
  const r = await call(`/api/properties/${pmsPropertyId}/bookings`)
  const items: any[] = r?.items || []
  return items.map((b): Booking => ({
    id: Number(b.id),
    propertyId: Number(b.propertyId),
    arrival: String(b.arrival || ''),
    departure: String(b.departure || ''),
    guest: String(b.guest || ''),
    status: String(b.status || ''),
    source: String(b.source || ''),
    total: Number(b.total ?? 0) || 0,
    checkIn: typeof b.checkIn === 'string' ? b.checkIn : undefined,
    checkOut: typeof b.checkOut === 'string' ? b.checkOut : undefined,
    guestEmail: typeof b.guestEmail === 'string' ? b.guestEmail : undefined,
  }))
}

// Equivalent PMS de lodgify.ts::fetchProperties + fetchBookings, au meme format : ne garde que les logements PMS lies a
// Lodgify (lodgifyPropertyId), le reste de l'appli continue de raisonner en identifiant Lodgify (voir server/utils/logements.ts).
export async function pmsLoadData(): Promise<{ properties: Property[]; bookings: Booking[] }> {
  const props = (await pmsProperties()).filter(p => p.lodgifyPropertyId !== null)
  const bookingsByProperty = await Promise.all(props.map(p => pmsBookings(p.id)))
  return {
    properties: props.map((p): Property => ({
      id: p.lodgifyPropertyId!,
      name: p.name,
      original: p.lodgifyName || p.name,
      internalName: p.lodgifyName || undefined,
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
    })),
    bookings: bookingsByProperty.flat(),
  }
}

// Etat de la connexion, pour la page Réglages > Plugins (jamais de secret renvoyé au navigateur).
export async function pmsHealth(): Promise<{ configured: boolean; ok: boolean; error?: string }> {
  if (!pmsEnabled()) return { configured: false, ok: false }
  try {
    await pmsProperties()
    return { configured: true, ok: true }
  } catch (e: any) {
    return { configured: true, ok: false, error: e?.statusMessage || String(e) }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Tranches suivantes (conversation, prix, serrures/codes, domotique, documents, stock) : toujours derriere pmsEnabled().
// Le reste de l'appli raisonne en identifiant Lodgify du logement ; le PMS en uuid : pmsPropertyId fait la traduction.
// Aucune ecriture n'est faite en tache de fond : reponse au voyageur et envoi d'un code a la serrure uniquement sur clic.
// ---------------------------------------------------------------------------------------------------------------------

let idCache: { at: number; map: Map<number, string> } | null = null

// uuid Rocket PMS du logement lie a ce logement Lodgify (cache 60 s, comme loadData)
export async function pmsPropertyId(lodgifyPropertyId: number | null | undefined): Promise<string> {
  if (!idCache || Date.now() - idCache.at > 60 * 1000) {
    const map = new Map<number, string>()
    for (const p of await pmsProperties()) if (p.lodgifyPropertyId !== null) map.set(p.lodgifyPropertyId, p.id)
    idCache = { at: Date.now(), map }
  }
  const id = lodgifyPropertyId == null ? undefined : idCache.map.get(lodgifyPropertyId)
  if (!id) throw createError({ statusCode: 404, statusMessage: 'Logement absent de Rocket PMS' })
  return id
}

async function pmsCall(lodgifyPropertyId: number | null | undefined, path: string, init?: RequestInit): Promise<any> {
  return call(`/api/properties/${await pmsPropertyId(lodgifyPropertyId)}${path}`, init)
}

export interface PmsMessage { key: string; kind: 'lodgify'; from: 'host' | 'guest'; at: string; subject: string; text: string; status: string }

// Fil de conversation (deja converti en texte par le PMS : aucun HTML externe n'arrive au navigateur)
export async function pmsConversation(lodgifyPropertyId: number | null | undefined, bookingId: number): Promise<PmsMessage[]> {
  const r = await pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/conversation`)
  return (r?.messages || []).map((m: any): PmsMessage => ({
    key: String(m.key), kind: 'lodgify', from: m.from === 'host' ? 'host' : 'guest', at: String(m.at || ''),
    subject: String(m.subject || ''), text: String(m.text || ''), status: String(m.status || ''),
  }))
}

// Reponse au voyageur : appelee uniquement par le bouton Envoyer (messageId genere par le navigateur, envoi idempotent)
export async function pmsReply(lodgifyPropertyId: number | null | undefined, bookingId: number, text: string, messageId: string): Promise<void> {
  await pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/conversation`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, messageId }),
  })
}

export async function pmsPricing(lodgifyPropertyId: number | null | undefined, bookingId: number) {
  const r = await pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/pricing`)
  return {
    currency: String(r?.currency || 'EUR'), total: Number(r?.total ?? 0), paid: Number(r?.paid ?? 0), due: Number(r?.due ?? 0), nights: Number(r?.nights ?? 0),
    lines: (r?.lines || []).map((l: any) => ({ kind: String(l.kind || ''), label: String(l.label || ''), amount: Number(l.amount ?? 0) })) as { kind: string; label: string; amount: number }[],
  }
}

// Serrures de tous les logements PMS lies a Lodgify, au format Lock de l'appli (propertyId = identifiant Lodgify).
// Un logement pas encore lie a un lieu Rocket Place (409) est ignore : il n'a simplement pas de serrure.
export async function pmsLocks(): Promise<{ demo: boolean; locks: Lock[] }> {
  const props = (await pmsProperties()).filter(p => p.lodgifyPropertyId !== null)
  let demo = false
  const lists = await Promise.all(props.map(async (p) => {
    const r = await call(`/api/properties/${p.id}/locks`).catch(() => null)
    if (r?.demo) demo = true
    return (r?.locks || []).map((l: any): Lock => ({
      id: Number(l.id), propertyId: p.lodgifyPropertyId, name: String(l.name || ''), state: String(l.state || ''), locked: !!l.locked,
      battery: typeof l.battery === 'number' ? l.battery : null, batteryCritical: !!l.batteryCritical, keypadBatteryCritical: !!l.keypadBatteryCritical,
      logs: (l.logs || []).map((g: any) => ({ date: String(g.date), who: String(g.who || ''), action: Number(g.action), trigger: Number(g.trigger) })),
    }))
  }))
  return { demo, locks: lists.flat() }
}

export interface PmsCode {
  bookingId: number; propertyId: number; lockId: number; property: string; guest: string; source: string; arrival: string; departure: string
  code: string; validFrom: string; validUntil: string; status: string; error: string | null; outdated: boolean; grantId: string
}

// Codes clavier des sejours a venir, planifies par Rocket PMS / Rocket Place (source de verite quand le PMS est actif :
// la table locale access_code n'est alors ni lue ni ecrite). Meme format que codes.ts::planCodes.
export async function pmsCodes(): Promise<{ demo: boolean; items: PmsCode[] }> {
  const props = (await pmsProperties()).filter(p => p.lodgifyPropertyId !== null)
  let demo = false
  const lists = await Promise.all(props.map(async (p) => {
    const r = await call(`/api/properties/${p.id}/codes`).catch(() => null)
    if (r?.demo) demo = true
    return (r?.items || []).map((i: any): PmsCode => ({
      bookingId: Number(i.bookingId), propertyId: p.lodgifyPropertyId!, lockId: Number(i.lockId), property: p.name, guest: String(i.guest || ''),
      source: String(i.source || ''), arrival: String(i.arrival || ''), departure: String(i.departure || ''), code: String(i.code || ''),
      validFrom: String(i.validFrom || ''), validUntil: String(i.validUntil || ''), status: String(i.status || ''), error: i.error ? String(i.error) : null,
      outdated: !!i.outdated, grantId: String(i.grantId),
    }))
  }))
  return { demo, items: lists.flat().sort((a, b) => a.arrival.localeCompare(b.arrival)) }
}

// Ecrit le code d'une reservation sur la serrure (via PMS puis Rocket Place) : uniquement sur clic confirme.
export async function pmsSendCode(bookingId: number): Promise<{ ok: true }> {
  const item = (await pmsCodes()).items.find(i => i.bookingId === bookingId)
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Réservation inconnue, déjà commencée, ou sans serrure liée' })
  if (item.status === 'created') throw createError({ statusCode: 409, statusMessage: 'Code déjà créé sur la serrure' })
  await call(`/api/properties/${await pmsPropertyId(item.propertyId)}/access-grants/${item.grantId}/send`, { method: 'POST' })
  return { ok: true }
}

// Code clavier de chaque reservation d'un logement (onglet Réservations), tel que le PMS l'expose
export async function pmsAccessByBooking(lodgifyPropertyId: number | null | undefined) {
  const r = await pmsCall(lodgifyPropertyId, '/bookings')
  const map = new Map<number, { code: string; validFrom: string; validUntil: string; status: string; error: string | null }>()
  for (const b of r?.items || []) {
    const a = b.access
    if (a) map.set(Number(b.id), { code: String(a.code || ''), validFrom: String(a.validFrom || ''), validUntil: String(a.validUntil || ''), status: String(a.status || ''), error: a.error ? String(a.error) : null })
  }
  return map
}

export interface PmsDomotiqueSection { connectorId: string; name: string; pluginName: string; icon: string; error: string | null; cards: { title: string; icon: string; items: { label: string; value: string }[] }[] }

// Domotique du logement vue par Rocket Place (connecteurs du lieu), en lecture seule
export async function pmsDomotique(lodgifyPropertyId: number | null | undefined): Promise<PmsDomotiqueSection[]> {
  const r = await pmsCall(lodgifyPropertyId, '/domotique')
  return (r?.sections || []).map((s: any): PmsDomotiqueSection => ({
    connectorId: String(s.connectorId || ''), name: String(s.name || ''), pluginName: String(s.pluginName || ''), icon: String(s.icon || 'i-lucide-cpu'),
    error: s.error ? String(s.error) : null,
    cards: (s.cards || []).map((c: any) => ({ title: String(c.title || ''), icon: String(c.icon || 'i-lucide-cpu'), items: (c.items || []).map((i: any) => ({ label: String(i.label || ''), value: String(i.value ?? '') })) })),
  }))
}

export interface PmsDocument { id: string; kind: 'file' | 'folder'; name: string; size: number | null; updatedAt: string | null }

// Documents du lieu (Rocket Cloud via Rocket Place), lecture : dossier racine ou ?folder
export async function pmsDocuments(lodgifyPropertyId: number | null | undefined, folder?: string) {
  const r = await pmsCall(lodgifyPropertyId, `/documents${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`)
  return {
    folderId: String(r?.folderId || ''), rootFolderId: String(r?.rootFolderId || ''),
    items: (r?.items || []).map((i: any): PmsDocument => ({
      id: String(i.id), kind: i.kind === 'folder' ? 'folder' : 'file', name: String(i.name || ''),
      size: typeof i.size === 'number' ? i.size : null, updatedAt: typeof i.updatedAt === 'string' ? i.updatedAt : null,
    })),
  }
}

// Contenu brut d'un document (telechargement a la demande), plafonne a 50 Mo comme cote PMS
export async function pmsDocumentContent(lodgifyPropertyId: number | null | undefined, itemId: string): Promise<{ body: ArrayBuffer; type: string; disposition: string }> {
  const { url, token } = config()
  const res = await fetch(`${url}/api/properties/${await pmsPropertyId(lodgifyPropertyId)}/documents/${encodeURIComponent(itemId)}/content`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `Rocket PMS ${res.status} sur le document` })
  const body = await res.arrayBuffer()
  if (body.byteLength > 50 * 1024 * 1024) throw createError({ statusCode: 502, statusMessage: 'Document trop volumineux' })
  return { body, type: res.headers.get('content-type') || 'application/octet-stream', disposition: res.headers.get('content-disposition') || 'attachment' }
}

export interface PmsStockLine { levelId: string; itemId: string; name: string; subscription: boolean; level: 'ok' | 'low' | 'empty' }

// Stock du lieu : les articles suivis (niveau) et le reste du catalogue Rocket Place
export async function pmsStock(lodgifyPropertyId: number | null | undefined) {
  const r = await pmsCall(lodgifyPropertyId, '/stock')
  const items: any[] = r?.items || []
  const levels: any[] = r?.levels || []
  const itemIdOf = (iri: unknown) => String(iri || '').split('/').pop() || ''
  const tracked = new Set(levels.map(l => itemIdOf(l.item)))
  const lines = levels.map((l): PmsStockLine => {
    const it = items.find(i => String(i.id) === itemIdOf(l.item))
    return { levelId: String(l.id), itemId: itemIdOf(l.item), name: String(it?.name || '?'), subscription: !!it?.subscription, level: (['ok', 'low', 'empty'].includes(l.level) ? l.level : 'ok') }
  }).sort((a, b) => a.name.localeCompare(b.name))
  return { lines, available: items.filter(i => !tracked.has(String(i.id))).map(i => ({ id: String(i.id), name: String(i.name || '') })) }
}

export async function pmsSetStockLevel(lodgifyPropertyId: number | null | undefined, levelId: string, level: string) {
  if (!['ok', 'low', 'empty'].includes(level)) throw createError({ statusCode: 400, statusMessage: 'Niveau invalide' })
  await pmsCall(lodgifyPropertyId, `/stock/${encodeURIComponent(levelId)}`, {
    method: 'PATCH', headers: { 'content-type': 'application/merge-patch+json' }, body: JSON.stringify({ level }),
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Tranche 2 (feature/pms-v2) : livret d'accueil + écran TV, e-mails Rocket Mailer, bilan, ménages Rocket Place.
// Toujours derriere pmsEnabled(). Envois (livret, e-mail) uniquement sur clic confirme, jamais en tache de fond.
// ---------------------------------------------------------------------------------------------------------------------

// Lance une 404 propre quand le PMS n'est pas actif (les routes /pms-* n'ont alors pas de sens)
export function requirePms() {
  if (!pmsEnabled()) throw createError({ statusCode: 404, statusMessage: 'Rocket PMS non actif' })
}

const originOf = (u: unknown) => { try { return new URL(String(u)).origin } catch { return '' } }

// Livret du logement vu par le PMS : liens TV, date de maj, visites des 30 derniers jours, lien vers l'éditeur PMS
export async function pmsWelcomeBook(lodgifyPropertyId: number | null | undefined) {
  const uuid = await pmsPropertyId(lodgifyPropertyId)
  const [book, stats] = await Promise.all([
    call(`/api/properties/${uuid}/welcome-book`),
    call(`/api/properties/${uuid}/welcome-book/stats?days=30`).catch(() => null),
  ])
  const front = originOf(book?.tvUrl)
  const content = book?.content && typeof book.content === 'object' ? book.content : {}
  return {
    tvUrl: String(book?.tvUrl || ''),
    editorUrl: front ? `${front}/properties/${uuid}?tab=livret` : '',
    updatedAt: typeof book?.updatedAt === 'string' ? book.updatedAt : null,
    languages: Array.isArray(book?.languages) ? book.languages.map(String) : [],
    // aperçu en lecture des rubriques texte (l'édition se fait dans Rocket PMS)
    sections: Object.entries(content).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => ({ key: k, text: String(v).slice(0, 2000) })),
    visits: stats ? { days: Number(stats.days || 30), total: Number(stats.total || 0), links: (stats.links || []).map((l: any) => ({ link: String(l.link), bookingId: l.bookingId == null ? null : Number(l.bookingId), guest: l.guest ? String(l.guest) : null, total: Number(l.total || 0), lastDay: String(l.lastDay || '') })) } : null,
  }
}

// Lien voyageur d'une reservation (page /g/<token> du front PMS) + message par defaut
export async function pmsGuestLink(lodgifyPropertyId: number | null | undefined, bookingId: number) {
  const r = await pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/guest-link`)
  return { url: String(r?.url || ''), message: String(r?.message || ''), validFrom: r?.from ? String(r.from) : null, validUntil: r?.until ? String(r.until) : null }
}

// Envoi du lien au voyageur : uniquement sur clic confirme (messageId du navigateur, envoi idempotent cote PMS)
export async function pmsSendGuestLink(lodgifyPropertyId: number | null | undefined, bookingId: number, body: { channel: string; messageId: string; text?: string; lang?: string }) {
  return pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/guest-link/send`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

// E-mails Rocket Mailer rattaches a la reservation (par adresse du voyageur ou numero de reservation dans l'objet)
export async function pmsBookingEmails(lodgifyPropertyId: number | null | undefined, bookingId: number) {
  const r = await pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/emails`)
  return {
    demo: !!r?.demo, available: r?.available !== false, reason: r?.reason ? String(r.reason) : null, guestEmail: r?.guestEmail ? String(r.guestEmail) : null,
    conversations: (r?.conversations || []).map((c: any) => ({ id: String(c.id), subject: String(c.subject || ''), lastMessageAt: String(c.lastMessageAt || ''), snippet: String(c.snippet || ''), messageCount: Number(c.messageCount || 0), status: String(c.status || ''), matchedBy: String(c.matchedBy || '') })),
  }
}

export async function pmsBookingEmailThread(lodgifyPropertyId: number | null | undefined, bookingId: number, conversationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) throw createError({ statusCode: 400, statusMessage: 'Conversation invalide' })
  const r = await pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/emails/${conversationId}`)
  return {
    subject: String(r?.conversation?.subject || ''),
    messages: (r?.messages || []).map((m: any) => ({ key: String(m.key), from: m.from === 'host' ? 'host' : 'guest', at: String(m.at || ''), subject: String(m.subject || ''), text: String(m.text || ''), status: String(m.status || ''), fromAddress: String(m.fromAddress || '') })),
  }
}

export async function pmsSendBookingEmail(lodgifyPropertyId: number | null | undefined, bookingId: number, body: { subject: string; text: string; messageId: string }) {
  return pmsCall(lodgifyPropertyId, `/bookings/${bookingId}/emails`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

// Bilan annuel calcule par le PMS (revenus Lodgify + depenses saisies/importees dans Rocket PMS)
export async function pmsBilan(lodgifyPropertyId: number | null | undefined, year: number) {
  const uuid = await pmsPropertyId(lodgifyPropertyId)
  const r = await call(`/api/properties/${uuid}/bilan?year=${year}`)
  const n = (v: unknown) => Number(v ?? 0) || 0
  return {
    year: n(r?.year) || year, years: (r?.years || []).map(Number), demo: !!r?.demo, currency: String(r?.currency || 'EUR'),
    revenue: n(r?.revenue), nights: n(r?.nights), stays: n(r?.stays), occupancy: n(r?.occupancy), daysConsidered: n(r?.daysConsidered), since: r?.since ? String(r.since) : null,
    chargesTotal: n(r?.chargesTotal), otherIncome: n(r?.otherIncome), result: n(r?.result),
    months: (r?.months || []).map((m: any) => ({ label: String(m.label || ''), revenue: n(m.revenue), nights: n(m.nights), charges: n(m.charges), income: n(m.income), result: n(m.result) })),
    categories: (r?.categories || []).map((c: any) => ({ key: String(c.key), label: String(c.label || ''), kind: String(c.kind || ''), total: n(c.total), count: n(c.count) })),
    items: (r?.items || []).map((e: any) => ({ id: String(e.id), date: String(e.date || ''), amount: n(e.amount), categoryLabel: String(e.categoryLabel || ''), kind: String(e.kind || ''), note: e.note ? String(e.note) : '', source: e.source ? String(e.source) : '' })),
    editorUrl: '',
  }
}

export async function pmsBilanCsv(lodgifyPropertyId: number | null | undefined, year: number): Promise<{ body: string; disposition: string }> {
  const { url, token } = config()
  const res = await fetch(`${url}/api/properties/${await pmsPropertyId(lodgifyPropertyId)}/bilan.csv?year=${year}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw createError({ statusCode: 502, statusMessage: `Rocket PMS ${res.status} sur le bilan CSV` })
  const body = await res.text()
  if (body.length > MAX_BYTES) throw createError({ statusCode: 502, statusMessage: 'Bilan CSV trop volumineux' })
  return { body, disposition: res.headers.get('content-disposition') || `attachment; filename="bilan-${year}.csv"` }
}

// Menages (taches Rocket Place creees par le PMS apres chaque depart), lus dans la timeline du PMS (lecture seule).
// Le PMS n'expose pas encore le lien secret /m/<token> de Rocket Place : pas de lien direct pour l'instant.
export async function pmsCleanings(lodgifyPropertyId: number | null | undefined) {
  const r = await pmsCall(lodgifyPropertyId, '/timeline?past=14&future=60')
  return (r?.events || []).filter((e: any) => e.kind === 'cleaning').map((e: any) => ({ at: String(e.at), title: String(e.title || 'Ménage'), description: String(e.description || '') }))
}
