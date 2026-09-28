// Lecture d'une boite e-mail en IMAP pour recuperer les factures recues en piece jointe.
// - Lecture seule : la boite est ouverte en lecture seule, aucun message n'est marque lu, deplace ni supprime.
// - Seuls les messages dont l'expediteur (et l'objet, si precise) correspond a une regle sont telecharges.
// - Le mot de passe est un secret chiffre en base (IMAP_PASSWORD, Reglages > Connexions), jamais renvoye au navigateur.
// - Les pieces jointes passent par importDocument : sans doublon (identifiant du message + nom du fichier, ou meme contenu).
import { createHash } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

export interface ImapConfig {
  provider: string; enabled: boolean; host: string; port: number; secure: boolean; user: string; folder: string
  intervalMin: number; sinceDays: number; lastUid: number; uidValidity: number; lastRunAt: string | null; lastResult: string
  syncMail: boolean; mailDays: number; mailSyncedAt: string | null; mailResult: string
  smtpHost: string; smtpPort: number; smtpSecure: boolean; fromName: string; sentFolder: string; spamFolder: string
  autoFile: boolean; treatedFolder: string
}
export interface ImapRule { id: number; name: string; sender: string; subject: string; source: string; category: string; logementId: number; enabled: boolean }

export async function getImapConfig(): Promise<ImapConfig> {
  const r = ((await useDatabase().sql`SELECT * FROM imap_config WHERE id = 1`).rows as any[])[0]
  return {
    provider: String(r.provider ?? 'custom'), enabled: !!Number(r.enabled), host: String(r.host), port: Number(r.port), secure: !!Number(r.secure), user: String(r.user), folder: String(r.folder),
    intervalMin: Number(r.interval_min), sinceDays: Number(r.since_days), lastUid: Number(r.last_uid), uidValidity: Number(r.uid_validity),
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null, lastResult: String(r.last_result),
    syncMail: !!Number(r.sync_mail), mailDays: Number(r.mail_days ?? 60), mailSyncedAt: r.mail_synced_at ? String(r.mail_synced_at) : null, mailResult: String(r.mail_result ?? ''),
    smtpHost: String(r.smtp_host ?? ''), smtpPort: Number(r.smtp_port ?? 465), smtpSecure: !!Number(r.smtp_secure ?? 1), fromName: String(r.from_name ?? ''),
    sentFolder: String(r.sent_folder ?? ''), spamFolder: String(r.spam_folder ?? ''),
    autoFile: !!Number(r.auto_file ?? 0), treatedFolder: String(r.treated_folder ?? 'Traité'),
  }
}

export async function getImapRules(): Promise<ImapRule[]> {
  return ((await useDatabase().sql`SELECT * FROM imap_rule ORDER BY id`).rows as any[]).map(r => ({
    id: Number(r.id), name: String(r.name), sender: String(r.sender), subject: String(r.subject), source: String(r.source),
    category: String(r.category), logementId: Number(r.logement_id), enabled: !!Number(r.enabled),
  }))
}

export const connect = (cfg: ImapConfig) => new ImapFlow({
  host: cfg.host, port: cfg.port, secure: cfg.secure,
  ...(cfg.secure ? {} : { doSTARTTLS: true }), // sans TLS implicite : STARTTLS obligatoire, jamais de mot de passe en clair
  auth: { user: cfg.user, pass: getSecret('IMAP_PASSWORD') },
  logger: false, tls: { rejectUnauthorized: true },
  connectionTimeout: 20_000, greetingTimeout: 20_000, socketTimeout: 120_000,
} as any)

export const errText = (e: any) => String(e?.responseText || e?.message || e).replace(/\s+/g, ' ').slice(0, 200)
export const need = (cfg: ImapConfig) =>
  !hasSecret('IMAP_PASSWORD') ? 'mot de passe de la boîte non renseigné (Réglages › Connexions)' : !cfg.host || !cfg.user ? 'serveur ou identifiant non renseigné' : null

// Test de connexion : ne lit aucun message (compte seulement les correspondances de chaque regle)
export async function testImap() {
  const cfg = await getImapConfig()
  const missing = need(cfg)
  if (missing) return { ok: false as const, error: missing }
  const client = connect(cfg)
  client.on('error', () => {})
  try {
    await client.connect()
    const folders = (await client.list()).map(f => f.path).slice(0, 60)
    if (!folders.includes(cfg.folder)) return { ok: false as const, error: `Dossier « ${cfg.folder} » introuvable`, folders }
    const lock = await client.getMailboxLock(cfg.folder, { readOnly: true })
    try {
      const since = new Date(Date.now() - cfg.sinceDays * 864e5)
      const rules = []
      for (const r of (await getImapRules()).filter(x => x.enabled)) {
        const found = await client.search({ since, from: r.sender, ...(r.subject ? { subject: r.subject } : {}) }, { uid: true })
        rules.push({ id: r.id, name: r.name, matches: Array.isArray(found) ? found.length : 0 })
      }
      return { ok: true as const, folders, rules }
    } finally { lock.release() }
  } catch (e) {
    return { ok: false as const, error: errText(e) }
  } finally { await client.logout().catch(() => {}) }
}

const ALLOWED = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'csv', 'txt', 'xlsx', 'docx'])

