// Boites e-mail configurees (Reglages > Boites e-mail, assistant « Ajouter une boite e-mail »).
// - La boite principale (is_primary) est celle d'imap_config : releve des pieces jointes, synchro de l'ecran E-mails et envoi
//   restent lus par le code existant (imap.ts, mail.ts, smtp.ts). Locale : mot de passe IMAP_PASSWORD ; Google / Microsoft : XOAUTH2.
// - Les autres boites Locale / Google / Microsoft sont enregistrees et testables ; leur releve viendra ensuite.
// - Les boites Rocket Mailer (partagee / perso) sont relevees par Mailer lui-meme : Host garde seulement la reference.
// - Releve desactive par defaut : rien n'est lu ni envoye tant que l'utilisateur ne l'active pas.
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import type { OAuthProvider } from './mailOAuth'
import type { MailerBox } from './mailer'

export type MailboxSource = 'local' | 'google' | 'microsoft' | 'mailer-shared' | 'mailer-personal'
export const MAILBOX_SOURCES: MailboxSource[] = ['local', 'google', 'microsoft', 'mailer-shared', 'mailer-personal']
export interface ServerCfg { provider: string; host: string; port: number; secure: boolean; smtpHost: string; smtpPort: number; smtpSecure: boolean; user: string }

const row = (r: any) => ({
  id: Number(r.id), source: String(r.source) as MailboxSource, label: String(r.label), email: String(r.email), primary: !!Number(r.is_primary),
  enabled: !!Number(r.enabled), status: String(r.status), createdAt: String(r.created_at), config: (() => { try { return JSON.parse(String(r.config || '{}')) } catch { return {} } })(),
})
export type Mailbox = ReturnType<typeof row>

export async function listMailboxes() {
  const cfg = await getImapConfig()
  // Boite configuree par l'ancien formulaire apres la migration : elle devient l'entree « Locale » principale
  if (cfg.user && !(await hasPrimary())) await useDatabase().sql`INSERT INTO mailbox_account (source, label, email, is_primary, created_at) VALUES ('local', 'Boîte principale', ${cfg.user}, 1, ${now()})`
  const rows = ((await useDatabase().sql`SELECT * FROM mailbox_account ORDER BY is_primary DESC, id`).rows as any[]).map(row)
  return rows.map((m) => {
    const secretName = m.source === 'local' ? (m.primary ? 'IMAP_PASSWORD' : `MAILBOX_${m.id}_PASSWORD`) : m.source === 'google' || m.source === 'microsoft' ? `MAILBOX_${m.id}_REFRESH_TOKEN` : ''
    const base = { id: m.id, source: m.source, label: m.label, email: m.email, primary: m.primary, createdAt: m.createdAt, mailerId: m.config.mailerId ?? null,
      credential: secretName ? secretStatus(secretName) : null }
    // La principale reflete imap_config (etat du releve et de la synchro existants)
    if (m.primary) return { ...base, email: cfg.user || m.email, enabled: cfg.enabled, syncMail: cfg.syncMail, status: cfg.lastResult || m.status, lastRunAt: cfg.lastRunAt, host: cfg.host }
    return { ...base, enabled: m.enabled, syncMail: false, status: m.status, lastRunAt: null, host: String(m.config.host ?? '') }
  })
}

export async function getMailbox(id: number) {
  const r = ((await useDatabase().sql`SELECT * FROM mailbox_account WHERE id = ${id}`).rows as any[])[0]
  return r ? row(r) : null
}

