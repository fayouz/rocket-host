// Rocket Auth (authentification unique de la suite Rocket, OpenID Connect). Voir docs/rocket-auth.md.
// Actif seulement quand ROCKET_AUTH_URL est renseigne ; sinon rien ne change (connexion locale seule).
// Flux : code d'autorisation + PKCE (S256), state et nonce dans un cookie chiffre de courte duree, jeton d'identite verifie
// avec les cles publiques (JWKS, RS256) par le module crypto de Node (aucune dependance ajoutee).
// Le secret client est l'identite de l'appli aupres de Rocket Auth : il reste dans .env pour l'instant (phase 2 : coffre de secrets du compte).
import { createHash, createPublicKey, randomBytes, verify as cryptoVerify } from 'node:crypto'
import type { H3Event } from 'h3'
import type { Role } from './auth'

type Jwk = { kty?: string; kid?: string; [k: string]: unknown }
const b64url = (b: Buffer) => b.toString('base64url')
const env = (k: string) => (process.env[k] ?? '').trim()

export interface RocketAuthConfig { issuer: string; clientId: string; clientSecret: string; adminGroup: string; autoCreate: boolean; roleGroups: Record<string, Role>; defaultRole: Role | null; appsUrl: string; redirectUri: string }

export const rocketAuthEnabled = () => !!env('ROCKET_AUTH_URL')
// Connexion locale (identifiant + mot de passe) : gardee par defaut pendant la transition ; ROCKET_LOCAL_LOGIN=0 la coupe quand Rocket Auth est actif
export const localLoginAllowed = () => !rocketAuthEnabled() || !['0', 'false', 'non', 'no'].includes(env('ROCKET_LOCAL_LOGIN').toLowerCase())

const ROLES: Role[] = ['admin', 'gestionnaire', 'comptable', 'menage']
// ROCKET_AUTH_ROLE_GROUPS="gestionnaire=lh-gestion,comptable=lh-compta|compta,menage=lh-menage"
export function parseRoleGroups(raw: string): Record<string, Role> {
  const out: Record<string, Role> = {}
  for (const part of raw.split(/[,;]/)) {
    const [role, groups] = part.split('=').map(s => s?.trim() ?? '')
    if (!role || !groups || !ROLES.includes(role as Role)) continue
    for (const g of groups.split('|').map(s => s.trim()).filter(Boolean)) out[g] = role as Role
  }
  return out
}

export function rocketAuthConfig(event?: H3Event): RocketAuthConfig {
  const issuer = env('ROCKET_AUTH_URL').replace(/\/+$/, '')
  const origin = event ? getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin : ''
  const def = env('ROCKET_AUTH_DEFAULT_ROLE') as Role
  return {
    issuer,
    clientId: env('ROCKET_AUTH_CLIENT_ID') || 'loussahousing',
    clientSecret: env('ROCKET_AUTH_CLIENT_SECRET'),
    adminGroup: env('ROCKET_AUTH_ADMIN_GROUP') || 'rocket-admins',
    autoCreate: ['1', 'true', 'oui', 'yes'].includes(env('ROCKET_AUTH_AUTOCREATE').toLowerCase()),
    roleGroups: parseRoleGroups(env('ROCKET_AUTH_ROLE_GROUPS')),
    defaultRole: ROLES.includes(def) ? def : null,
    appsUrl: env('ROCKET_AUTH_APPS_URL') || `${issuer}/api/suite/apps`,
    redirectUri: env('ROCKET_AUTH_REDIRECT_URI') || `${origin}/api/auth/rocket/callback`,
  }
}

// Role d'apres les groupes : groupe admin d'abord, puis le role le plus fort trouve dans ROCKET_AUTH_ROLE_GROUPS ; null si aucun
export function roleFromGroups(groups: unknown, cfg: Pick<RocketAuthConfig, 'adminGroup' | 'roleGroups'>): Role | null {
  const list = Array.isArray(groups) ? groups.map(String) : []
  if (list.includes(cfg.adminGroup)) return 'admin'
  const found = list.map(g => cfg.roleGroups[g]).filter(Boolean) as Role[]
  return ROLES.find(r => found.includes(r)) ?? null
}

// --- Decouverte et cles (en cache 10 minutes) ---
interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string; end_session_endpoint?: string; userinfo_endpoint?: string }
let disco: { at: number; issuer: string; d: Discovery } | null = null
let jwks: { at: number; keys: Jwk[] } | null = null
const TTL = 10 * 60_000

