// Gestion des comptes par l'administrateur : creation, invitation (lien a usage unique), activation, garde-fous.
import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AuthUser, Role } from './auth'

export const ROLES: Role[] = ['admin', 'gestionnaire', 'comptable', 'menage']
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/
const EMAIL = /^[^\s@<>",;()[\]]+@[^\s@<>",;()[\]]+\.[^\s@<>",;()[\]]{2,}$/
const bad = (m: string, statusCode = 400) => createError({ statusCode, statusMessage: m })
const INVITE_MS = 72 * 3600_000 // invitation d'un nouveau compte
const RESET_MS = 24 * 3600_000 // reinitialisation d'un compte existant

export interface UserInput { username: string; displayName: string; email: string; role: Role; logements: number[] }

// Validation d'un compte envoye par le navigateur (creation ou modification)
export async function parseUserInput(b: Record<string, unknown>, current?: { username: string }): Promise<UserInput> {
  const username = String(b.username ?? current?.username ?? '').trim().toLowerCase()
  if (!current && !USERNAME.test(username)) throw bad('Identifiant : 3 à 40 caractères (lettres minuscules, chiffres, . _ -), commençant par une lettre ou un chiffre')
  const displayName = String(b.displayName ?? '').trim().slice(0, 80)
  if (!displayName) throw bad('Nom requis')
  const email = String(b.email ?? '').trim().toLowerCase()
  if (email && (!EMAIL.test(email) || email.length > 200)) throw bad('Adresse e-mail invalide')
  if (!ROLES.includes(b.role as Role)) throw bad('Rôle invalide')
  const raw = Array.isArray(b.logements) ? b.logements : []
  const ids = [...new Set(raw.map(Number))]
  if (ids.some(n => !Number.isInteger(n) || n <= 0)) throw bad('Logements invalides')
  const known = new Set((await ensureLogements()).map(l => l.id))
  if (ids.some(n => !known.has(n))) throw bad('Logement inconnu')
  return { username: current?.username ?? username, displayName, email, role: b.role as Role, logements: b.role === 'admin' ? [] : ids }
}

export async function listUsers() {
  const db = useDatabase()
  const users = (await db.sql`SELECT * FROM app_user ORDER BY username`).rows as any[]
  const links = (await db.sql`SELECT user_id, logement_id FROM user_logement`).rows as any[]
  return users.map(u => ({
    id: Number(u.id), username: String(u.username), displayName: String(u.display_name), email: String(u.email), role: String(u.role) as Role,
    active: !!Number(u.active), pending: !u.password_hash, mustChange: !!Number(u.must_change), defaultPassword: !!Number(u.default_password),
    lastLoginAt: u.last_login_at ? String(u.last_login_at) : null, createdAt: String(u.created_at),
    logements: links.filter(l => Number(l.user_id) === Number(u.id)).map(l => Number(l.logement_id)),
  }))
}

export async function getUserRow(idParam: unknown) {
  const id = Number(idParam)
  const r = Number.isInteger(id) ? ((await useDatabase().sql`SELECT * FROM app_user WHERE id = ${id}`).rows as any[])[0] : undefined
  if (!r) throw bad('Utilisateur introuvable', 404)
  return r
}

export async function setUserLogements(userId: number, ids: number[]) {
  const db = useDatabase()
  await db.sql`DELETE FROM user_logement WHERE user_id = ${userId}`
  for (const id of ids) await db.sql`INSERT INTO user_logement (user_id, logement_id) VALUES (${userId}, ${id})`
}

// Garde-fou : il doit toujours rester au moins un administrateur actif et pret a se connecter (mot de passe defini)
export async function assertAnotherAdmin(exceptUserId: number) {
  const n = Number(((await useDatabase().sql`SELECT COUNT(*) AS n FROM app_user WHERE role = 'admin' AND active = 1 AND password_hash != '' AND id != ${exceptUserId}`).rows as any[])[0].n)
  if (!n) throw bad('Il doit rester au moins un administrateur actif', 409)
}
export function assertNotSelf(me: AuthUser, id: number, what: string) {
  if (me.id === id) throw bad(`Tu ne peux pas ${what} ton propre compte`, 409)
}

// --- Invitations ---
const sha = (t: string) => createHash('sha256').update(t).digest('hex')

// Cree un jeton neuf (les anciens jetons non utilises du compte sont annules) ; renvoie le jeton EN CLAIR, a n'afficher qu'une fois
export async function createInvitation(userId: number, createdBy: number | null, opts: { ttlMs?: number } = {}) {
  const db = useDatabase()
  const u = await getUserRow(userId)
  const purpose = u.password_hash ? 'reset' : 'invite'
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? (purpose === 'invite' ? INVITE_MS : RESET_MS))).toISOString()
  const now = new Date().toISOString()
  await db.sql`UPDATE user_token SET used_at = ${now} WHERE user_id = ${userId} AND used_at IS NULL`
  await db.sql`INSERT INTO user_token (user_id, token_hash, purpose, expires_at, created_by, created_at) VALUES (${userId}, ${sha(token)}, ${purpose}, ${expiresAt}, ${createdBy}, ${now})`
  return { token, purpose: purpose as 'invite' | 'reset', expiresAt }
}

