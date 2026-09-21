// Authentification : comptes, mots de passe (scrypt), sessions par cookie chiffre (h3), verrouillage, journal d'audit.
// Voir docs/plan-gestion-utilisateurs.md. Aucun mot de passe par defaut n'est accepte en production (demarrage refuse).
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { H3Event } from 'h3'

export type Role = 'admin' | 'gestionnaire' | 'comptable' | 'menage'
export interface AuthUser { id: number; username: string; displayName: string; email: string; role: Role; mustChange: boolean }

const N = 16384, R = 8, P = 1, KEYLEN = 64
const scrypt = (pw: string, salt: Buffer, opts = { N, r: R, p: P }) => new Promise<Buffer>((ok, ko) => scryptCb(pw, salt, KEYLEN, opts, (e, k) => (e ? ko(e) : ok(k))))

export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${(await scrypt(pw, salt)).toString('base64')}`
}
export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !key) return false
  const expected = Buffer.from(key, 'base64')
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) })
  return got.length === expected.length && timingSafeEqual(got, expected)
}
let dummy: Promise<string> | null = null // meme cout de calcul quand l'identifiant n'existe pas (pas de difference de temps)
const dummyHash = () => (dummy ??= hashPassword(randomBytes(12).toString('hex')))

// Regles de production appliquees aussi quand LH_STRICT_AUTH=1 (par exemple sur un serveur de test)
export const isStrict = () => process.env.NODE_ENV === 'production' || process.env.LH_STRICT_AUTH === '1'
const WEAK = new Set(['admin', 'password', 'motdepasse', '123456789012', 'azertyuiop12', 'changeme'])
export function checkNewPassword(pw: unknown, username: string) {
  const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })
  if (typeof pw !== 'string' || pw.length < 12) throw bad('Le mot de passe doit faire au moins 12 caractères')
  if (pw.length > 200) throw bad('Mot de passe trop long')
  if (WEAK.has(pw.toLowerCase()) || pw.toLowerCase().includes(username.toLowerCase())) throw bad('Mot de passe trop facile à deviner (ne pas y mettre l\'identifiant)')
  return pw
}

// --- Compte de depart ---
// Developpement : admin / admin (changement de mot de passe obligatoire a la premiere connexion).
// Production : ADMIN_INITIAL_PASSWORD obligatoire (12 caracteres au moins), et refus de demarrer si un mot de passe par defaut subsiste.
export async function ensureAdmin() {
  const db = useDatabase()
  const count = Number(((await db.sql`SELECT COUNT(*) AS n FROM app_user`).rows as any[])[0].n)
  const now = new Date().toISOString()
  if (count === 0) {
    if (isStrict()) {
      const pw = process.env.ADMIN_INITIAL_PASSWORD || ''
      if (pw.length < 12 || WEAK.has(pw.toLowerCase())) throw new Error('Démarrage refusé : définis ADMIN_INITIAL_PASSWORD (12 caractères au moins, pas un mot de passe courant) pour créer le compte admin.')
      await db.sql`INSERT INTO app_user (username, display_name, role, password_hash, must_change, default_password, created_at) VALUES ('admin', 'Administrateur', 'admin', ${await hashPassword(pw)}, 1, 0, ${now})`
    } else {
      await db.sql`INSERT INTO app_user (username, display_name, role, password_hash, must_change, default_password, created_at) VALUES ('admin', 'Administrateur', 'admin', ${await hashPassword('admin')}, 1, 1, ${now})`
    }
  }
  if (isStrict()) {
    const risky = Number(((await db.sql`SELECT COUNT(*) AS n FROM app_user WHERE default_password = 1 AND active = 1`).rows as any[])[0].n)
    if (risky) throw new Error('Démarrage refusé : un compte utilise encore un mot de passe par défaut. Change-le (en développement) avant de mettre en ligne.')
  }
}

// --- Journal d'audit ---
export async function audit(event: H3Event | null, action: string, detail = '', user?: { id?: number | null; username?: string }) {
  try {
    await useDatabase().sql`INSERT INTO audit_log (at, user_id, username, action, detail, ip) VALUES (${new Date().toISOString()}, ${user?.id ?? null}, ${user?.username ?? ''}, ${action}, ${detail.slice(0, 300)}, ${event ? String(getRequestIP(event, { xForwardedFor: true }) ?? '') : ''})`
  } catch { /* le journal ne doit jamais bloquer une action */ }
}

// --- Sessions (cookie chiffre, HttpOnly, SameSite=Lax, Secure derriere HTTPS) ---
const ABSOLUTE_MS = 12 * 3600_000 // duree maximale d'une session
const IDLE_MS = 2 * 3600_000 // expiration apres inactivite
let secretCache: string | null = null
async function sessionSecret() {
  if (secretCache) return secretCache
  const fromEnv = process.env.SESSION_SECRET
  if (fromEnv && fromEnv.length >= 32) return (secretCache = fromEnv)
  const file = resolve(process.cwd(), '.data', 'session-secret')
  try { secretCache = (await readFile(file, 'utf8')).trim() } catch { /* a creer */ }
  if (!secretCache || secretCache.length < 32) {
    secretCache = randomBytes(48).toString('base64url')
    await mkdir(resolve(process.cwd(), '.data'), { recursive: true })
    await writeFile(file, secretCache, { mode: 0o600 })
    await chmod(file, 0o600)
  }
  return secretCache
}
async function session(event: H3Event) {
  const secure = getRequestURL(event, { xForwardedProto: true }).protocol === 'https:'
  return useSession<{ uid?: number; sv?: number; iat?: number; seen?: number }>(event, {
    password: await sessionSecret(), name: 'lh_session', maxAge: ABSOLUTE_MS / 1000, cookie: { httpOnly: true, sameSite: 'lax', secure, path: '/' },
  })
}
const toUser = (r: any): AuthUser => ({ id: Number(r.id), username: String(r.username), displayName: String(r.display_name || r.username), email: String(r.email), role: r.role as Role, mustChange: !!Number(r.must_change) })

// Utilisateur de la session en cours (null si absente, expiree, revoquee ou compte desactive)
export async function currentUser(event: H3Event): Promise<AuthUser | null> {
  if (event.context.authUser !== undefined) return event.context.authUser
  const s = await session(event)
  const d = s.data
  let user: AuthUser | null = null
  const now = Date.now()
  if (d.uid && d.iat && d.seen && now - d.iat < ABSOLUTE_MS && now - d.seen < IDLE_MS) {
    const r = ((await useDatabase().sql`SELECT * FROM app_user WHERE id = ${d.uid}`).rows as any[])[0]
    if (r && Number(r.active) && Number(r.session_version) === d.sv) {
      user = toUser(r)
      if (now - d.seen > 5 * 60_000) await s.update({ seen: now }) // renouvelle l'horloge d'inactivite au plus toutes les 5 minutes
    }
  }
  if (!user && d.uid) await s.clear()
  event.context.authUser = user
  return user
}

export async function startSession(event: H3Event, r: any) {
  const s = await session(event)
  await s.clear()
  const now = Date.now()
  await s.update({ uid: Number(r.id), sv: Number(r.session_version), iat: now, seen: now })
}
export async function endSession(event: H3Event) { await (await session(event)).clear() }

// --- Connexion : limitation par adresse et verrouillage par compte ---
const ipFails = new Map<string, number[]>()
const IP_MAX = 10, IP_WINDOW = 10 * 60_000, LOCK_AFTER = 5, LOCK_MS = 15 * 60_000

export async function login(event: H3Event, usernameRaw: unknown, password: unknown) {
  const generic = () => createError({ statusCode: 401, statusMessage: 'Identifiant ou mot de passe incorrect (ou compte temporairement verrouillé)' })
  const ip = String(getRequestIP(event, { xForwardedFor: true }) ?? 'inconnue')
  const recent = (ipFails.get(ip) ?? []).filter(t => Date.now() - t < IP_WINDOW)
  if (recent.length >= IP_MAX) throw createError({ statusCode: 429, statusMessage: 'Trop d\'essais depuis cette adresse : réessaie dans quelques minutes' })
  const username = typeof usernameRaw === 'string' ? usernameRaw.trim().slice(0, 80) : ''
  if (!username || typeof password !== 'string' || !password || password.length > 200) throw generic()
  const db = useDatabase()
  const r = ((await db.sql`SELECT * FROM app_user WHERE username = ${username}`).rows as any[])[0]
  const locked = r?.locked_until && Date.parse(String(r.locked_until)) > Date.now()
  const ok = await verifyPassword(password, r?.password_hash ?? await dummyHash())
  if (!r || !Number(r.active) || locked || !ok) {
    ipFails.set(ip, [...recent, Date.now()])
    if (r) {
      const n = Number(r.failed_count) + 1
      if (n >= LOCK_AFTER) await db.sql`UPDATE app_user SET failed_count = 0, locked_until = ${new Date(Date.now() + LOCK_MS).toISOString()} WHERE id = ${r.id}`
      else await db.sql`UPDATE app_user SET failed_count = ${n} WHERE id = ${r.id}`
    }
    await audit(event, 'connexion_echec', locked ? 'compte verrouillé' : '', { id: r?.id ? Number(r.id) : null, username })
    throw generic()
  }
  // Filet de securite : en production, un compte encore en mot de passe par defaut ne peut pas se connecter
  if (isStrict() && Number(r.default_password)) throw createError({ statusCode: 403, statusMessage: 'Ce compte utilise un mot de passe par défaut : connexion refusée en production' })
  await db.sql`UPDATE app_user SET failed_count = 0, locked_until = NULL, last_login_at = ${new Date().toISOString()} WHERE id = ${r.id}`
  ipFails.delete(ip)
  await startSession(event, r)
  await audit(event, 'connexion', '', { id: Number(r.id), username: String(r.username) })
  return toUser(r)
}

export async function changePassword(event: H3Event, user: AuthUser, current: unknown, next: unknown) {
  const db = useDatabase()
  const r = ((await db.sql`SELECT * FROM app_user WHERE id = ${user.id}`).rows as any[])[0]
  if (typeof current !== 'string' || !(await verifyPassword(current, String(r.password_hash)))) {
    await audit(event, 'mot_de_passe_echec', 'mot de passe actuel incorrect', user)
    throw createError({ statusCode: 400, statusMessage: 'Mot de passe actuel incorrect' })
  }
  const pw = checkNewPassword(next, user.username)
  if (pw === current) throw createError({ statusCode: 400, statusMessage: 'Le nouveau mot de passe doit être différent de l\'ancien' })
  await db.sql`UPDATE app_user SET password_hash = ${await hashPassword(pw)}, must_change = 0, default_password = 0, session_version = session_version + 1, password_changed_at = ${new Date().toISOString()} WHERE id = ${user.id}`
  const fresh = ((await db.sql`SELECT * FROM app_user WHERE id = ${user.id}`).rows as any[])[0]
  await startSession(event, fresh) // les autres sessions sont invalidees, celle-ci continue
  await audit(event, 'mot_de_passe_change', '', user)
  return toUser(fresh)
}