// --- Validation d'une configuration serveur (meme regles que PUT /api/imap/config)
const HOST = /^[a-z0-9]([a-z0-9.-]{1,98})[a-z0-9]$/
export function validateServer(b: any): ServerCfg {
  const bad = (m: string) => createError({ statusCode: 400, statusMessage: m })
  const provider = getProvider(b?.provider) ?? getProvider('custom')!
  let host = String(b?.host ?? '').trim().toLowerCase(), port = Number(b?.port), secure = b?.secure
  if (provider.key !== 'custom') {
    port = provider.port; secure = provider.secure
    if (provider.hostPattern) { if (!new RegExp(provider.hostPattern).test(host)) throw bad(`Serveur invalide pour ce service (ex. ${provider.host})`) } else host = provider.host
  }
  const preset = SMTP_PRESETS[provider.key]
  let smtpHost = String(b?.smtpHost ?? '').trim().toLowerCase(), smtpPort = Number(b?.smtpPort), smtpSecure = b?.smtpSecure
  if (preset) { smtpPort = preset.port; smtpSecure = preset.secure; smtpHost = preset.sameAsImap ? host : preset.host }
  const user = String(b?.user ?? '').trim()
  if (!HOST.test(host) || !host.includes('.')) throw bad('Serveur IMAP invalide (ex. ssl0.ovh.net)')
  if (!HOST.test(smtpHost) || !smtpHost.includes('.')) throw bad('Serveur d\'envoi (SMTP) invalide')
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw bad('Port invalide')
  if (typeof secure !== 'boolean' || typeof smtpSecure !== 'boolean') throw bad('Sécurité (TLS) invalide')
  if (!user || user.length > 120 || /\p{Cc}/u.test(user)) throw bad('Identifiant invalide')
  return { provider: provider.key, host, port, secure, smtpHost, smtpPort, smtpSecure, user }
}

/** Traduit une erreur IMAP / SMTP / reseau en message clair (francais), sans jamais inclure de secret. */
export function mailErrorFr(e: any, what: 'IMAP' | 'SMTP'): string {
  const code = String(e?.code || ''), txt = String(e?.responseText || e?.response || e?.message || e)
  const srv = what === 'IMAP' ? 'serveur de réception (IMAP)' : 'serveur d\'envoi (SMTP)'
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /getaddrinfo/i.test(txt)) return `Le ${srv} est introuvable : vérifie son adresse.`
  if (code === 'ECONNREFUSED') return `Le ${srv} refuse la connexion : vérifie le port et la sécurité (TLS / STARTTLS).`
  if (code === 'ETIMEDOUT' || code === 'ETIMEOUT' || code === 'ECONNRESET' || /timeout|timed out/i.test(txt)) return `Le ${srv} ne répond pas (délai dépassé) : port ou pare-feu ?`
  if (/certificate|self.signed|CERT_|SSL|wrong version number/i.test(`${code} ${txt}`)) return `Connexion sécurisée impossible avec le ${srv} : certificat ou mode TLS incorrect.`
  if (code === 'EAUTH' || e?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|authentication failed|535|LOGIN failed|Username and Password not accepted/i.test(txt))
    return `Identifiant ou mot de passe refusé par le ${srv}. Certains services exigent un « mot de passe d'application ».`
  return `Échec avec le ${srv} : ${txt.replace(/\s+/g, ' ').slice(0, 160)}`
}

type Auth = { pass: string } | { accessToken: string }
async function tryImap(c: ServerCfg, auth: Auth) {
  const client = new ImapFlow({ host: c.host, port: c.port, secure: c.secure, ...(c.secure ? {} : { doSTARTTLS: true }), auth: { user: c.user, ...auth },
    logger: false, tls: { rejectUnauthorized: true }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 } as any)
  client.on('error', () => {})
  try {
    await client.connect()
    const folders = (await client.list()).map(f => f.path)
    return { ok: true as const, folders: folders.length }
  } catch (e) { return { ok: false as const, error: mailErrorFr(e, 'IMAP') } } finally { await client.logout().catch(() => {}) }
}
async function trySmtp(c: ServerCfg, auth: Auth) {
  const t = nodemailer.createTransport(<any>{ host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, requireTLS: !c.smtpSecure,
    auth: 'pass' in auth ? { user: c.user, pass: auth.pass } : { type: 'OAuth2', user: c.user, accessToken: auth.accessToken },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000, tls: { rejectUnauthorized: true } })
  try { await t.verify(); return { ok: true as const } } catch (e) { return { ok: false as const, error: mailErrorFr(e, 'SMTP') } } finally { t.close() }
}

