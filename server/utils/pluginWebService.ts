// Plugin « Service web » : brancher n'importe quelle API HTTP par simple configuration (aucun code a ecrire).
// - Infos : GET d'une adresse qui renvoie du JSON ; les valeurs simples sont affichees (40 au plus).
// - Actions manuelles : une par ligne « Libelle | METHODE | /chemin », toujours confirmees dans l'interface.
// - Documents : GET d'une adresse qui renvoie une liste JSON de fichiers ({ url, name?, id?, date? }) ; chaque fichier est
//   telecharge et depose dans l'explorateur du logement (sans doublon).
// Garde-fous : http/https seulement, pas de redirection, delai de 15 s, taille limitee, configuration reservee a l'administrateur.
import type { ConnectorContext, PluginDef, RemoteDocument } from './plugins'
import { isPrivateHost } from './plugins'
import { CATEGORIES, isCategory, MAX_SIZE } from './documents'

const TIMEOUT = 15_000
const MAX_JSON = 1024 * 1024 // 1 Mo
const MAX_DOCS = 50
const RUN_BYTES = 100 * 1024 * 1024 // 100 Mo au plus par recuperation de documents
const RUN_MS = 3 * 60_000 // 3 min au plus par recuperation

const fail = (statusCode: number, statusMessage: string) => createError({ statusCode, statusMessage })

function checkUrl(raw: string, label: string) {
  let u: URL
  try { u = new URL(raw) } catch { throw fail(400, `« ${label} » : adresse invalide`) }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw fail(400, `« ${label} » : seules les adresses http(s) sont acceptées`)
  if (u.username || u.password) throw fail(400, `« ${label} » : pas d'identifiants dans l'adresse (utilise l'authentification)`)
  return u
}

// Adresse d'une requete, toujours sur le MEME hote que l'adresse de base (jamais un autre site).
// fromConfig : chemin saisi dans la configuration (« /status ») = a la suite de l'adresse de base ;
// sinon (adresse renvoyee par le service, ex. url d'un fichier) : resolution normale d'une adresse web.
function target(ctx: ConnectorContext, path: string, fromConfig = true) {
  const base = checkUrl(ctx.config.baseUrl ?? '', 'Adresse de base')
  const root = base.href.endsWith('/') ? base.href : `${base.href}/`
  const u = new URL(fromConfig && path.startsWith('/') && !path.startsWith('//') ? path.slice(1) : path, root)
  if (u.host !== base.host || u.protocol !== base.protocol) throw fail(400, `L'adresse ${u.origin} n'est pas celle du service configuré`)
  return u
}

function authHeaders(ctx: ConnectorContext): Record<string, string> {
  const mode = ctx.config.authType || 'none'
  if (mode === 'none') return {}
  // Un secret ne part jamais en clair (http) sur Internet : seulement en https, ou en http vers le reseau local
  const base = checkUrl(ctx.config.baseUrl ?? '', 'Adresse de base')
  if (base.protocol === 'http:' && !isPrivateHost(base.hostname)) throw fail(400, 'Authentification refusée en http vers Internet : utilise une adresse https')
  const secret = ctx.secret('secretVar')
  if (mode === 'bearer') return { authorization: `Bearer ${secret}` }
  if (mode === 'basic') return { authorization: `Basic ${Buffer.from(secret).toString('base64')}` } // variable au format utilisateur:motdepasse
  const name = (ctx.config.authHeader || '').trim()
  if (!/^[A-Za-z0-9-]{1,60}$/.test(name)) throw fail(400, 'Nom d\'en-tête d\'authentification invalide')
  return { [name]: secret }
}

async function request(ctx: ConnectorContext, method: string, path: string, max: number, fromConfig = true) {
  const url = target(ctx, path, fromConfig)
  let res: Response
  try {
    res = await fetch(url, { method, headers: { accept: 'application/json, */*', ...authHeaders(ctx) }, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT) })
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw fail(502, e?.name === 'TimeoutError' ? `Le service ne répond pas (${TIMEOUT / 1000} s)` : 'Service injoignable (adresse ou réseau à vérifier)')
  }
  if (!res.ok) { await res.body?.cancel().catch(() => {}); throw fail(502, `Le service a répondu avec l'erreur ${res.status}`) }
  if (Number(res.headers.get('content-length') || 0) > max) { await res.body?.cancel().catch(() => {}); throw fail(502, 'Réponse trop volumineuse') }
  // Lecture par morceaux avec plafond : on s'arrete des que la taille maximale est depassee (meme sans Content-Length)
  const chunks: Uint8Array[] = []
  let total = 0
  if (res.body) {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > max) { await reader.cancel().catch(() => {}); throw fail(502, 'Réponse trop volumineuse') }
      chunks.push(value)
    }
  }
  return { buf: Buffer.concat(chunks), type: res.headers.get('content-type') || '', url }
}

async function getJson(ctx: ConnectorContext, path: string) {
  const { buf } = await request(ctx, 'GET', path, MAX_JSON)
  try { return JSON.parse(buf.toString('utf8')) } catch { throw fail(502, 'La réponse du service n\'est pas du JSON') }
}

// Valeurs simples d'un objet JSON, a plat (a.b.c = valeur), pour l'affichage
function flatten(v: unknown, prefix = '', out: { label: string; value: string }[] = [], depth = 0) {
  if (out.length >= 40 || depth > 10) return out
  if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out.push({ label: prefix || 'valeur', value: String(v).slice(0, 200) })
  else if (Array.isArray(v)) { for (const [i, x] of v.slice(0, 20).entries()) { if (out.length >= 40) break; flatten(x, `${prefix}[${i}]`, out, depth + 1) } }
  else if (typeof v === 'object') { for (const [k, x] of Object.entries(v as object)) { if (out.length >= 40) break; flatten(x, prefix ? `${prefix}.${k}` : k, out, depth + 1) } }
  return out
}