export const invitationLink = (event: H3Event, token: string) => `${getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin}/activation?token=${encodeURIComponent(token)}`

async function findToken(token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const r = ((await useDatabase().sql`SELECT t.*, u.username, u.display_name, u.active FROM user_token t JOIN app_user u ON u.id = t.user_id WHERE t.token_hash = ${sha(token)}`).rows as any[])[0]
  if (!r || r.used_at || Date.parse(String(r.expires_at)) < Date.now() || !Number(r.active)) return null
  return r
}

// Limite les essais de jetons par adresse (les jetons font 256 bits : la limite protege surtout contre le bruit et les sondages)
const fails = new Map<string, number[]>()
function limit(event: H3Event) {
  const ip = String(getRequestIP(event, { xForwardedFor: true }) ?? 'inconnue')
  const recent = (fails.get(ip) ?? []).filter(t => Date.now() - t < 10 * 60_000)
  if (recent.length >= 20) throw bad('Trop d\'essais : réessaie dans quelques minutes', 429)
  return { fail: () => fails.set(ip, [...recent, Date.now()]) }
}

export async function inspectToken(event: H3Event, token: unknown) {
  const l = limit(event)
  const r = await findToken(token)
  if (!r) { l.fail(); throw bad('Lien invalide, expiré ou déjà utilisé', 404) }
  return { username: String(r.username), displayName: String(r.display_name), purpose: String(r.purpose) }
}

export async function activate(event: H3Event, token: unknown, password: unknown) {
  const l = limit(event)
  const r = await findToken(token)
  if (!r) { l.fail(); throw bad('Lien invalide, expiré ou déjà utilisé', 404) }
  const pw = checkNewPassword(password, String(r.username))
  const db = useDatabase()
  // usage unique : la mise a jour du jeton ne reussit qu'une fois, meme si deux requetes arrivent ensemble
  const used = await db.sql`UPDATE user_token SET used_at = ${new Date().toISOString()} WHERE id = ${Number(r.id)} AND used_at IS NULL`
  if (!Number((used as any).changes ?? 1)) throw bad('Lien déjà utilisé', 409)
  await db.sql`UPDATE app_user SET password_hash = ${await hashPassword(pw)}, must_change = 0, default_password = 0, failed_count = 0, locked_until = NULL,
    session_version = session_version + 1, password_changed_at = ${new Date().toISOString()} WHERE id = ${Number(r.user_id)}`
  await audit(event, r.purpose === 'invite' ? 'compte_active' : 'mot_de_passe_reinitialise', '', { id: Number(r.user_id), username: String(r.username) })
  return { username: String(r.username) }
}

export async function invitationEmail(event: H3Event, to: { displayName: string; username: string; email: string }, link: string, purpose: 'invite' | 'reset', from: string) {
  const { subject, text } = accountEmail(purpose, { displayName: to.displayName, username: to.username, link, from })
  return sendMail({ to: [to.email], subject, text }, { dryRun: process.env.LH_MAIL_DRYRUN === '1', noSentCopy: true }) // le lien secret ne reste pas dans « Envoyes »
}