/** Test IMAP + SMTP d'une configuration saisie dans l'assistant (mot de passe transmis pour le test, jamais stocke ici). Aucun message envoye ni lu. */
export async function testServerConfig(c: ServerCfg, password: string) {
  if (!password) return { ok: false, imap: { ok: false, error: 'Mot de passe manquant' }, smtp: { ok: false, error: 'Mot de passe manquant' } }
  const [imap, smtp] = await Promise.all([tryImap(c, { pass: password }), trySmtp(c, { pass: password })])
  return { ok: imap.ok && smtp.ok, imap, smtp }
}

/** Test d'une boite enregistree (Locale / Google / Microsoft : IMAP + SMTP ; Mailer : endpoint de test de Mailer). */
export async function testSavedMailbox(id: number, userEmail: string) {
  const m = await getMailbox(id)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'Boîte introuvable' })
  let out: { ok: boolean; imap?: any; smtp?: any; message?: string }
  if (m.source === 'mailer-shared' || m.source === 'mailer-personal') {
    try { const j = await mailerTest(userEmail, String(m.config.mailerId)); out = { ok: j?.ok !== false, message: String(j?.message || (j?.ok === false ? 'Test refusé par Rocket Mailer' : 'Test réussi dans Rocket Mailer')) } }
    catch (e: any) { out = { ok: false, message: e.message } }
  } else {
    let c: ServerCfg, auth: Auth
    if (m.primary) {
      const cfg = await getImapConfig()
      c = { provider: cfg.provider, host: cfg.host, port: cfg.port, secure: cfg.secure, smtpHost: cfg.smtpHost, smtpPort: cfg.smtpPort, smtpSecure: cfg.smtpSecure, user: cfg.user }
    } else c = m.config as ServerCfg
    if (m.source === 'local') auth = { pass: getSecret(m.primary ? 'IMAP_PASSWORD' : `MAILBOX_${m.id}_PASSWORD`) }
    else {
      try { auth = { accessToken: await refreshMailAccessToken(m.id) } }
      catch (e: any) { return saveStatus(m.id, { ok: false, message: `Connexion ${m.source === 'google' ? 'Google' : 'Microsoft'} : ${e.message}` }) }
    }
    if ('pass' in auth && !auth.pass) out = { ok: false, message: 'Mot de passe non renseigné' }
    else { const [imap, smtp] = await Promise.all([tryImap(c, auth), trySmtp(c, auth)]); out = { ok: imap.ok && smtp.ok, imap, smtp } }
  }
  return saveStatus(m.id, out)
}
async function saveStatus<T extends { ok: boolean; message?: string; imap?: any; smtp?: any }>(id: number, out: T) {
  const s = out.ok ? `Test réussi le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}` : `Échec du test : ${out.message || out.imap?.error || out.smtp?.error || ''}`
  await useDatabase().sql`UPDATE mailbox_account SET status = ${s.slice(0, 300)} WHERE id = ${id}`
  return out
}

const now = () => new Date().toISOString()
const hasPrimary = async () => !!((await useDatabase().sql`SELECT id FROM mailbox_account WHERE is_primary = 1`).rows as any[]).length

// Ecrit la configuration serveur dans imap_config (boite principale) SANS toucher au releve (enabled reste tel quel : desactive par defaut)
async function writePrimary(c: ServerCfg, authMailboxId: number) {
  await useDatabase().sql`UPDATE imap_config SET provider = ${c.provider}, host = ${c.host}, port = ${c.port}, secure = ${c.secure ? 1 : 0}, user = ${c.user},
    smtp_host = ${c.smtpHost}, smtp_port = ${c.smtpPort}, smtp_secure = ${c.smtpSecure ? 1 : 0}, auth_mailbox_id = ${authMailboxId}, enabled = 0, sync_mail = 0,
    last_uid = 0, uid_validity = 0, sent_folder = '', spam_folder = '' WHERE id = 1`
}