function parseActions(raw: string) {
  return raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 20).map((line, i) => {
    const [label, method, path] = line.split('|').map(s => s.trim())
    return { id: `a${i}`, label: label || `Action ${i + 1}`, method: (method || 'POST').toUpperCase(), path: path || '' }
  })
}

export const webServicePlugin: PluginDef = {
  id: 'webservice',
  name: 'Service web',
  description: 'Brancher n\'importe quelle API web (REST/JSON) : afficher des informations, lancer des actions, récupérer des documents dans l\'explorateur.',
  icon: 'i-lucide-globe',
  category: 'general',
  capabilities: ['info', 'actions', 'documents'],
  fields: [
    { key: 'baseUrl', label: 'Adresse de base', type: 'url', required: true, placeholder: 'https://api.exemple.fr/v1' },
    { key: 'authType', label: 'Authentification', type: 'select', options: [
      { label: 'Aucune', value: 'none' }, { label: 'Jeton (Bearer)', value: 'bearer' }, { label: 'En-tête personnalisé', value: 'header' }, { label: 'Identifiant:mot de passe (Basic)', value: 'basic' },
    ] },
    { key: 'authHeader', label: 'Nom de l\'en-tête', type: 'text', placeholder: 'X-Api-Key', showIf: { key: 'authType', values: ['header'] } },
    { key: 'secretVar', label: 'Nom du secret', type: 'secret', placeholder: 'CONNECTOR_MON_SERVICE', help: 'Nom du secret (CONNECTOR_…) dont tu saisis la valeur dans Réglages › Connexions (jamais la valeur ici).', showIf: { key: 'authType', values: ['bearer', 'header', 'basic'] } },
    { key: 'infoPath', label: 'Informations : chemin (GET, JSON)', type: 'text', placeholder: '/status' },
    { key: 'actions', label: 'Actions manuelles (une par ligne)', type: 'textarea', placeholder: 'Relancer | POST | /jobs/sync', help: 'Format : Libellé | MÉTHODE | /chemin. Chaque action demande confirmation.' },
    { key: 'documentsPath', label: 'Documents : chemin de la liste (GET, JSON)', type: 'text', placeholder: '/invoices', help: 'Doit renvoyer une liste [{ "url": "…", "name": "…", "id": "…", "date": "AAAA-MM-JJ" }].' },
    { key: 'documentsType', label: 'Type des documents importés', type: 'select', default: 'autre_doc', options: Object.entries(CATEGORIES).map(([value, c]) => ({ label: c.label, value })) },
  ],
  async validate(config) {
    checkUrl(config.baseUrl ?? '', 'Adresse de base')
    for (const a of parseActions(config.actions ?? '')) {
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(a.method)) throw fail(400, `Action « ${a.label} » : méthode ${a.method} non prise en charge`)
      if (!a.path) throw fail(400, `Action « ${a.label} » : chemin manquant`)
    }
    if (config.documentsType && !isCategory(config.documentsType)) throw fail(400, 'Type de document invalide')
    return config
  },
  async test(ctx) {
    const path = ctx.config.infoPath || ctx.config.documentsPath || '/'
    const { url } = await request(ctx, 'GET', path, MAX_JSON)
    return `Le service répond (${url.host}${url.pathname}).`
  },
  async info(ctx) {
    if (!ctx.config.infoPath) return []
    const json = await getJson(ctx, ctx.config.infoPath)
    return [{ title: 'Informations du service', icon: 'i-lucide-info', items: flatten(json) }]
  },
  actions(ctx) {
    return parseActions(ctx.config.actions ?? '').map(a => ({ id: a.id, label: a.label, confirm: `${a.method} ${a.path}` }))
  },
  async runAction(ctx, actionId) {
    const a = parseActions(ctx.config.actions ?? '').find(x => x.id === actionId)
    if (!a) throw fail(404, 'Action inconnue')
    await request(ctx, a.method, a.path, MAX_JSON)
    return `« ${a.label} » exécutée.`
  },
  async documents(ctx) {
    if (!ctx.config.documentsPath) throw fail(400, 'Aucun chemin de documents configuré')
    const list = await getJson(ctx, ctx.config.documentsPath)
    if (!Array.isArray(list)) throw fail(502, 'La liste de documents doit être un tableau JSON')
    const out: RemoteDocument[] = []
    const started = Date.now()
    let bytes = 0
    for (const d of list.slice(0, MAX_DOCS)) {
      if (!d || typeof d.url !== 'string') continue
      // Budget par recuperation (taille totale et duree) : le reste sera recupere au prochain clic (sans doublon)
      if (bytes > RUN_BYTES || Date.now() - started > RUN_MS) { out.push({ externalId: String(d.id ?? d.url), filename: String(d.name || d.url).slice(0, 80), error: 'limite de la récupération atteinte, relance pour la suite' }); continue }
      const fallback = typeof d.name === 'string' && d.name ? d.name : String(d.url).split('/').pop() || 'document'
      try {
        const { buf, url } = await request(ctx, 'GET', d.url, MAX_SIZE, false)
        const name = typeof d.name === 'string' && d.name ? d.name : decodeURIComponent(url.pathname.split('/').pop() || 'document')
        const date = typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d.date) ? d.date.slice(0, 10) : undefined
        bytes += buf.length
        out.push({ externalId: String(d.id ?? url.pathname), filename: name, data: buf, date })
      } catch (e: any) { out.push({ externalId: String(d.id ?? d.url), filename: fallback, error: e?.statusMessage || 'échec' }) }
    }
    return out
  },
}