// Traite un message brut : importe ses pieces jointes utiles selon la regle. Renvoie le decompte.
export async function processMessage(raw: Buffer, rule: Pick<ImapRule, 'source' | 'category' | 'logementId' | 'sender' | 'subject'>) {
  const mail = await simpleParser(raw)
  const from = mail.from?.value?.map(a => a.address).filter(Boolean).join(', ') || ''
  const subject = (mail.subject || '').trim()
  // Verification cote appli (le filtre du serveur IMAP peut etre large)
  if (!from.toLowerCase().includes(rule.sender.toLowerCase())) return { added: 0, duplicates: 0, errors: 0, noAttachment: 0, skipped: 1 }
  if (rule.subject && !subject.toLowerCase().includes(rule.subject.toLowerCase())) return { added: 0, duplicates: 0, errors: 0, noAttachment: 0, skipped: 1 }
  const files = (mail.attachments || []).filter((a) => {
    const ext = (a.filename?.split('.').pop() || '').toLowerCase()
    return a.content?.length && a.filename && ALLOWED.has(ext) && a.content.length > 1500 && (ext === 'pdf' || a.contentDisposition === 'attachment')
  })
  const out = { added: 0, duplicates: 0, errors: 0, noAttachment: files.length ? 0 : 1, skipped: 0 }
  const messageId = mail.messageId || createHash('sha256').update(raw).digest('hex')
  const date = (mail.date && !Number.isNaN(+mail.date) ? mail.date : new Date()).toISOString().slice(0, 10)
  for (const a of files) {
    try {
      const r = await importDocument({
        source: rule.source, externalId: `${messageId}#${a.filename}`, logementId: rule.logementId, filename: a.filename!, data: a.content,
        title: (files.length === 1 ? subject : `${subject} — ${a.filename}`).slice(0, 120) || a.filename,
        category: rule.category, date, note: `E-mail de ${from} : « ${subject.slice(0, 120)} »`,
      })
      if (r.status === 'ok') out.added += 1; else out.duplicates += 1
    } catch (e: any) { out.errors += 1; await logImport(rule.source, 'imap', 'error', `${a.filename} : ${e?.statusMessage || e?.message || e}`) }
  }
  return out
}

let running = false
export const isImapRunning = () => running

// Releve la boite : messages recents correspondant aux regles actives, pieces jointes importees. Sans effet sur la boite.
export async function runImap(trigger: 'auto' | 'manual') {
  if (running) return { ok: false, message: 'Un relevé est déjà en cours.' }
  running = true
  const db = useDatabase()
  const save = async (result: string, lastUid?: number, validity?: number) => {
    await db.sql`UPDATE imap_config SET last_run_at = ${new Date().toISOString()}, last_result = ${result} WHERE id = 1`
    if (lastUid !== undefined) await db.sql`UPDATE imap_config SET last_uid = ${lastUid}, uid_validity = ${validity ?? 0} WHERE id = 1`
  }
  try {
    const cfg = await getImapConfig()
    const rules = (await getImapRules()).filter(r => r.enabled)
    const missing = need(cfg) || (rules.length ? null : 'aucune règle active')
    if (missing) { await save(`Relevé impossible : ${missing}`); return { ok: false, message: missing } }

    const client = connect(cfg)
    client.on('error', () => {})
    await client.connect()
    const total = { messages: 0, added: 0, duplicates: 0, noAttachment: 0, errors: 0 }
    let newLastUid = cfg.lastUid
    let validity = cfg.uidValidity
    try {
      const lock = await client.getMailboxLock(cfg.folder, { readOnly: true })
      try {
        validity = Number((client.mailbox as any)?.uidValidity ?? 0)
        const floor = validity === cfg.uidValidity ? cfg.lastUid : 0 // dossier reinitialise cote serveur : on repart de zero
        const since = new Date(Date.now() - cfg.sinceDays * 864e5)
        let failedMin = Infinity
        newLastUid = floor
        for (const rule of rules) {
          const found = await client.search({ since, from: rule.sender, ...(rule.subject ? { subject: rule.subject } : {}) }, { uid: true })
          const uids = (Array.isArray(found) ? found : []).filter(u => u > floor).sort((a, b) => a - b).slice(-200)
          for (const uid of uids) {
            try {
              const head = await client.fetchOne(String(uid), { size: true }, { uid: true })
              if (head && Number(head.size) > 30 * 1024 * 1024) { total.errors += 1; failedMin = Math.min(failedMin, uid); continue }
              const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
              if (!msg || !msg.source) continue
              const r = await processMessage(msg.source, rule)
              total.messages += 1; total.added += r.added; total.duplicates += r.duplicates; total.noAttachment += r.noAttachment; total.errors += r.errors
              if (r.errors) failedMin = Math.min(failedMin, uid)
              newLastUid = Math.max(newLastUid, uid)
            } catch (e: any) {
              total.errors += 1; failedMin = Math.min(failedMin, uid)
              await logImport(rule.source, 'imap', 'error', `message ${uid} : ${errText(e)}`)
            }
          }
        }
        // En cas d'erreur, on ne depasse pas le premier message en echec : il sera retente au prochain releve
        if (Number.isFinite(failedMin)) newLastUid = Math.min(newLastUid, failedMin - 1)
      } finally { lock.release() }
    } finally { await client.logout().catch(() => {}) }

    const summary = `${trigger === 'manual' ? 'Manuel' : 'Auto'} : ${total.messages} e-mail(s) lus, ${total.added} document(s) ajouté(s), ${total.duplicates} déjà connu(s), ${total.noAttachment} sans pièce jointe utile, ${total.errors} erreur(s)`
    await save(summary, newLastUid, validity)
    await logImport('imap', 'imap', total.errors ? 'error' : 'ok', summary)
    return { ok: true, message: summary, ...total }
  } catch (e: any) {
    const msg = `Échec : ${errText(e)}`
    await save(msg)
    await logImport('imap', 'imap', 'error', msg)
    return { ok: false, message: msg }
  } finally { running = false }
}