/** Cree une boite Locale. Premiere boite Host : elle devient la principale (imap_config + IMAP_PASSWORD). */
export async function createLocalMailbox(c: ServerCfg, password: string, label: string) {
  const db = useDatabase()
  const primary = !(await hasPrimary())
  await db.sql`INSERT INTO mailbox_account (source, label, email, is_primary, enabled, config, created_at)
    VALUES ('local', ${label}, ${c.user}, ${primary ? 1 : 0}, 0, ${JSON.stringify(primary ? {} : c)}, ${now()})`
  const id = Number(((await db.sql`SELECT MAX(id) AS id FROM mailbox_account`).rows[0] as any).id)
  if (primary) { await setSecret('IMAP_PASSWORD', password); await writePrimary(c, 0) }
  else await setSecret(`MAILBOX_${id}_PASSWORD`, password)
  return id
}

/** Cree (ou reconnecte) une boite Google / Microsoft apres le retour OAuth. */
export async function createOAuthMailbox(p: OAuthProvider, email: string, refreshToken: string, accessToken: string, expiresIn: number) {
  const db = useDatabase()
  const o = OAUTH[p]
  const c: ServerCfg = { provider: o.provider, host: o.imap.host, port: o.imap.port, secure: o.imap.secure, smtpHost: o.smtp.host, smtpPort: o.smtp.port, smtpSecure: o.smtp.secure, user: email }
  const existing = ((await db.sql`SELECT id FROM mailbox_account WHERE source = ${p} AND lower(email) = ${email}`).rows as any[])[0]
  let id: number
  if (existing) id = Number(existing.id)
  else {
    const primary = !(await hasPrimary())
    await db.sql`INSERT INTO mailbox_account (source, label, email, is_primary, enabled, config, created_at) VALUES (${p}, ${o.label}, ${email}, ${primary ? 1 : 0}, 0, ${JSON.stringify(c)}, ${now()})`
    id = Number(((await db.sql`SELECT MAX(id) AS id FROM mailbox_account`).rows[0] as any).id)
    if (primary) await writePrimary(c, id)
  }
  await setSecret(`MAILBOX_${id}_REFRESH_TOKEN`, refreshToken)
  rememberAccessToken(id, accessToken, expiresIn)
  return id
}

export async function createMailerMailbox(kind: 'mailer-shared' | 'mailer-personal', box: MailerBox) {
  const db = useDatabase()
  const dup = ((await db.sql`SELECT id FROM mailbox_account WHERE source = ${kind} AND config LIKE ${`%"mailerId":${JSON.stringify(box.id)}%`}`).rows as any[])[0]
  if (dup) return Number(dup.id)
  await db.sql`INSERT INTO mailbox_account (source, label, email, is_primary, enabled, config, created_at)
    VALUES (${kind}, ${box.name.slice(0, 80)}, ${box.email.slice(0, 200)}, 0, 0, ${JSON.stringify({ mailerId: box.id })}, ${now()})`
  return Number(((await db.sql`SELECT MAX(id) AS id FROM mailbox_account`).rows[0] as any).id)
}

/** Active / desactive le releve d'une boite (principale : imap_config.enabled, le releve existant). */
export async function setMailboxEnabled(id: number, enabled: boolean) {
  const m = await getMailbox(id)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'Boîte introuvable' })
  if (m.primary) await useDatabase().sql`UPDATE imap_config SET enabled = ${enabled ? 1 : 0} WHERE id = 1`
  await useDatabase().sql`UPDATE mailbox_account SET enabled = ${enabled ? 1 : 0} WHERE id = ${id}`
}

/** Retire une boite (et ses secrets). La principale ne se retire pas ici : ses reglages restent dans « Boîte principale ». */
export async function deleteMailbox(id: number) {
  const m = await getMailbox(id)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'Boîte introuvable' })
  if (m.primary) throw createError({ statusCode: 400, statusMessage: 'La boîte principale ne peut pas être retirée (désactive son relevé)' })
  for (const s of [`MAILBOX_${id}_PASSWORD`, `MAILBOX_${id}_REFRESH_TOKEN`]) if (secretStatus(s).set) await setSecret(s, null)
  await useDatabase().sql`DELETE FROM mailbox_account WHERE id = ${id}`
}