export async function rocketDiscovery(): Promise<Discovery> {
  const issuer = rocketAuthConfig().issuer
  if (disco && disco.issuer === issuer && Date.now() - disco.at < TTL) return disco.d
  const d = await $fetch<Discovery>(`${issuer}/.well-known/openid-configuration`, { timeout: 8000 })
  if (d.issuer.replace(/\/+$/, '') !== issuer) throw new Error('Rocket Auth : l\'émetteur annoncé ne correspond pas à ROCKET_AUTH_URL')
  disco = { at: Date.now(), issuer, d }
  return d
}
async function keys(force = false) {
  if (!force && jwks && Date.now() - jwks.at < TTL) return jwks.keys
  const r = await $fetch<{ keys: any[] }>((await rocketDiscovery()).jwks_uri, { timeout: 8000 })
  jwks = { at: Date.now(), keys: r.keys ?? [] }
  return jwks.keys
}

// --- Verification d'un JWT RS256 (signature, emetteur, audience, dates) ---
export function decodeJwt(token: string) {
  const parts = String(token).split('.')
  if (parts.length !== 3) throw new Error('JWT mal formé')
  const [h, p, s] = parts as [string, string, string]
  return { header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')), payload: JSON.parse(Buffer.from(p, 'base64url').toString('utf8')), signingInput: `${h}.${p}`, signature: Buffer.from(s, 'base64url') }
}
export function verifyJwtWithKeys(token: string, jwkList: Jwk[], opts: { issuer: string; audience: string; typ?: string; now?: number; leeway?: number }) {
  const { header, payload, signingInput, signature } = decodeJwt(token)
  if (header.alg !== 'RS256') throw new Error('Algorithme de signature refusé')
  if (opts.typ && String(header.typ ?? '').toLowerCase() !== opts.typ) throw new Error('Type de jeton inattendu')
  const candidates = jwkList.filter(k => k.kty === 'RSA' && (!header.kid || k.kid === header.kid))
  const ok = candidates.some(k => cryptoVerify('RSA-SHA256', Buffer.from(signingInput), createPublicKey({ key: k as any, format: 'jwk' }), signature))
  if (!ok) throw new Error('Signature invalide')
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const leeway = opts.leeway ?? 60
  if (String(payload.iss).replace(/\/+$/, '') !== opts.issuer) throw new Error('Émetteur invalide')
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(opts.audience)) throw new Error('Audience invalide')
  if (typeof payload.exp !== 'number' || payload.exp + leeway < now) throw new Error('Jeton expiré')
  if (typeof payload.iat === 'number' && payload.iat - leeway > now) throw new Error('Jeton daté du futur')
  return payload as Record<string, any>
}
export async function verifyRocketJwt(token: string, opts: { typ?: string } = {}) {
  const cfg = rocketAuthConfig()
  const { header } = decodeJwt(token)
  let list = await keys()
  if (header.kid && !list.some(k => k.kid === header.kid)) list = await keys(true) // rotation de cle
  return verifyJwtWithKeys(token, list, { issuer: cfg.issuer, audience: cfg.clientId, typ: opts.typ })
}

// --- PKCE et etat de la demande (cookie chiffre, 10 minutes) ---
export const pkceChallenge = (verifier: string) => b64url(createHash('sha256').update(verifier).digest())
const randomToken = () => b64url(randomBytes(32))

async function pending(event: H3Event) {
  const secure = getRequestURL(event, { xForwardedProto: true }).protocol === 'https:'
  return useSession<{ state?: string; nonce?: string; verifier?: string; next?: string; at?: number }>(event, {
    password: await sessionSecret(), name: 'lh_oidc', maxAge: 600, cookie: { httpOnly: true, sameSite: 'lax', secure, path: '/api/auth/rocket' },
  })
}
export const safeNextPath = (n: unknown) => { const s = String(n ?? ''); return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/connexion') && !s.startsWith('/api/') ? s : '/' }

export async function rocketAuthorizeUrl(event: H3Event, next: unknown) {
  const cfg = rocketAuthConfig(event)
  const d = await rocketDiscovery()
  const state = randomToken(), nonce = randomToken(), verifier = randomToken()
  const s = await pending(event)
  await s.clear()
  await s.update({ state, nonce, verifier, next: safeNextPath(next), at: Date.now() })
  const u = new URL(d.authorization_endpoint)
  u.search = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: 'openid profile email groups', state, nonce, code_challenge: pkceChallenge(verifier), code_challenge_method: 'S256' }).toString()
  return u.toString()
}

