// Connexion d'une boite Google / Microsoft par OAuth (« Se connecter avec Google / Microsoft ») pour une boite geree par Rocket Host
// (IMAP / SMTP en XOAUTH2). Identifiants de l'application : Reglages > Connexions > Connexions directes (GOOGLE_MAIL_CLIENT_ID /
// GOOGLE_MAIL_CLIENT_SECRET, MICROSOFT_MAIL_…). Le jeton de renouvellement est un secret chiffre MAILBOX_<id>_REFRESH_TOKEN ;
// le jeton d'acces (1 h) reste en memoire seulement. Aucun jeton ne sort vers le navigateur.
import { randomBytes } from 'node:crypto'

export type OAuthProvider = 'google' | 'microsoft'
export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'microsoft']

const tenant = () => getSetting('MICROSOFT_MAIL_TENANT') || 'common'
export const OAUTH = {
  google: {
    label: 'Google', clientId: 'GOOGLE_MAIL_CLIENT_ID', clientSecret: 'GOOGLE_MAIL_CLIENT_SECRET',
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: () => 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/ openid email', extra: { access_type: 'offline', prompt: 'consent' } as Record<string, string>,
    imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true }, provider: 'google',
  },
  microsoft: {
    label: 'Microsoft', clientId: 'MICROSOFT_MAIL_CLIENT_ID', clientSecret: 'MICROSOFT_MAIL_CLIENT_SECRET',
    authUrl: () => `https://login.microsoftonline.com/${encodeURIComponent(tenant())}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${encodeURIComponent(tenant())}/oauth2/v2.0/token`,
    scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access openid email',
    extra: { prompt: 'select_account' } as Record<string, string>,
    imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false }, provider: 'microsoft',
  },
} as const

export const isOAuthProvider = (p: unknown): p is OAuthProvider => p === 'google' || p === 'microsoft'
/** Application OAuth renseignee (identifiant + secret) : sinon le bouton affiche « à configurer ». */
export const oauthConfigured = (p: OAuthProvider) => !!getSetting(OAUTH[p].clientId) && hasSecret(OAUTH[p].clientSecret)

// Etats OAuth en attente (anti-CSRF) : 10 minutes, usage unique, lies a l'utilisateur qui a lance la connexion
const pending = new Map<string, { provider: OAuthProvider; userId: number; redirectUri: string; at: number }>()
const STATE_TTL = 10 * 60_000

export function oauthStartUrl(p: OAuthProvider, userId: number, redirectUri: string, loginHint = '') {
  for (const [k, v] of pending) if (Date.now() - v.at > STATE_TTL) pending.delete(k)
  const state = randomBytes(24).toString('base64url')
  pending.set(state, { provider: p, userId, redirectUri, at: Date.now() })
  const q = new URLSearchParams({ client_id: getSetting(OAUTH[p].clientId), redirect_uri: redirectUri, response_type: 'code', scope: OAUTH[p].scope, state, ...OAUTH[p].extra })
  if (loginHint) q.set('login_hint', loginHint)
  return `${OAUTH[p].authUrl()}?${q}`
}

export function takeOAuthState(state: string, p: OAuthProvider, userId: number) {
  const s = pending.get(state)
  pending.delete(state)
  if (!s || s.provider !== p || s.userId !== userId || Date.now() - s.at > STATE_TTL) return null
  return s
}

async function tokenCall(p: OAuthProvider, params: Record<string, string>) {
  const res = await fetch(OAUTH[p].tokenUrl(), {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ client_id: getSetting(OAUTH[p].clientId), client_secret: getSecret(OAUTH[p].clientSecret), ...params }),
    signal: AbortSignal.timeout(15_000),
  })
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) throw new Error(`${OAUTH[p].label} a refusé la connexion${j.error_description ? ` : ${String(j.error_description).slice(0, 160)}` : j.error ? ` (${j.error})` : ''}`)
  return j as { access_token: string; refresh_token?: string; expires_in?: number; id_token?: string }
}

// Adresse e-mail du compte : champ « email » du jeton d'identite (recu directement du fournisseur en TLS, donc pas de verification de signature)
const emailFromIdToken = (idToken?: string) => {
  try { const p = JSON.parse(Buffer.from(String(idToken).split('.')[1]!, 'base64url').toString('utf8')); return String(p.email || p.preferred_username || '').toLowerCase() } catch { return '' }
}

const tokens = new Map<number, { token: string; exp: number }>()
export const cachedMailAccessToken = (mailboxId: number) => { const t = tokens.get(mailboxId); return t && t.exp > Date.now() ? t.token : '' }

/** Echange le code de retour OAuth : { email, refreshToken, accessToken }. */
export async function exchangeOAuthCode(p: OAuthProvider, code: string, redirectUri: string) {
  const j = await tokenCall(p, { grant_type: 'authorization_code', code, redirect_uri: redirectUri })
  if (!j.refresh_token) throw new Error(`${OAUTH[p].label} n'a pas fourni de jeton de renouvellement (accès hors ligne refusé ?)`)
  const email = emailFromIdToken(j.id_token)
  if (!email) throw new Error(`${OAUTH[p].label} n'a pas communiqué l'adresse e-mail du compte`)
  return { email, refreshToken: j.refresh_token, accessToken: j.access_token, expiresIn: Number(j.expires_in || 3600) }
}

export function rememberAccessToken(mailboxId: number, token: string, expiresIn: number) {
  tokens.set(mailboxId, { token, exp: Date.now() + Math.max(60, expiresIn - 120) * 1000 })
}

/** Renouvelle le jeton d'acces d'une boite OAuth s'il expire dans moins de 2 minutes. */
export async function refreshMailAccessToken(mailboxId: number) {
  if (cachedMailAccessToken(mailboxId)) return cachedMailAccessToken(mailboxId)
  const row = ((await useDatabase().sql`SELECT source FROM mailbox_account WHERE id = ${mailboxId}`).rows as any[])[0]
  const p = row?.source
  if (!isOAuthProvider(p)) throw new Error('boîte OAuth introuvable')
  const refresh = getSecret(`MAILBOX_${mailboxId}_REFRESH_TOKEN`)
  if (!refresh) throw new Error('jeton de renouvellement absent : reconnecte la boîte')
  const j = await tokenCall(p, { grant_type: 'refresh_token', refresh_token: refresh })
  if (j.refresh_token && j.refresh_token !== refresh) await setSecret(`MAILBOX_${mailboxId}_REFRESH_TOKEN`, j.refresh_token) // rotation (Microsoft)
  rememberAccessToken(mailboxId, j.access_token, Number(j.expires_in || 3600))
  return j.access_token
}