// --- Mot de passe oublie (libre-service, page publique) ---
// Reponse TOUJOURS identique et immediate (le travail se fait en arriere-plan) : on ne peut pas deviner quels comptes existent.
const FORGOT_TTL_MS = 3600_000 // 1 heure
const FORGOT_COOLDOWN_MS = 5 * 60_000 // pas de nouveau lien pour un compte pendant 5 minutes
const FORGOT_IP_MAX = 5, FORGOT_GLOBAL_MAX = 30 // demandes par adresse / 10 min ; e-mails au total par heure
const forgotIp = new Map<string, number[]>()
let forgotSent: number[] = []

export async function requestPasswordReset(event: H3Event, raw: unknown) {
  const ident = typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 200) : ''
  if (!ident) throw bad('Saisis ton identifiant ou ton adresse e-mail')
  const ip = String(getRequestIP(event, { xForwardedFor: true }) ?? 'inconnue')
  const recent = (forgotIp.get(ip) ?? []).filter(t => Date.now() - t < 10 * 60_000)
  if (recent.length >= FORGOT_IP_MAX) throw bad('Trop de demandes : réessaie dans quelques minutes', 429)
  forgotIp.set(ip, [...recent, Date.now()])
  const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
  // Suite en arriere-plan ; jamais d'erreur renvoyee au navigateur (le journal, lui, dit ce qui s'est passe)
  void (async () => {
    const note = (action: string, detail = '', u?: { id: number; username: string }) => audit(event, action, detail, u)
    let target: { id: number; username: string } | undefined // compte concerne, pour le journal en cas d'echec
    try {
      const db = useDatabase()
      let rows = (await db.sql`SELECT * FROM app_user WHERE username = ${ident}`).rows as any[]
      if (!rows.length && ident.includes('@')) rows = (await db.sql`SELECT * FROM app_user WHERE email = ${ident} AND email != ''`).rows as any[]
      if (rows.length !== 1) return void await note('oubli_demande', rows.length ? 'adresse partagée par plusieurs comptes : aucun envoi' : `compte inconnu (${ident.includes('@') ? 'adresse' : 'identifiant'})`)
      const u = rows[0]
      const who = { id: Number(u.id), username: String(u.username) }
      target = who
      if (!Number(u.active)) return void await note('oubli_demande', 'compte désactivé : aucun envoi', who)
      if (!u.password_hash) return void await note('oubli_demande', 'invitation en attente : l\'administrateur doit renvoyer le lien', who)
      if (!u.email) return void await note('oubli_demande', 'pas d\'adresse e-mail : l\'administrateur doit générer le lien', who)
      const last = ((await db.sql`SELECT created_at FROM user_token WHERE user_id = ${who.id} AND purpose = 'reset' ORDER BY id DESC LIMIT 1`).rows as any[])[0]
      if (last && Date.now() - Date.parse(String(last.created_at)) < FORGOT_COOLDOWN_MS) return void await note('oubli_demande', 'demande trop rapprochée : aucun envoi', who)
      forgotSent = forgotSent.filter(t => Date.now() - t < 3600_000)
      if (forgotSent.length >= FORGOT_GLOBAL_MAX) return void await note('oubli_demande', 'plafond horaire d\'e-mails atteint : aucun envoi', who)
      const inv = await createInvitation(who.id, null, { ttlMs: FORGOT_TTL_MS })
      const link = `${origin}/activation?token=${encodeURIComponent(inv.token)}`
      const { subject, text } = accountEmail('forgot', { displayName: String(u.display_name), username: who.username, link })
      forgotSent.push(Date.now())
      await sendMail({ to: [String(u.email)], subject, text }, { dryRun: process.env.LH_MAIL_DRYRUN === '1', noSentCopy: true })
      await note('oubli_envoye', 'lien de réinitialisation envoyé par e-mail', who)
    } catch (e: any) { await note('oubli_echec', `envoi impossible : ${e?.statusMessage || e?.message || 'erreur'}`.slice(0, 200), target) }
  })()
  return { ok: true }
}