// Retour de Rocket Auth : verifie state, echange le code, verifie le jeton d'identite, associe le compte local, ouvre la session
export async function handleCallback(event: H3Event) {
  const q = getQuery(event)
  const s = await pending(event)
  const p = s.data
  await s.clear() // usage unique
  if (q.error) throw createError({ statusCode: 401, statusMessage: `Rocket Auth a refusé la connexion (${String(q.error).slice(0, 60)})` })
  if (!p.state || !p.verifier || !p.at || Date.now() - p.at > 600_000 || typeof q.state !== 'string' || q.state !== p.state || typeof q.code !== 'string')
    throw createError({ statusCode: 400, statusMessage: 'Demande de connexion expirée ou invalide : recommence' })
  const cfg = rocketAuthConfig(event)
  const d = await rocketDiscovery()
  const tokens = await $fetch<{ id_token?: string }>(d.token_endpoint, {
    method: 'POST', timeout: 10000,
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString('base64')}` },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: q.code, redirect_uri: cfg.redirectUri, code_verifier: p.verifier }).toString(),
  }).catch(() => { throw createError({ statusCode: 502, statusMessage: 'Rocket Auth : échange du code refusé' }) })
  if (!tokens.id_token) throw createError({ statusCode: 502, statusMessage: 'Rocket Auth : pas de jeton d\'identité' })
  let claims: Record<string, any>
  try { claims = await verifyRocketJwt(tokens.id_token) } catch (e: any) { throw createError({ statusCode: 401, statusMessage: `Jeton d'identité refusé : ${e?.message ?? ''}` }) }
  if (claims.nonce !== p.nonce) throw createError({ statusCode: 401, statusMessage: 'Jeton d\'identité refusé : nonce' })
  const row = await linkRocketAccount(event, claims, cfg)
  await startSession(event, row, { sso: 1 })
  await audit(event, 'connexion', 'Rocket Auth', { id: Number(row.id), username: String(row.username) })
  return p.next || '/'
}

// Association : lien sub deja connu, sinon e-mail identique (insensible a la casse), sinon creation si ROCKET_AUTH_AUTOCREATE=1
export async function linkRocketAccount(event: H3Event | null, claims: Record<string, any>, cfg: RocketAuthConfig) {
  const db = useDatabase()
  const sub = String(claims.sub ?? '')
  const email = String(claims.email ?? '').trim().toLowerCase()
  if (!sub) throw createError({ statusCode: 401, statusMessage: 'Jeton sans identifiant (sub)' })
  const refuse = async (why: string) => { await audit(event, 'connexion_echec', `Rocket Auth : ${why}`, { username: email || sub }); return createError({ statusCode: 403, statusMessage: why }) }
  const role = roleFromGroups(claims.groups, cfg)
  let r = ((await db.sql`SELECT u.* FROM rocket_auth_link l JOIN app_user u ON u.id = l.user_id WHERE l.sub = ${sub}`).rows as any[])[0]
  if (!r && email) {
    if (claims.email_verified === false) throw await refuse('Adresse e-mail non vérifiée dans Rocket Auth')
    r = ((await db.sql`SELECT * FROM app_user WHERE lower(email) = ${email}`).rows as any[])[0]
  }
  const now = new Date().toISOString()
  if (!r) {
    if (!cfg.autoCreate) throw await refuse('Aucun compte Rocket Host pour cette adresse e-mail (demande à un administrateur de t\'en créer un)')
    const newRole = role ?? cfg.defaultRole
    if (!newRole) throw await refuse('Aucun rôle Rocket Host pour tes groupes Rocket Auth')
    if (!email) throw await refuse('Rocket Auth n\'a pas transmis d\'adresse e-mail')
    const base = String(claims.preferred_username || email.split('@')[0]).replace(/[^\w.-]/g, '').slice(0, 60) || 'utilisateur'
    let username = base
    for (let i = 2; ((await db.sql`SELECT 1 FROM app_user WHERE username = ${username}`).rows as any[]).length; i++) username = `${base}${i}`
    await db.sql`INSERT INTO app_user (username, display_name, email, role, password_hash, must_change, default_password, created_at) VALUES (${username}, ${String(claims.name || username).slice(0, 120)}, ${email}, ${newRole}, '', 0, 0, ${now})`
    r = ((await db.sql`SELECT * FROM app_user WHERE username = ${username}`).rows as any[])[0]
    await audit(event, 'utilisateur_cree', `Rocket Auth (${newRole})`, { id: Number(r.id), username })
  } else if (role && role !== r.role) {
    await db.sql`UPDATE app_user SET role = ${role} WHERE id = ${r.id}` // les groupes Rocket Auth font foi quand ils donnent un role
    r.role = role
  }
  if (!Number(r.active)) throw await refuse('Compte Rocket Host désactivé')
  await db.sql`INSERT INTO rocket_auth_link (sub, user_id, linked_at, last_sid) VALUES (${sub}, ${r.id}, ${now}, ${claims.sid ?? null}) ON CONFLICT(sub) DO UPDATE SET user_id = excluded.user_id, last_sid = excluded.last_sid`
  await db.sql`UPDATE app_user SET failed_count = 0, locked_until = NULL, last_login_at = ${now} WHERE id = ${r.id}`
  return r
}

// Deconnexion a l'initiative de l'appli : adresse de fin de session Rocket Auth (null si indisponible)
export async function endSessionUrl(event: H3Event) {
  try {
    const d = await rocketDiscovery()
    if (!d.end_session_endpoint) return null
    const cfg = rocketAuthConfig(event)
    const u = new URL(d.end_session_endpoint)
    const back = env('ROCKET_AUTH_POST_LOGOUT_URI') || `${getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin}/connexion?logged_out=1`
    u.search = new URLSearchParams({ client_id: cfg.clientId, post_logout_redirect_uri: back }).toString()
    return u.toString()
  } catch { return null }
}

// Back-channel logout : Rocket Auth previent que l'utilisateur s'est deconnecte (ou que son compte est desactive).
// Les sessions locales sont des cookies chiffres : on les invalide toutes pour ce compte (session_version + 1).
const seenJti = new Map<string, number>()
export async function handleBackchannel(logoutToken: unknown) {
  if (typeof logoutToken !== 'string' || !logoutToken) throw createError({ statusCode: 400, statusMessage: 'logout_token manquant' })
  let c: Record<string, any>
  try { c = await verifyRocketJwt(logoutToken, { typ: 'logout+jwt' }) } catch (e: any) { throw createError({ statusCode: 400, statusMessage: `logout_token refusé : ${e?.message ?? ''}` }) }
  if (!c.events || typeof c.events !== 'object' || !('http://schemas.openid.net/event/backchannel-logout' in c.events)) throw createError({ statusCode: 400, statusMessage: 'logout_token sans événement' })
  if ('nonce' in c) throw createError({ statusCode: 400, statusMessage: 'logout_token avec nonce' })
  if (!c.sub && !c.sid) throw createError({ statusCode: 400, statusMessage: 'logout_token sans sub ni sid' })
  const now = Date.now()
  for (const [k, t] of seenJti) if (now - t > 600_000) seenJti.delete(k)
  if (c.jti) { if (seenJti.has(c.jti)) return { ok: true, replay: true }; seenJti.set(c.jti, now) }
  const db = useDatabase()
  const rows = (c.sub
    ? (await db.sql`SELECT user_id FROM rocket_auth_link WHERE sub = ${String(c.sub)}`).rows
    : (await db.sql`SELECT user_id FROM rocket_auth_link WHERE last_sid = ${String(c.sid)}`).rows) as any[]
  for (const r of rows) {
    await db.sql`UPDATE app_user SET session_version = session_version + 1 WHERE id = ${r.user_id}`
    await audit(null, 'deconnexion', 'Rocket Auth (back-channel)', { id: Number(r.user_id) })
  }
  return { ok: true, sessions: rows.length }
}

// Applications de la suite (selecteur) : GET /api/suite/apps de Rocket Auth, en cache 60 s ; liste vide si indisponible
export interface SuiteApps { apps: { id: string; name: string; url: string; icon?: string; description?: string }[]; account?: string | null }
let appsCache: { at: number; data: SuiteApps } | null = null
export async function suiteApps(): Promise<SuiteApps> {
  if (!rocketAuthEnabled()) return { apps: [], account: null }
  if (appsCache && Date.now() - appsCache.at < 60_000) return appsCache.data
  try {
    const r: any = await $fetch<any>(rocketAuthConfig().appsUrl as string, { timeout: 5000 })
    const apps: SuiteApps['apps'] = (Array.isArray(r?.apps) ? r.apps : []).filter((a: any) => a && typeof a.url === 'string' && /^https?:\/\//.test(a.url))
      .map((a: any) => ({ id: String(a.id ?? ''), name: String(a.name ?? a.id ?? ''), url: String(a.url), icon: typeof a.icon === 'string' && a.icon.startsWith('i-') ? a.icon : 'i-lucide-app-window', description: a.description ? String(a.description) : '' }))
    const data: SuiteApps = { apps, account: typeof r?.account === 'string' && /^https?:\/\//.test(r.account) ? r.account : undefined }
    appsCache = { at: Date.now(), data }
    return data
  } catch { return { apps: [], account: null } }
}
